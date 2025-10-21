# Testing Plan: Track Detection Improvements

## Changes Summary

This update improves track detection and replay handling in the YouTube Music content script.

### Code Changes

1. **Removed `isPlaying` requirement for backward time jump detection**
   - Location: `src/content/youtube-music.ts`, line ~552
   - Impact: Detects track replays even when paused

2. **Added track completion and restart detection**
   - Location: `src/content/youtube-music.ts`, lines ~561-572
   - Impact: Properly detects when a track finishes and automatically restarts

3. **Reset scrobble flag on track end**
   - Location: `src/content/youtube-music.ts`, line ~662
   - Impact: Allows the same track to be scrobbled multiple times

## Test Scenarios

### Scenario 1: Track Replay Detection
**Objective**: Verify that replaying the same track is detected and can be scrobbled

**Steps**:
1. Play a song on YouTube Music
2. Let it play for at least 30 seconds
3. Drag the progress bar back to the beginning
4. Verify that the extension detects this as a track change
5. Play through again and verify it can be scrobbled

**Expected Result**: 
- Track change is detected when seeking backwards
- Track can be scrobbled multiple times

### Scenario 2: Track Completion and Restart
**Objective**: Verify detection of track completing and restarting

**Steps**:
1. Play a song on YouTube Music
2. Let it play until it's within 5 seconds of the end
3. Observe if the track automatically restarts or loops
4. Verify the extension detects this as a new playthrough

**Expected Result**:
- Extension detects when track completes and restarts
- Each complete playthrough can potentially be scrobbled

### Scenario 3: Paused State Replay
**Objective**: Verify that seeking while paused is detected

**Steps**:
1. Play a song on YouTube Music
2. Pause the track partway through
3. Drag the progress bar back to the beginning
4. Resume playback
5. Verify track change is detected

**Expected Result**:
- Track change is detected even when seeking while paused
- Playback continues normally after resume

### Scenario 4: Same Track Repeated Scrobbles
**Objective**: Verify the same track can be scrobbled multiple times

**Steps**:
1. Play a track for more than 50% of its duration or 4 minutes
2. Let it end naturally or skip to next track
3. Verify it was scrobbled
4. Play the same track again
5. Let it play through the scrobble threshold again
6. Verify it can be scrobbled again

**Expected Result**:
- First playthrough is scrobbled
- Second playthrough is also scrobbled
- No "already scrobbled" blocking

## Manual Testing Checklist

- [ ] Build extension: `npm run build`
- [ ] TypeScript check passes: `npx tsc --noEmit`
- [ ] Load unpacked extension in Chrome from `dist/` folder
- [ ] Navigate to YouTube Music
- [ ] Open browser DevTools console
- [ ] Enable debug mode in extension settings
- [ ] Test Scenario 1: Track replay detection
- [ ] Test Scenario 2: Track completion and restart
- [ ] Test Scenario 3: Paused state replay
- [ ] Test Scenario 4: Same track repeated scrobbles
- [ ] Check for any console errors
- [ ] Verify normal playback still works correctly
- [ ] Verify pause/resume functionality
- [ ] Verify skip to next track functionality

## Debug Console Output to Look For

When testing, look for these debug messages in the console:

- `"Track replayed or seeked backwards"` - When backward seeking is detected
- `"Track completed and restarted"` - When track finishes and restarts
- `"Track ended"` - When track ends normally
- `"Reset the scrobble flag so the same track can be scrobbled if replayed"` - When flag is reset

## Regression Testing

Verify these existing features still work:

- [ ] Normal track playback and scrobbling
- [ ] Now Playing updates to Last.fm
- [ ] Pause/resume detection
- [ ] Track change detection (different songs)
- [ ] Album art display
- [ ] Track metadata extraction (title, artist, album)
- [ ] Duration and progress tracking

## Known Edge Cases

1. **Very short tracks (< 30 seconds)**: These won't be scrobbled per Last.fm requirements
2. **Network issues**: Scrobbles queue up and retry
3. **Multiple YouTube Music tabs**: Each tab tracks independently
4. **Page refresh**: Current track state is lost (expected behavior)

## Success Criteria

✅ All test scenarios pass
✅ No console errors during testing
✅ Existing functionality remains intact
✅ TypeScript compilation succeeds
✅ No linting errors
✅ Extension builds successfully

## Notes for Testers

- Debug mode must be enabled to see detailed console logs
- Scrobbles are subject to Last.fm's rules (minimum 30 seconds or 50% of track)
- The extension respects Last.fm's rate limiting
- Test with your actual Last.fm account connected for full integration testing

