# Release Notes - v0.6.0

**Release Date:** October 22, 2025

## 🎯 Major Fix: Accurate Scrobbling for Short Tracks

This release fixes a critical issue where short tracks (1-2 minutes) were not being scrobbled due to inaccurate playback duration tracking.

### The Problem
Songs under ~2 minutes were frequently missing from scrobble history because the `playDuration` value was incorrectly recorded as very low (e.g., 6-7 seconds instead of 75+ seconds), even when played to completion.

### Root Cause
A race condition between two polling intervals caused track state corruption:
- Time updates ran every 3 seconds
- Track change detection ran every 10 seconds
- When a track changed, the time update would overwrite the old track's `currentTime` with the new track's playback position before the change was detected

### The Solution: Track Snapshot System

Implemented a snapshot-based architecture that preserves accurate track state:

```typescript
// Every second, take a clean snapshot of current state
this.lastTrackSnapshot = {
  ...this.currentTrack,
  currentTime: currentTime,
  isPlaying: isPlaying
};

// When track changes, use the snapshot for scrobbling
const trackToScrobble = this.lastTrackSnapshot || this.currentTrack;
const playDuration = trackToScrobble.currentTime;
```

**Key improvements:**
- **Immune to corruption**: Snapshot preserved even if DOM shows new track
- **Always accurate**: Updated every 1 second, max drift of 1 second  
- **10x faster detection**: Track changes now detected in 1 second (was up to 10 seconds)
- **Simple and reliable**: Direct use of snapshot data, no complex fallbacks

## 🔧 Additional Improvements

### 1. Enhanced Track Change Detection
- Title change detection now runs every 1 second (was 10 seconds)
- Time jump detection triggers immediate full detection
- Prevents time corruption from new track data

### 2. Cleaner Extension Context Handling
- Extension reload/update now handled gracefully
- Single informative message instead of log spam
- Automatic cleanup and polling shutdown
- Clear user guidance to reload page

### 3. Performance Optimizations
- More frequent time updates (1s instead of 3s)
- Minimal overhead (2-3 lightweight DOM queries per second)
- Snapshot creation is a simple object copy (very fast)
- No impact when tab is hidden (polling pauses)

## 📊 Expected Behavior

**Short tracks (1-2 minutes):**
- Should now scrobble reliably when played >50%
- playDuration accurate within ±1-2 seconds
- percentPlayed shows 90-100% for completed tracks

**Logs will show:**
```
[INFO] Previous track ended for scrobbling consideration
  track: "Song Title"
  duration: 83
  playDuration: 78
  snapshotUsed: true
  percentPlayed: 94
```

## 🐛 Bug Fixes

- Fixed: Short tracks not scrobbling due to low playDuration values
- Fixed: Time corruption when tracks change rapidly
- Fixed: Repetitive warning logs on extension reload
- Fixed: Race condition between time updates and track detection

## 🔄 Technical Changes

**Modified Files:**
- `src/content/youtube-music.ts`
  - Added `lastTrackSnapshot` property
  - Rewrote `updateCurrentTime()` with change detection
  - Updated `handleTrackChanged()` to use snapshot
  - Updated `checkForScrobble()` to use snapshot
  - Added context invalidation handling
- Version bumped across all files

## 📝 Notes

This is a significant architectural improvement that makes scrobbling more reliable, especially for:
- Classical music with short movements
- Punk/hardcore tracks
- Interludes and intros
- Any playlist with tracks under 2-3 minutes

## 🙏 Acknowledgments

Thanks to users who reported the missing short tracks issue and helped debug with detailed logs!

---

**Full Changelog:** [CHANGELOG.md](CHANGELOG.md)

