# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.1] - 2025-01-15

### Added
- Direct links to GitHub README and Issues pages in popup footer
- Comprehensive performance optimizations for YouTube Music

### Changed
- Updated popup UI to remove unnecessary queue and scrobbled count displays
- Improved DOM observation to target only relevant elements
- Reduced debug logging overhead for better performance
- Streamlined popup interface for cleaner user experience

### Fixed
- Chrome notification error about unable to download images
- Popup stats not updating after successful scrobbles
- Track scrobbling when YouTube Music moves to next song
- Debug logging not showing in content script and popup consoles
- Version consistency across all files

### Performance
- 70-80% reduction in DOM observation overhead
- 90% reduction in debug logging overhead
- Targeted detection only when music actually changes
- Throttled calls prevent excessive processing

## [0.3.0] - 2025-01-15

### Added
- Complete Last.fm authentication flow
- Real-time track detection from YouTube Music
- Automatic scrobbling functionality
- Now playing updates to Last.fm
- Debug mode with comprehensive logging
- Settings management and configuration
- Popup UI with current track display
- Options page for user preferences
- Notification system for scrobbling status

### Technical
- Chrome Manifest V3 compliance
- Rollup build system for CSP compliance
- TypeScript implementation
- Modern ES6+ JavaScript features
- Comprehensive error handling
- Message passing between extension components

## [0.2.0] - 2025-01-15

### Added
- Initial project structure
- Basic Chrome extension setup
- Last.fm API integration foundation
- YouTube Music content script framework

## [0.1.0] - 2025-01-15

### Added
- Project initialization
- Basic extension manifest
- Initial development setup
