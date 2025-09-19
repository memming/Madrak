# Testing Instructions - Content Script Logging Fix

## 🧪 PR Being Tested

**Branch**: `fix-content-script-logging`  
**Commit**: `5def415` - Fix(logging): Update content script logger on settings change  
**Author**: google-labs-jules[bot]  

## 🔧 What This Fix Does

### Problem
The logger in the content script was not being updated when extension settings were changed. This meant that debug mode and log level settings were not reflected in the DevTools console for the YouTube Music tab.

### Solution
Added a `chrome.storage.onChanged` listener to `src/content/youtube-music.ts`. This listener detects changes to the extension's settings in Chrome storage and automatically re-initializes the logger with the new values.

### Changes Made
- **File**: `src/content/youtube-music.ts`
- **Function**: `initialize()` method
- **Addition**: `chrome.storage.onChanged` listener
- **Benefit**: More reliable than message-based approach

## 🚀 How to Test

### 1. Load Extension in Chrome

1. **Open Chrome** and navigate to `chrome://extensions/`
2. **Enable Developer mode** (toggle in top-right corner)
3. **Click "Load unpacked"**
4. **Select the `dist` folder** from this project directory
5. **Verify** the extension appears as "Madrak v0.4.0"

### 2. Test the Logging Fix

#### Step 1: Initial Setup
1. **Go to YouTube Music**: https://music.youtube.com
2. **Open DevTools**: Press F12 or right-click → Inspect
3. **Go to Console tab**
4. **Play some music** to activate the content script

#### Step 2: Test Settings Change
1. **Click the Madrak extension icon** in Chrome toolbar
2. **Go to Settings tab** in the popup
3. **Toggle Debug Mode** ON (if it's off)
4. **Change Log Level** to "debug" (if not already)
5. **Save settings**

#### Step 3: Verify Logger Update
1. **Go back to YouTube Music tab**
2. **Check DevTools Console**
3. **Look for**: "Logger re-initialized after settings change from storage" message
4. **Verify**: Debug messages should now appear with the new settings

#### Step 4: Test Different Settings
1. **Change settings again** (toggle debug mode, change log level)
2. **Verify**: Logger updates immediately in content script
3. **Check**: Console messages reflect the new settings

### 3. Expected Behavior

#### Before Fix (Old Behavior)
- Settings changes in popup don't affect content script logging
- Content script continues using old logger settings
- Debug mode/log level changes don't take effect until page reload

#### After Fix (New Behavior)
- Settings changes immediately update content script logger
- Console shows "Logger re-initialized with new settings" message
- Debug mode and log level changes take effect immediately
- No need to reload the YouTube Music page

## 🔍 What to Look For

### Success Indicators
- ✅ "Logger re-initialized after settings change from storage" message appears in console
- ✅ Debug messages appear/disappear when toggling debug mode
- ✅ Log level changes immediately affect console output
- ✅ No errors in console related to logger initialization

### Potential Issues
- ❌ No "Logger re-initialized" message after settings change
- ❌ Debug mode toggle doesn't affect console output
- ❌ Log level changes don't take effect
- ❌ Console errors related to logger initialization

## 📊 Test Scenarios

### Scenario 1: Enable Debug Mode
1. Start with debug mode OFF
2. Play music on YouTube Music
3. Check console - should see minimal logging
4. Enable debug mode in extension popup
5. Check console - should see "Logger re-initialized" message
6. Verify debug messages now appear

### Scenario 2: Change Log Level
1. Start with log level "info"
2. Change to "debug" in extension popup
3. Check console - should see "Logger re-initialized" message
4. Verify more detailed logging appears

### Scenario 3: Multiple Changes
1. Make several settings changes in quick succession
2. Verify each change triggers logger re-initialization
3. Check that final settings are correctly applied

## 🐛 Reporting Issues

If you encounter any issues:

1. **Check Console**: Look for error messages
2. **Check Extension Popup**: Verify settings are saved correctly
3. **Check Background Script**: Look for errors in extension's background page
4. **Document Steps**: Note exactly what you did and what happened

## 📁 Files Modified

- `src/content/youtube-music.ts` - Added logger re-initialization logic
- `package-lock.json` - Version update (minor)

## 🎯 Testing Focus

The main focus is on **immediate logger updates** when settings change. The fix uses Chrome's storage change listener which is more reliable than message-based communication. This should eliminate the need to reload the YouTube Music page for logging changes to take effect.

### Improved Approach
- **Previous**: Message-based communication (could be unreliable)
- **Current**: Direct storage change listener (more robust)
- **Benefit**: Settings changes are detected immediately when saved to Chrome storage