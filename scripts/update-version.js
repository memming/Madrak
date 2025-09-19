#!/usr/bin/env node

/**
 * Version Update Script
 * Updates version numbers across all files in the project
 * Usage: node scripts/update-version.js [new-version]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json to get current version
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Get new version from command line argument or prompt for input
const newVersion = process.argv[2];

if (!newVersion) {
  console.log(`Current version: ${packageJson.version}`);
  console.log('Usage: node scripts/update-version.js [new-version]');
  console.log('Example: node scripts/update-version.js 0.3.3');
  process.exit(1);
}

// Validate version format (semantic versioning)
const versionRegex = /^\d+\.\d+\.\d+$/;
if (!versionRegex.test(newVersion)) {
  console.error('Error: Version must be in format X.Y.Z (e.g., 0.3.3)');
  process.exit(1);
}

console.log(`Updating version from ${packageJson.version} to ${newVersion}...`);

// Files to update with their specific patterns
const filesToUpdate = [
  {
    path: 'package.json',
    patterns: [
      { search: /"version":\s*"[^"]*"/, replace: `"version": "${newVersion}"` }
    ]
  },
  {
    path: 'src/manifest.json',
    patterns: [
      { search: /"version":\s*"[^"]*"/, replace: `"version": "${newVersion}"` }
    ]
  },
  {
    path: 'src/shared/constants.ts',
    patterns: [
      { search: /export const EXTENSION_VERSION = '[^']*';/, replace: `export const EXTENSION_VERSION = '${newVersion}';` }
    ]
  },
  {
    path: 'README.md',
    patterns: [
      { search: /\*\*Version\*\*:\s*\d+\.\d+\.\d+/, replace: `**Version**: ${newVersion}` }
    ]
  },
  {
    path: 'src/popup/popup.html',
    patterns: [
      { search: /<div class="version">v\d+\.\d+\.\d+<\/div>/, replace: `<div class="version">v${newVersion}</div>` }
    ]
  },
  {
    path: 'src/options/options.html',
    patterns: [
      { search: /<div class="version">v\d+\.\d+\.\d+<\/div>/, replace: `<div class="version">v${newVersion}</div>` }
    ]
  }
];

// Update each file
let updatedFiles = 0;
filesToUpdate.forEach(fileInfo => {
  const filePath = path.join(__dirname, '..', fileInfo.path);
  
  if (!fs.existsSync(filePath)) {
    console.warn(`Warning: File ${fileInfo.path} not found, skipping...`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let fileUpdated = false;
  
  fileInfo.patterns.forEach(pattern => {
    const newContent = content.replace(pattern.search, pattern.replace);
    if (newContent !== content) {
      content = newContent;
      fileUpdated = true;
    }
  });
  
  if (fileUpdated) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Updated ${fileInfo.path}`);
    updatedFiles++;
  } else {
    console.log(`- No changes needed in ${fileInfo.path}`);
  }
});

// Update package.json version
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

console.log(`\n✅ Version update complete!`);
console.log(`📁 Updated ${updatedFiles + 1} files`);
console.log(`🔄 New version: ${newVersion}`);
console.log(`\nNext steps:`);
console.log(`1. Review the changes: git diff`);
console.log(`2. Commit the changes: git add . && git commit -m "Bump version to ${newVersion}"`);
console.log(`3. Create a tag: git tag v${newVersion}`);
console.log(`4. Build the extension: npm run build`);