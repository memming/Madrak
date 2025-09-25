# Madrak v0.4.1 Release Notes

## 🔧 Patch Release: Content Script Logging Fix

**Release Date**: September 19, 2025  
**Version**: 0.4.1  
**Download**: [madrak-0.4.1.zip](web-ext-artifacts/madrak-0.4.1.zip)

---

## 🐛 Bug Fixes

### Content Script Logging Fix
- **Fixed**: Logger settings not updating immediately when changed in extension popup
- **Improved**: Content script now uses `chrome.storage.onChanged` listener for immediate logger re-initialization
- **Enhanced**: More reliable than previous message-based approach
- **Benefit**: Debug mode and log level changes take effect instantly without page reload

---

## 🔧 Technical Improvements

### Architecture Enhancement
- **Replaced**: Message-based logger updates with direct storage change listener
- **Added**: `chrome.storage.onChanged` listener in content script initialization
- **Improved**: Type safety with proper null checking
- **Optimized**: More robust communication between extension components

### Code Quality
- **Fixed**: TypeScript warning about potential undefined object
- **Enhanced**: Error handling in storage change listener
- **Cleaned**: Removed redundant message-based logger update code

---

## 📁 Files Changed

### Modified Files
- `src/content/youtube-music.ts` - Added storage change listener, removed message-based updates
- `package.json` - Updated to version 0.4.1
- `src/manifest.json` - Updated to version 0.4.1
- `src/shared/constants.ts` - Updated EXTENSION_VERSION
- `README.md` - Updated version documentation
- `src/popup/popup.html` - Updated version display
- `src/options/options.html` - Updated version display
- `src/popup/popup.ts` - Updated debug info version

### New Files
- `TESTING_INSTRUCTIONS.md` - Comprehensive testing guide for the logging fix
- `scripts/create-github-release.js` - GitHub release creation helper

---

## 🧪 Testing

### What Was Tested
- ✅ Logger settings update immediately when changed in popup
- ✅ Debug mode toggle works without page reload
- ✅ Log level changes take effect instantly
- ✅ Storage change listener properly detects settings updates
- ✅ No TypeScript warnings or build errors

### Test Scenarios Covered
- **Scenario 1**: Enable/disable debug mode
- **Scenario 2**: Change log level (info → debug → warn → error)
- **Scenario 3**: Multiple rapid settings changes
- **Scenario 4**: Settings persistence across page reloads

---

## 🎯 User Impact

### Before Fix (v0.4.0)
- Settings changes required YouTube Music page reload to take effect
- Debug mode toggle didn't work immediately
- Log level changes were not reflected in console

### After Fix (v0.4.1)
- Settings changes take effect immediately
- Debug mode toggle works instantly
- Log level changes are reflected immediately in console
- No need to reload YouTube Music page

---

## 🛠️ Developer Experience

### Improved Debugging
- **Immediate Feedback**: Logger changes take effect instantly
- **Better Workflow**: No more page reloads during debugging
- **Reliable Detection**: Storage-based approach is more robust
- **Clear Logging**: "Logger re-initialized after settings change from storage" message

### Version Management
- **Automated Updates**: Used centralized version management system
- **Consistent Versions**: All files updated to 0.4.1 automatically
- **Clean Build**: No TypeScript warnings or errors
- **Ready Package**: Extension packaged as `madrak-0.4.1.zip`

---

## 📊 Statistics

- **Files Changed**: 8 files
- **Lines Added**: 83 lines
- **Lines Removed**: 6 lines
- **Bug Fixes**: 1 major fix
- **Package Size**: 88,546 bytes (88 KB)
- **Build Time**: ~2.2 seconds

---

## 🔄 Migration Notes

### For Users
- **No Action Required**: This is a seamless update
- **Improved Experience**: Better debugging capabilities
- **Immediate Benefits**: Logger settings work instantly

### For Developers
- **Better Debugging**: Logger updates work immediately
- **Cleaner Code**: Removed message-based approach
- **Type Safety**: Fixed TypeScript warnings

---

## 🎯 What's Next

### Planned Features
- Enhanced track detection accuracy
- Improved error handling and recovery
- Performance optimizations
- Additional debugging tools

### Version Management
- Continue using centralized version management
- Automated release processes
- CI/CD integration

---

## 🙏 Acknowledgments

- **Feature Contributors**: Google Labs Jules for the content script logging fix
- **Testing**: Verified logging functionality works correctly
- **Version Management**: Centralized system working perfectly

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/memming/Madrak/issues)
- **Documentation**: [README.md](README.md)
- **Version Management**: [docs/VERSION_MANAGEMENT.md](docs/VERSION_MANAGEMENT.md)

---

**Download Madrak v0.4.1**: [madrak-0.4.1.zip](web-ext-artifacts/madrak-0.4.1.zip)