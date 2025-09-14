# Madrak Debug Logging Guide

Madrak includes comprehensive debug logging to help troubleshoot scrobbling issues. Here's how to use it effectively.

## Enabling Debug Logging

### Method 1: Extension Settings
1. Open the extension popup
2. Click "Settings" to open the options page
3. In the "Advanced Settings" section:
   - Enable "Debug Mode" checkbox
   - Set "Log Level" to "Debug (All messages)"
4. Click "Save Settings"

### Method 2: Console Commands
Open the browser console (F12) and run:
```javascript
// Enable debug logging
chrome.storage.sync.set({
  extension_settings: {
    debugMode: true,
    logLevel: 'debug'
  }
});

// Reload the extension
chrome.runtime.reload();
```

## Viewing Debug Information

### Extension Popup Debug Panel
1. Open the extension popup
2. Click the "Debug" button
3. View logs in three tabs:
   - **Recent Logs**: All recent log entries
   - **Errors**: Only error messages
   - **System Info**: Extension and browser information

### Browser Console
All debug messages are also logged to the browser console with the prefix `[Madrak]`:

```javascript
// Example console output
[2024-01-15T10:30:45.123Z] [Madrak] [DEBUG] Track Detected: Artist - Song Title
[2024-01-15T10:30:45.124Z] [Madrak] [DEBUG] Context: {track: {...}, source: "youtube-music"}
[2024-01-15T10:30:45.125Z] [Madrak] [INFO] Queued scrobble: Artist - Song Title
```

## Log Levels

- **DEBUG**: Detailed information for troubleshooting
- **INFO**: General information about extension operation
- **WARN**: Warning messages about potential issues
- **ERROR**: Error messages when something goes wrong

## Key Debug Information

### Track Detection
Debug logs show:
- When tracks are detected on YouTube Music
- Track information extracted from the DOM
- Play state changes (playing/paused)
- Track change detection

### Scrobbling Process
Debug logs show:
- Whether tracks meet scrobbling criteria
- Track sanitization and preparation
- Queue management
- API requests to Last.fm
- Success/failure of scrobbles

### API Communication
Debug logs show:
- Last.fm API requests and responses
- Authentication status
- Rate limiting information
- Error details with HTTP status codes

## Common Debug Scenarios

### Track Not Scrobbling
Look for these debug messages:
```
[DEBUG] Checking if track should be scrobbled
[DEBUG] Track too short to scrobble: Song Title (25s)
[DEBUG] Not enough of track played yet: 30% (required: 50%)
[DEBUG] User not authenticated, cannot scrobble
```

### API Errors
Look for these debug messages:
```
[ERROR] API request failed for track.scrobble
[ERROR] Last.fm API returned failed status
[ERROR] HTTP error! status: 401 - Unauthorized
```

### Track Detection Issues
Look for these debug messages:
```
[DEBUG] Starting track detection
[DEBUG] Track extracted from DOM
[ERROR] Failed to detect current track
[DEBUG] No track detected, handling track end
```

## Exporting Debug Information

### From Extension Popup
1. Open the debug panel
2. Click "Export Logs"
3. A JSON file will be downloaded with all debug information

### From Console
```javascript
// Get debug information
const debugInfo = await chrome.runtime.sendMessage({type: 'GET_DEBUG_INFO'});
console.log(debugInfo);

// Export logs
const logs = await chrome.runtime.sendMessage({type: 'EXPORT_LOGS'});
console.log(logs);
```

## Debug Information Structure

The exported debug information includes:

```json
{
  "debugInfo": {
    "loggerConfig": {
      "level": "debug",
      "enableConsole": true,
      "enableStorage": true
    },
    "recentErrors": [...],
    "timestamp": "2024-01-15T10:30:45.123Z",
    "userAgent": "Mozilla/5.0...",
    "url": "https://music.youtube.com/..."
  },
  "logs": [
    {
      "timestamp": "2024-01-15T10:30:45.123Z",
      "level": "debug",
      "message": "Track Detected: Artist - Song Title",
      "args": [...],
      "source": "youtube-music",
      "context": {...}
    }
  ],
  "exportTime": "2024-01-15T10:30:45.123Z"
}
```

## Troubleshooting Tips

1. **Enable debug mode** before reproducing the issue
2. **Check the console** for error messages
3. **Look for patterns** in failed scrobbles
4. **Export logs** and share them for support
5. **Check system info** for browser/extension compatibility

## Performance Impact

Debug logging has minimal performance impact when enabled:
- Logs are stored in memory (max 1000 entries)
- Console output is throttled
- Log storage is disabled by default
- Can be easily disabled in settings

## Support

When reporting issues, please include:
1. Debug logs (exported from the extension)
2. Browser console output
3. Steps to reproduce the issue
4. Browser and extension version information
