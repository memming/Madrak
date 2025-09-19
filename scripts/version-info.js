#!/usr/bin/env node

/**
 * Version Info Script
 * Shows current version information across all files
 * Usage: node scripts/version-info.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json to get current version
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

console.log('🔍 Version Information Report');
console.log('============================\n');

// Files to check
const filesToCheck = [
  {
    path: 'package.json',
    pattern: /"version":\s*"([^"]*)"/,
    description: 'Package version (source of truth)'
  },
  {
    path: 'src/manifest.json',
    pattern: /"version":\s*"([^"]*)"/,
    description: 'Chrome extension manifest'
  },
  {
    path: 'src/shared/constants.ts',
    pattern: /export const EXTENSION_VERSION = '([^']*)';/,
    description: 'Extension constants'
  },
  {
    path: 'README.md',
    pattern: /\*\*Version\*\*:\s*(\d+\.\d+\.\d+)/,
    description: 'README documentation'
  },
  {
    path: 'src/popup/popup.html',
    pattern: /<div class="version">v(\d+\.\d+\.\d+)<\/div>/,
    description: 'Popup UI version display'
  },
  {
    path: 'src/options/options.html',
    pattern: /<div class="version">v(\d+\.\d+\.\d+)<\/div>/,
    description: 'Options UI version display'
  },
  {
    path: 'src/popup/popup.ts',
    pattern: /<span class="info-value">(\d+\.\d+\.\d+)<\/span>/,
    description: 'Popup debug info version'
  }
];

const sourceVersion = packageJson.version;
let inconsistentFiles = [];

console.log(`📦 Source Version (package.json): ${sourceVersion}\n`);

filesToCheck.forEach(fileInfo => {
  const filePath = path.join(__dirname, '..', fileInfo.path);
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ ${fileInfo.description}: File not found`);
    return;
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(fileInfo.pattern);
  
  if (match) {
    const version = match[1];
    const status = version === sourceVersion ? '✅' : '⚠️';
    console.log(`${status} ${fileInfo.description}: ${version}`);
    
    if (version !== sourceVersion) {
      inconsistentFiles.push({
        file: fileInfo.path,
        version: version,
        expected: sourceVersion
      });
    }
  } else {
    console.log(`❌ ${fileInfo.description}: Version not found`);
  }
});

console.log('\n📊 Summary');
console.log('==========');

if (inconsistentFiles.length === 0) {
  console.log('✅ All version numbers are consistent!');
} else {
  console.log(`⚠️  Found ${inconsistentFiles.length} inconsistent version(s):`);
  inconsistentFiles.forEach(file => {
    console.log(`   ${file.file}: ${file.version} (expected: ${file.expected})`);
  });
  console.log('\n💡 To fix inconsistencies, run:');
  console.log(`   node scripts/update-version.js ${sourceVersion}`);
}

console.log('\n🛠️  Available commands:');
console.log('   node scripts/version-info.js          - Show this report');
console.log('   node scripts/update-version.js X.Y.Z  - Update all versions');