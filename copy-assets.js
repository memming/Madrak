import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

// Ensure dist directory exists
if (!existsSync('dist')) {
  mkdirSync('dist', { recursive: true });
}

// Copy manifest.json
copyFileSync('src/manifest.json', 'dist/manifest.json');

// Copy popup files
mkdirSync('dist/popup', { recursive: true });
copyFileSync('src/popup/popup.html', 'dist/popup/popup.html');
copyFileSync('src/popup/popup.css', 'dist/popup/popup.css');

// Copy options files
mkdirSync('dist/options', { recursive: true });
copyFileSync('src/options/options.html', 'dist/options/options.html');
copyFileSync('src/options/options.css', 'dist/options/options.css');

// Copy callback.html
copyFileSync('src/callback.html', 'dist/callback.html');

// Copy assets if they exist
if (existsSync('src/assets')) {
  mkdirSync('dist/assets', { recursive: true });
  const assets = ['icon-16.png', 'icon-32.png', 'icon-48.png', 'icon-128.png'];
  assets.forEach(asset => {
    const srcPath = join('src/assets', asset);
    const destPath = join('dist/assets', asset);
    if (existsSync(srcPath)) {
      copyFileSync(srcPath, destPath);
    }
  });
}

console.log('Assets copied successfully!');
