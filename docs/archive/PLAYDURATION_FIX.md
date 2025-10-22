# Fix for playDuration Being 0 Issue

## Problem
Songs were not being scrobbled because the `playDuration` value was sometimes 0 or very low, even though the songs were played till the end. This particularly affected short tracks (1:05 to 2:00 minutes).

**Example from logs:**
```
Track V ended: duration 83 seconds, playDuration only 6 seconds (7% played)
Track VI started: currentTime 7 seconds
```

## Root Cause (The Real Issue)

The problem was a **race condition** between two polling intervals:

1. **Title check**: Every 10 seconds - detects track changes
2. **Time update**: Every 1 second - updates `currentTime`

**What happened:**
```
0:00 - Track A starts
1:23 - Track A ends (83 seconds), Track B starts immediately
1:24 - updateCurrentTime() runs, sees Track B's time (1s) and UPDATES this.currentTrack.currentTime = 1
1:25 - updateCurrentTime() runs again, currentTime = 2
1:26 - updateCurrentTime() runs again, currentTime = 3
...
1:30 - checkForChanges() FINALLY detects title changed
1:30 - handleTrackChanged() uses this.currentTrack.currentTime = 7 (WRONG! This is Track B's time!)
```

The `updateCurrentTime()` method was **blindly updating** `this.currentTrack.currentTime` with data from the DOM, which was already showing the NEW track. It didn't verify the track was still the same!

By the time we detected the track change (up to 10 seconds later), the old track's `currentTime` had been overwritten with the new track's playback position.

## Solutions Implemented

### 1. Track Snapshot System (Key Innovation)
Implemented a **snapshot-based approach** to preserve accurate track state:

**How it works:**
```typescript
private lastTrackSnapshot: YouTubeMusicTrack | null = null;

// Every second, after updating currentTime, take a snapshot
this.lastTrackSnapshot = {
  ...this.currentTrack,
  currentTime: currentTime,
  isPlaying: isPlaying
};

// When track changes, use the snapshot (not the corrupted currentTrack)
const trackToScrobble = this.lastTrackSnapshot || this.currentTrack;
const playDuration = trackToScrobble.currentTime;
```

**Benefits:**
- **Immune to corruption**: Even if DOM shows new track, snapshot has old track's data
- **Always accurate**: Snapshot updated every 1 second, max drift of 1 second
- **Simple and reliable**: Direct use of snapshot's currentTime, no complex fallbacks needed

### 2. Fast Track Change Detection in Time Updates
The `updateCurrentTime()` method now **actively detects track changes** instead of blindly updating:

**A. Title Check (every 1 second):**
```typescript
const currentTitle = document.title;
if (currentTitle !== this.lastTitle) {
  this.detectCurrentTrack(); // Immediate full detection
  return; // Don't corrupt the old track's time
}
```

**B. Time Jump Detection:**
```typescript
// Backwards jump > 5s = track changed
if (currentTime < this.currentTrack.currentTime - 5) {
  this.detectCurrentTrack();
  return; // Preserve old time
}

// Forward jump > 30s = seek or track change
if (currentTime > this.currentTrack.currentTime + 30) {
  this.detectCurrentTrack();
  return; // Preserve old time
}
```

**Impact:**
- Track changes detected within **1 second** instead of up to 10 seconds
- Old track's `currentTime` is **preserved** until change is properly handled
- Prevents corruption of play duration data

### 2. Increased Time Update Frequency
Changed `TIME_UPDATE_INTERVAL_MS` from **3000ms (3 seconds)** to **1000ms (1 second)**.

**Impact:**
- More accurate tracking of playback position
- Faster detection of track changes
- Maximum drift of 1 second instead of 3 seconds

### 3. Enhanced Logging
Added detailed debug logging:
- "⚡ Title changed detected during time update"
- "⚠️ Time jumped backwards - likely track changed"
- "⚠️ Time jumped forward significantly"
- "snapshotUsed: true/false" - indicates if snapshot was used for scrobbling
- Shows old/new time values and percentPlayed for debugging

## Benefits

### Track Change Detection
- **10x faster detection**: 1 second instead of up to 10 seconds
- **Accurate playDuration**: Old track's time preserved correctly
- **Multiple detection methods**: Title change + time jumps

