# Madrak v0.4.0 Release Notes

## 🎉 Major Release: Centralized Version Management & Repeat Scrobble Fix

**Release Date**: September 19, 2025  
**Version**: 0.4.0  
**Download**: [madrak-0.4.0.zip](web-ext-artifacts/madrak-0.4.0.zip)

---

## 🚀 New Features

### Centralized Version Management System
- **Single Source of Truth**: `package.json` now serves as the authoritative version source
- **Automated Version Updates**: New scripts to maintain consistency across all files
- **Build-time Version Injection**: Automatic version replacement during build process
- **Version Consistency Tools**: 
  - `npm run version:check` - Check version consistency across all files
  - `npm run version:update X.Y.Z` - Update version numbers across all files
- **Comprehensive Documentation**: Complete guide in `docs/VERSION_MANAGEMENT.md`

### Repeat Scrobble Fix
- **Allow Repeated Tracks**: Users can now scrobble the same song multiple times
- **Improved User Experience**: No more blocking of legitimate repeat plays
- **Smart Duplicate Prevention**: Maintains protection against accidental duplicates while allowing intentional repeats

---

## 🔧 Technical Improvements

### Version Management
- **Rollup Integration**: Version placeholders automatically replaced during build
- **Script Automation**: Automated tools for version updates and consistency checks
- **Documentation**: Comprehensive version management documentation
- **Future-Proof**: Easy version updates for future releases

### Code Quality
- **Clean Imports**: Removed unused imports (`Track`, `isSameTrack`)
- **TypeScript Warnings**: Eliminated all TypeScript warnings
- **Build Optimization**: Cleaner, more efficient build process
- **Code Organization**: Better separation of concerns

---

## 🐛 Bug Fixes

### Scrobbling Issues
- **Fixed**: Repeated tracks were being blocked from scrobbling
- **Fixed**: Overly restrictive duplicate track prevention
- **Improved**: Better handling of legitimate repeat plays

### Development Experience
- **Fixed**: Version inconsistencies across multiple files
- **Fixed**: Manual version update process
- **Improved**: Automated version management workflow

---

## 📁 Files Changed

### New Files
- `docs/VERSION_MANAGEMENT.md` - Comprehensive version management guide
- `scripts/update-version.js` - Version update automation script
- `scripts/version-info.js` - Version consistency check script
- `RELEASE_NOTES_v0.4.0.md` - This release notes file

### Modified Files
- `package.json` - Added version management scripts
- `rollup.config.js` - Integrated version injection
- `src/manifest.json` - Updated to version 0.4.0
- `src/shared/constants.ts` - Updated EXTENSION_VERSION
- `src/content/youtube-music.ts` - Repeat scrobble fix + cleanup
- `README.md` - Added version management documentation
- `src/popup/popup.html` - Updated version display
- `src/options/options.html` - Updated version display
- `src/popup/popup.ts` - Updated debug info version

---

## 🛠️ Developer Experience

### New Commands
```bash
# Check version consistency
npm run version:check

# Update version numbers
npm run version:update 0.4.1

# Build with automatic version injection
npm run build

# Package extension
npm run package
```

### Version Update Workflow
1. Run `npm run version:update X.Y.Z`
2. Review changes with `git diff`
3. Commit: `git commit -m "Bump version to X.Y.Z"`
4. Tag: `git tag vX.Y.Z`
5. Build: `npm run build`

---

## 🔄 Migration Notes

### For Users
- **No Action Required**: This is a seamless update
- **Improved Functionality**: Repeat scrobbling now works correctly
- **Better Performance**: Cleaner code and optimized build

### For Developers
- **Version Management**: Use new scripts for version updates
- **Build Process**: Version injection happens automatically
- **Documentation**: Refer to `docs/VERSION_MANAGEMENT.md` for details

---

## 🎯 What's Next

### Planned Features
- Enhanced debugging tools
- Improved track detection accuracy
- Better error handling and recovery
- Performance optimizations

### Version Management
- Automated version bumping (patch, minor, major)
- CI/CD integration for version updates
- Automated changelog generation
- Release automation with GitHub Actions

---

## 📊 Statistics

- **Files Changed**: 11 files
- **Lines Added**: 466 lines
- **Lines Removed**: 44 lines
- **New Features**: 2 major features
- **Bug Fixes**: 3 fixes
- **Documentation**: Comprehensive version management guide

---

## 🙏 Acknowledgments

- **Feature Contributors**: Google Labs Jules for the repeat scrobble fix
- **Version Management**: Implemented centralized version management system
- **Community**: Thanks to all users for feedback and testing

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/memming/Madrak/issues)
- **Documentation**: [README.md](README.md)
- **Version Management**: [docs/VERSION_MANAGEMENT.md](docs/VERSION_MANAGEMENT.md)

---

**Download Madrak v0.4.0**: [madrak-0.4.0.zip](web-ext-artifacts/madrak-0.4.0.zip)