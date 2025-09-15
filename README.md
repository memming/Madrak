# Madrak

A modern Chrome browser extension that automatically scrobbles music from YouTube Music to your Last.fm account. Named after the mystical character from Roger Zelazny's novel.

**Version**: 0.3.1

## Features

- 🎵 **Automatic Scrobbling**: Automatically detects and scrobbles music playing on YouTube Music
- 🔐 **Secure Authentication**: Complete OAuth-based authentication with Last.fm
- ⚡ **Real-time Detection**: Monitors YouTube Music for track changes in real-time
- 🎛️ **User Controls**: Pause/resume scrobbling, manual track correction
- 📊 **Live Statistics**: Real-time scrobble count and queue status updates
- 🔧 **Customizable Settings**: Configure scrobbling preferences and thresholds
- 🐛 **Debug Mode**: Comprehensive logging and debugging tools
- 🚀 **Modern UI**: Clean, responsive interface built with modern web technologies

## Installation

### From Chrome Web Store
*Coming soon - extension will be available on the Chrome Web Store*

### Development Installation
1. Clone this repository:
   ```bash
   git clone https://github.com/memming/Madrak.git
   cd Madrak
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist` folder

## Setup

### Last.fm API Setup
The extension comes pre-configured with Last.fm API credentials. No additional setup required!

### YouTube Music
The extension works automatically with YouTube Music. No additional setup required!

## Usage

1. **First Time Setup**:
   - Click the extension icon in your browser toolbar
   - Click "Connect to Last.fm" to authenticate
   - Grant necessary permissions

2. **Automatic Scrobbling**:
   - Play music on YouTube Music
   - The extension will automatically detect and scrobble tracks
   - View scrobbling status in the extension popup

3. **Manual Controls**:
   - Pause/resume scrobbling
   - Correct track information if needed
   - View scrobble history

## Development

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Chrome browser
- Last.fm API credentials

### Build System
This extension uses **Rollup** instead of Webpack to comply with Chrome Manifest V3's strict Content Security Policy (CSP). Rollup generates clean, eval-free JavaScript bundles that are compatible with Chrome's security requirements.

**Why Rollup?**
- ✅ **CSP Compliant**: No `eval()` usage, fully compatible with Manifest V3
- ✅ **Tree Shaking**: Better dead code elimination
- ✅ **Smaller Bundles**: More efficient output for Chrome extensions
- ✅ **ES Modules**: Native support for modern JavaScript modules

### Project Structure
```
src/
├── background/          # Service worker scripts
│   └── service-worker.ts
├── content/            # Content scripts for YouTube Music
│   └── youtube-music.ts
├── popup/              # Extension popup UI
│   ├── popup.html
│   ├── popup.ts
│   └── popup.css
├── options/            # Extension options page
│   ├── options.html
│   ├── options.ts
│   └── options.css
├── shared/             # Shared utilities and types
│   ├── types.ts
│   ├── constants.ts
│   ├── utils.ts
│   └── logger.ts
├── api/                # Last.fm API integration
│   ├── lastfm-api.ts
│   ├── scrobbler.ts
│   └── auth.ts
└── utils/              # Additional utilities
```

### Available Scripts

- `npm run dev` - Start development mode with hot reload (Rollup)
- `npm run build` - Build the extension for production (Rollup)
- `npm run build:watch` - Build in watch mode (Rollup)
- `npm test` - Run test suite
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking
- `npm run clean` - Clean build artifacts

**Note**: All build commands use Rollup for CSP-compliant output that works with Chrome Manifest V3.

### Development Workflow

1. **Start Development**:
   ```bash
   npm run dev
   ```

2. **Load Extension**:
   - Go to `chrome://extensions/`
   - Enable Developer mode
   - Click "Load unpacked" and select the `dist` folder

3. **Test on YouTube Music**:
   - Navigate to YouTube Music
   - Play some music
   - Check the extension popup for scrobbling status

4. **Make Changes**:
   - Edit source files in `src/`
   - Changes will be automatically built
   - Reload the extension in Chrome

### Building for Production

```bash
npm run build
```

The built extension will be in the `dist` folder, ready for packaging or Chrome Web Store submission.

## API Reference

### Last.fm API Integration

The extension integrates with Last.fm's API for:
- User authentication (OAuth)
- Track scrobbling
- User information retrieval
- Scrobble history

### YouTube Music Integration

The extension monitors YouTube Music's DOM for:
- Currently playing track information
- Play/pause state changes
- Track duration and progress
- Artist and album information

## Configuration

### Extension Settings
Users can configure:
- **Debug Mode**: Enable detailed logging for troubleshooting
- **Log Level**: Choose between INFO, DEBUG, WARN, ERROR levels
- **Scrobbling Thresholds**: Minimum track length for scrobbling
- **Auto-scrobbling**: Enable/disable automatic scrobbling
- **Notifications**: Show/hide scrobbling notifications
- **Track Correction**: Manual track information editing

## Troubleshooting

### Common Issues

1. **Extension not detecting music**:
   - Ensure you're on YouTube Music (music.youtube.com)
   - Check that the extension has necessary permissions
   - Try refreshing the page

2. **Scrobbles not appearing on Last.fm**:
   - Verify Last.fm authentication
   - Check internet connection
   - Ensure track meets minimum length requirements

3. **Authentication issues**:
   - Clear extension data and re-authenticate
   - Check Last.fm API credentials
   - Verify OAuth redirect URLs

### Debug Mode

Enable debug mode in the extension options to see detailed logging information. Debug logs will appear in:
- **YouTube Music Console**: Right-click → Inspect → Console
- **Extension Console**: Go to `chrome://extensions/` → Click "Inspect views: service worker"
- **Popup Debug Panel**: Open the extension popup and click "Debug" to view system information

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Privacy

This extension:
- Only accesses YouTube Music pages when you're actively using them
- Stores your Last.fm authentication data locally in your browser
- Does not collect or transmit personal data
- Only scrobbles music you explicitly play

## Support

- **Issues**: Report bugs and request features on [GitHub Issues](https://github.com/memming/Madrak/issues)
- **Discussions**: Join community discussions on [GitHub Discussions](https://github.com/memming/Madrak/discussions)
- **Repository**: [https://github.com/memming/Madrak](https://github.com/memming/Madrak)

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a list of changes and version history.

## Acknowledgments

- [Last.fm](https://www.last.fm/) for providing the API
- [YouTube Music](https://music.youtube.com/) for the music platform
- Roger Zelazny for the inspiration behind the name "Madrak"
- Chrome Extension development community
- Open source contributors

---

**Note**: This extension is not affiliated with Last.fm or YouTube Music. It's an independent project created by music lovers for music lovers. The name "Madrak" is inspired by Roger Zelazny's literary works.
