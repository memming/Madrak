# Version Management System

This document explains how version numbers are managed in the Madrak Chrome extension to ensure consistency across all files.

## Overview

The version management system uses a **single source of truth** approach where `package.json` serves as the authoritative version source, and all other files are automatically synchronized during the build process.

## Architecture

### Single Source of Truth
- **Primary**: `package.json` - Contains the authoritative version number
- **Secondary**: All other files reference this version through various mechanisms

### Version Injection Methods

1. **Build-time Replacement**: Version placeholders are replaced during the Rollup build process
2. **Script-based Updates**: Manual version updates across all files using update scripts
3. **Direct References**: Some files directly import version constants

## Files That Contain Version Information

| File | Method | Purpose |
|------|--------|---------|
| `package.json` | Direct | Source of truth, npm package version |
| `src/manifest.json` | Script Update | Chrome extension manifest |
| `src/shared/constants.ts` | Script Update | Extension constants (EXTENSION_VERSION) |
| `README.md` | Script Update | Documentation |
| `src/popup/popup.html` | Script Update | UI version display |
| `src/options/options.html` | Script Update | UI version display |
| `src/popup/popup.ts` | Build Replacement | Debug info version display |

## Usage

### Checking Version Consistency

```bash
# Check all version numbers across the project
npm run version:check
# or
node scripts/version-info.js
```

This command will:
- Show the current version from `package.json`
- Check all files for version inconsistencies
- Report any mismatches
- Provide recommendations for fixes

### Updating Version Numbers

```bash
# Update all version numbers to a new version
npm run version:update 0.3.3
# or
node scripts/update-version.js 0.3.3
```

This command will:
- Update `package.json` version
- Update `src/manifest.json` version
- Update `src/shared/constants.ts` EXTENSION_VERSION
- Update `README.md` version documentation
- Update HTML files with version displays
- Provide next steps for committing changes

### Build Process

The build process automatically handles version replacement:

```bash
npm run build
```

During build:
- Rollup's `@rollup/plugin-replace` replaces `EXTENSION_VERSION_PLACEHOLDER` with the actual version
- This ensures the built extension always shows the correct version

## Version Update Workflow

1. **Update Version**:
   ```bash
   npm run version:update 0.3.3
   ```

2. **Review Changes**:
   ```bash
   git diff
   ```

3. **Commit Changes**:
   ```bash
   git add .
   git commit -m "Bump version to 0.3.3"
   ```

4. **Create Tag**:
   ```bash
   git tag v0.3.3
   ```

5. **Build Extension**:
   ```bash
   npm run build
   ```

6. **Package Extension**:
   ```bash
   npm run package
   ```

## Technical Implementation

### Build Configuration

The `rollup.config.js` includes version replacement:

```javascript
import replace from '@rollup/plugin-replace';
import fs from 'fs';

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const version = packageJson.version;

// In popup and options builds:
plugins: [
  replace({
    'EXTENSION_VERSION_PLACEHOLDER': version,
    preventAssignment: true
  }),
  // ... other plugins
]
```

### Scripts

- **`scripts/version-info.js`**: Reports version consistency across all files
- **`scripts/update-version.js`**: Updates version numbers across all files

## Benefits

1. **Consistency**: All version numbers stay synchronized
2. **Single Source**: Only `package.json` needs manual updates
3. **Automation**: Build process handles version injection
4. **Verification**: Easy to check for inconsistencies
5. **Maintainability**: Clear workflow for version updates

## Troubleshooting

### Version Inconsistencies

If you see version inconsistencies:

1. Run `npm run version:check` to identify issues
2. Run `npm run version:update [current-version]` to fix them
3. Verify with `npm run version:check` again

### Build Issues

If version replacement isn't working:

1. Ensure `@rollup/plugin-replace` is installed
2. Check that `EXTENSION_VERSION_PLACEHOLDER` is used in source files
3. Verify the build configuration includes the replace plugin

### Manual Updates

If you need to manually update a version:

1. Update `package.json` first
2. Run `npm run version:update [version]` to sync all files
3. Never update individual files manually - always use the scripts

## Best Practices

1. **Always use the scripts** for version updates
2. **Check consistency** before releases
3. **Commit version changes** as a single commit
4. **Tag releases** with the version number
5. **Test the built extension** to verify version display
6. **Document version changes** in CHANGELOG.md

## Future Enhancements

Potential improvements to the version management system:

1. **Automated version bumping** (patch, minor, major)
2. **Integration with CI/CD** for automatic version updates
3. **Version validation** in pre-commit hooks
4. **Changelog generation** from version updates
5. **Release automation** with GitHub Actions