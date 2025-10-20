# Scrobbling Debug Guide

## Issue: Tracks Detected But Not Scrobbling

### Root Cause
When the performance redesign simplified the extraction methods, it removed fallback logic for duration and currentTime. If the primary CSS selectors don't match, duration defaults to `0:00` = 0 seconds, which causes scrobbling to fail.

### Last.fm Scrobbling Requirements
1. **Duration**: Track must be > 30 seconds
2. **Play Time**: Must play for either:
   - 240 seconds (4 minutes), OR
   - 50% of track duration (whichever is **shorter**)

If duration is 0, these checks fail and scrobbling never happens.

---

## What Was Fixed

### Added Smart Fallback Logic

```typescript
// Primary selector
const durationElement = document.querySelector(YOUTUBE_MUSIC_SELECTORS.DURATION);

if (durationElement?.textContent?.trim()) {
  // Use primary selector
  durationText = durationElement.textContent.trim();
} else {
  // FALLBACK: Look for time patterns in .time-info area
  const timeInfoElement = document.querySelector('ytmusic-player-bar .time-info');
  const timeMatches = timeInfoElement.textContent?.match(/\d+:\d+/g);
  
  if (timeMatches && timeMatches.length >= 2) {
    // Format: "0:42 / 3:24" or "0:42 3:24"
    currentTimeText = timeMatches[0]; // First time
    durationText = timeMatches[1];    // Second time
  }
}
```

### Added Debug Logging

Three new log points to diagnose issues:

#### 1. Time Extraction
```
Time extraction: {
  track: "Artist - Title",
  durationText: "3:24",      // What we extracted as text
  duration: 204,              // Parsed to seconds
  currentTimeText: "0:42",
  currentTime: 42,
  durationElement: "...",     // CSS class of element used
  currentTimeElement: "..."
}
```

#### 2. Track Changed
```
Track changed: Artist - Title {
  duration: 204,              // Total track length
  currentTime: 0,             // Starting at 0
  isPlaying: true
}
```

#### 3. Previous Track Ended
```
Previous track ended for scrobbling consideration {
  track: "Previous Artist - Previous Title",
  duration: 204,              // Total length
  playDuration: 153,          // How long it played
  percentPlayed: 75           // 75% played
}
```

---

## How to Debug

### Step 1: Open YouTube Music Console
1. Open YouTube Music in Chrome
2. Press F12 to open DevTools
3. Go to **Console** tab
4. Filter for "Madrak" logs

### Step 2: Play a Track
1. Start playing any track
2. Watch for `Time extraction:` log
3. **Check these values**:
   ```
   durationText: "3:24"  ✅ Should be track length, NOT "0:00"
   duration: 204         ✅ Should be > 30 (seconds)
   currentTimeText: "0:00" or "0:42" ✅ Current position
   currentTime: 0 or 42   ✅ In seconds
   ```

### Step 3: Let Track Play
1. Let the track play for at least 50% of its duration
   - For a 3:24 track (204s), play for at least 102 seconds
   - Or just let it play to the end
2. Skip to next track or let it auto-advance

### Step 4: Check Scrobbling Logs
1. Look for `Previous track ended for scrobbling consideration`
2. **Check these values**:
   ```
   duration: 204           ✅ Should match track length
   playDuration: 153       ✅ How long you played it
   percentPlayed: 75       ✅ Should be >= 50 for scrobble
   ```

3. If `percentPlayed >= 50%`, track should scrobble
4. Check for `Scrobbled:` log from background service

---

## Common Issues & Solutions

### Issue 1: Duration is 0
**Symptom**:
```
Time extraction: {
  durationText: "0:00",
  duration: 0,  ❌
  ...
}
```

**Cause**: Both primary selector and fallback failed to find duration

**Solution**:
1. Check if YouTube Music UI changed
2. Inspect the player bar in DevTools
3. Find where duration is displayed
4. Update selectors in `src/shared/constants.ts`

**How to inspect**:
1. Right-click on the duration in YouTube Music player
2. Select "Inspect"
3. Note the element structure
4. Update `YOUTUBE_MUSIC_SELECTORS.DURATION`

---

### Issue 2: Duration Correct But Not Scrobbling
**Symptom**:
```
Previous track ended: {
  duration: 204,    ✅
  playDuration: 30,  ❌ Too short
  percentPlayed: 14  ❌ < 50%
}
```

**Cause**: Track didn't play long enough

**Explanation**:
- Track must play for 50% of duration OR 240 seconds (whichever is shorter)
- For 204s track: needs 102s (50%)
- For 600s track: needs 240s (not 300s!)

**Solution**: Let tracks play longer before skipping

---

### Issue 3: PercentPlayed is NaN or Infinity
**Symptom**:
```
Previous track ended: {
  duration: 0,          ❌ Division by zero
  playDuration: 42,
  percentPlayed: NaN    ❌
}
```

**Cause**: Duration is 0, can't calculate percentage

**Solution**: Fix duration extraction (see Issue 1)

---

### Issue 4: No "Previous track ended" Log
**Symptom**: Track changes but no scrobbling consideration log

**Possible Causes**:
1. **10-second polling delay**: With new polling approach, track changes detected every 10s
   - This is normal and expected
   - Wait up to 10 seconds after track change
   
2. **First track of session**: No previous track to scrobble
   - Play at least 2 tracks to see scrobbling
   
3. **Tab was hidden**: Polling paused when tab hidden
   - Keep YouTube Music tab visible/active

---

## Expected Behavior

### Normal Flow
```
1. Track starts playing
   → Time extraction: duration: 204 ✅
   
2. Wait 10 seconds (polling interval)
   → Track changed: Artist - Title ✅
   
3. Play for 50%+ of track (or let it finish)
   → Wait up to 10 seconds
   
4. Next track starts
   → Time extraction: duration: 187 ✅
   → Wait 10 seconds
   → Track changed: New Artist - New Title ✅
   → Previous track ended: percentPlayed: 75 ✅
   
5. Background service processes scrobble
   → Scrobbled: Previous Artist - Previous Title ✅
```

### Timing Notes
- **Track detection**: Up to 10 seconds after actual change
- **Scrobbling**: Up to 10 seconds after track ends
- **Total delay**: Could be 20 seconds max
- This is **normal and expected** with the polling approach

---

## What to Report

If scrobbling still doesn't work, provide:

1. **Console logs** with these patterns:
   ```
   [Madrak] Time extraction:
   [Madrak] Track changed:
   [Madrak] Previous track ended:
   [Madrak] Scrobbled: OR [Madrak] Scrobble failed:
   ```

2. **Track details**:
   - Track title and artist
   - How long you played it
   - What happened (skipped, played to end, etc.)

3. **Values from logs**:
   - `duration`: X seconds
   - `playDuration`: Y seconds
   - `percentPlayed`: Z%

4. **Expected vs Actual**:
   - Should it have scrobbled? (played >= 50%)
   - Did it scrobble? (check Last.fm profile)

---

## Quick Test Script

1. Open YouTube Music
2. Open Console (F12)
3. Play any track for 2+ minutes
4. Skip to next track
5. Wait 10 seconds
6. Check for these logs:
   ```
   ✅ Time extraction: duration > 0
   ✅ Track changed: <track name>
   ✅ Previous track ended: percentPlayed >= 50
   ✅ Scrobbled: <track name>
   ```

If all ✅, scrobbling is working!
If any ❌, provide those logs.