### For Short Tracks (1-2 minutes)
Before: Often showed 6-7 seconds played (due to corruption)
After: Accurate time OR 90% estimate if needed
- Example: 83-second track
  - Before: playDuration = 6 seconds → Rejected ✗
  - After: playDuration = ~75 seconds → Scrobbled ✓

### For All Tracks
- More accurate playback tracking (1s instead of 3s updates)
- Better capture of final play position
- No more time corruption from new track
- Works correctly with autoplay playlists

### Safety
- Time jump detection prevents false updates
- Conservative fallbacks for edge cases
- Only estimates when appropriate (short tracks)
- Validates time changes before updating

## Files Modified
- `src/content/youtube-music.ts`
  - **Added `lastTrackSnapshot` property**: Stores clean copy of last track state
  - Changed `TIME_UPDATE_INTERVAL_MS`: 3000 → 1000
  - **Major rewrite of `updateCurrentTime()`**:
    - Added title change detection (checks every 1s)
    - Added time jump detection (backwards/forwards)
    - **Takes snapshot after each successful update**
    - Triggers full detection when changes detected
  - **Updated `handleTrackChanged()`**: 
    - Uses `lastTrackSnapshot` for ended track data
    - Direct use of snapshot's currentTime (no fallbacks needed)
    - Clears snapshot after use
  - **Updated `checkForScrobble()`**:
    - Uses `lastTrackSnapshot` for accurate playDuration
    - Clears snapshot after use
  - **Updated `detectCurrentTrack()`**:
    - Takes snapshot when track is unchanged (full detection has complete info)
  - Updated comments and log messages

## Testing Recommendations

### What to Test
1. **Short tracks (1-2 minutes)**
   - Play several to completion
   - Check logs for accurate playDuration values
   - Verify scrobbles appear in Last.fm

2. **Track changes**
   - Skip to next track quickly
   - Let playlist autoplay
   - Check that old track shows correct playDuration
   - Look for "⚡ Title changed detected" logs

3. **Edge cases**
   - Manual seeks during playback
   - Pause/resume
   - Very short tracks (< 30 seconds)
   - Very long tracks (> 10 minutes)

### What to Look For in Logs
```
✓ Good: playDuration ~= track duration when played to end
✓ Good: "snapshotUsed: true" when track changes
✓ Good: "⚡ Title changed detected during time update"
✓ Good: percentPlayed around 90-100% for completed tracks

✗ Bad: playDuration < 10 seconds for completed tracks
✗ Bad: percentPlayed < 50% for tracks played to end
✗ Bad: "snapshotUsed: false" consistently (snapshot system not working)
```

### Example of Good Logs
```
[INFO] ⏱️ Time update
  track: "Goldberg Variations, BWV 988: Variation V"
  currentTime: 78
  percentPlayed: 94

[INFO] ⚡ Title changed detected during time update

[INFO] Previous track ended for scrobbling consideration
  track: "Goldberg Variations, BWV 988: Variation V"
  duration: 83
  playDuration: 78
  snapshotUsed: true
  percentPlayed: 94
```

### Expected Behavior
- Short tracks should scrobble when played >50% (or 4 minutes, whichever is first)
- Track changes should be detected within 1-2 seconds
- playDuration should be accurate (±1-2 seconds)
- **`snapshotUsed: true` should appear for most track changes**
- No corruption from new track's time

## Performance Impact
- Minimal: only 2-3 additional DOM queries per second
- Queries are lightweight (text content only)
- Snapshot creation is a simple object copy (very fast)
- No impact when tab is hidden (polling pauses)

## Summary

The snapshot-based approach provides a **clean separation** between:
1. **Active tracking** (`this.currentTrack`) - can be updated/modified during playback
2. **Historical data** (`this.lastTrackSnapshot`) - frozen copy for scrobbling

This architecture is:
- **Robust**: Immune to race conditions and DOM timing issues
- **Simple**: Direct use of snapshot data, no complex fallback logic
- **Accurate**: Updated every second, captures final state before track changes
- **Reliable**: Always has clean data for scrobbling, even if track changes aren't detected immediately

## Version
- Fixed in: v0.5.2 (unreleased)
- Date: 2025-10-22

