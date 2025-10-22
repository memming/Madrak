# Fix for Extension Context Invalidation Warnings

## Problem
When the extension was reloaded or updated while YouTube Music tabs were open, the content script would log multiple warning messages:
```
[WARN] Extension context invalidated, cannot send message: TRACK_CHANGED
```

This happened because:
1. The old content script remained active in the page
2. It lost connection to the background script
3. It continued trying to poll and send messages
4. Each attempt generated a warning log

## Root Cause
When a Chrome extension is reloaded:
- The background script is terminated and restarted
- Old content scripts remain in pages but lose their connection
- `chrome.runtime.id` becomes unavailable
- Message passing fails

The extension was detecting this but:
1. Logging repetitive warnings
2. Not stopping the polling intervals
3. Continuing to waste resources

## Solutions Implemented

### 1. Single Informative Message
Changed from repetitive `WARN` logs to a single `INFO` message:
```
Extension context invalidated - detector will stop. 
Please reload the page to resume scrobbling.
```

**Benefits:**
- Less log spam
- Clear user guidance
- Appropriate severity level (info, not warning)

### 2. Graceful Shutdown
Added `handleContextInvalidation()` method that:
- Sets a flag to prevent further operations
- Logs a single informative message
- Calls `destroy()` to stop all polling
- Prevents repeated detection/logging

### 3. Early Exit Checks
Added context invalidation checks in key methods:
- `checkForChanges()` - stops title polling
- `updateCurrentTime()` - stops time updates
- `handleMessage()` - ignores incoming messages
- `sendMessage()` - prevents message attempts

### 4. State Tracking
Added `contextInvalidated` flag to track state:
- Set to `true` on first detection
- Checked before operations
- Prevents redundant cleanup

## Code Changes

### Added Property
```typescript
private contextInvalidated: boolean = false;
```

### New Method
```typescript
private handleContextInvalidation(): void {
  if (this.contextInvalidated) {
    return; // Already handled
  }
  
  this.contextInvalidated = true;
  
  // Log once at info level
  info('Extension context invalidated - detector will stop. Please reload the page to resume scrobbling.', {
    url: window.location.href,
    reason: 'Extension was reloaded or updated'
  });
  
  // Stop all polling
  this.destroy();
}
```

### Updated Methods
All context validity checks now call `handleContextInvalidation()` instead of logging warnings:
- `startPolling()`
- `sendMessage()`
- `handleMessage()`
- Early exit checks in polling methods

## User Experience

### Before
```
[WARN] Extension context invalidated, cannot send message: TRACK_CHANGED
[WARN] Extension context invalidated, cannot send message: TRACK_CHANGED
[WARN] Extension context invalidated, cannot send message: TRACK_CHANGED
... (repeated every 1-10 seconds)
```

### After
```
[INFO] Extension context invalidated - detector will stop. 
       Please reload the page to resume scrobbling.
```
(Appears once, then content script stops cleanly)

## Benefits

1. **Cleaner Logs** - Single informative message instead of spam
2. **Better UX** - Clear guidance to reload the page
3. **Resource Efficient** - Stops polling immediately
4. **Proper Severity** - Info level, not warning (this is normal)
5. **No Side Effects** - Prevents failed message attempts

## Testing

### Normal Development Workflow
1. Load extension in Chrome
2. Open YouTube Music tab
3. Reload the extension
4. Check console logs
5. Expected: Single info message, then silence
6. Reload the page
7. Expected: Extension re-initializes normally

### No Impact on Normal Operation
- Regular scrobbling unaffected
- Performance unchanged
- Only activates on extension reload/update

## Files Modified
- `src/content/youtube-music.ts`
  - Added `contextInvalidated` property
  - Added `handleContextInvalidation()` method
  - Updated context validity checks
  - Added early exit checks in polling methods
  - Updated global error handler

## Version
- Fixed in: v0.5.2 (unreleased)
- Date: 2025-10-22

