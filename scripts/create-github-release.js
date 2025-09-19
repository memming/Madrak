#!/usr/bin/env node

/**
 * GitHub Release Creation Helper
 * Provides instructions for creating a GitHub release manually
 * Usage: node scripts/create-github-release.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json to get current version
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

// Read release notes
const releaseNotesPath = path.join(__dirname, '..', `RELEASE_NOTES_v${version}.md`);
const releaseNotes = fs.readFileSync(releaseNotesPath, 'utf8');

// Check if zip file exists
const zipPath = path.join(__dirname, '..', 'web-ext-artifacts', `madrak-${version}.zip`);
const zipExists = fs.existsSync(zipPath);

console.log('🚀 GitHub Release Creation Instructions');
console.log('=====================================\n');

console.log(`📦 Release Version: v${version}`);
console.log(`📁 Repository: ${packageJson.repository?.url || 'https://github.com/memming/Madrak'}`);
console.log(`📄 Release Notes: RELEASE_NOTES_v${version}.md`);
console.log(`📦 Package File: ${zipExists ? '✅ Found' : '❌ Not found'} madrak-${version}.zip\n`);

console.log('📋 Manual Release Creation Steps:');
console.log('1. Go to GitHub repository: https://github.com/memming/Madrak');
console.log('2. Click "Releases" in the right sidebar');
console.log('3. Click "Create a new release"');
console.log('4. Fill in the following details:\n');

console.log('🏷️  Tag version:');
console.log(`   v${version}\n`);

console.log('📝 Release title:');
console.log(`   Madrak v${version} - Centralized Version Management & Repeat Scrobble Fix\n`);

console.log('📄 Description:');
console.log('```');
console.log(releaseNotes);
console.log('```\n');

if (zipExists) {
  console.log('📦 Attach file:');
  console.log(`   ${zipPath}`);
  console.log('   (Upload as: madrak-0.4.0.zip)\n');
} else {
  console.log('⚠️  Package file not found. Run "npm run package" first.\n');
}

console.log('✅ Additional options:');
console.log('   ☑️ Set as the latest release');
console.log('   ☑️ Create a discussion for this release (optional)');
console.log('   ☑️ Generate release notes (optional - we have custom notes)\n');

console.log('🎯 After creating the release:');
console.log('   - Verify the release is accessible');
console.log('   - Test the download link');
console.log('   - Share the release with users');
console.log('   - Update any documentation that references the version\n');

console.log('🔗 Quick Links:');
console.log(`   - Repository: https://github.com/memming/Madrak`);
console.log(`   - Releases: https://github.com/memming/Madrak/releases`);
console.log(`   - Create Release: https://github.com/memming/Madrak/releases/new`);
console.log(`   - Tag: v${version}`);