# Madrak Extension - Development Agent Guidelines

## Project Overview
This project develops Madrak, a Chrome browser extension that interfaces with the Last.fm API to scrobble music from YouTube Music. The extension will automatically detect music playing on YouTube Music and submit scrobbles to Last.fm. Named after the mystical character from Roger Zelazny's novels.

## Development Rules & Guidelines

### 1. Code Quality Standards
- **TypeScript First**: All code should be written in TypeScript for better type safety and maintainability
- **Modern ES6+**: Use modern JavaScript/TypeScript features (async/await, arrow functions, destructuring, etc.)
- **Clean Architecture**: Follow separation of concerns with clear module boundaries
- **Error Handling**: Implement comprehensive error handling with user-friendly messages
- **Logging**: Use structured logging for debugging and monitoring

### 2. Chrome Extension Best Practices
- **Manifest V3**: Use the latest Chrome extension manifest version
- **Content Scripts**: Minimize content script injection and use message passing for communication
- **Background Service Worker**: Use service workers for background tasks and API calls
- **Permissions**: Request only necessary permissions and explain their usage
- **Security**: Validate all user inputs and sanitize data before processing

### 3. Last.fm API Integration
- **Authentication**: Implement secure OAuth flow for Last.fm authentication
- **Rate Limiting**: Respect Last.fm API rate limits and implement proper queuing
- **Error Handling**: Handle API errors gracefully with retry mechanisms
- **Data Validation**: Validate all scrobble data before submission
- **Caching**: Implement intelligent caching for better performance

### 4. YouTube Music Integration
- **DOM Monitoring**: Use MutationObserver to detect music changes
- **Data Extraction**: Safely extract track information from YouTube Music's DOM
- **State Management**: Track playing state and prevent duplicate scrobbles
- **Performance**: Minimize impact on YouTube Music's performance

### 5. User Experience
- **Non-Intrusive**: The extension should work silently in the background
- **Visual Feedback**: Provide clear status indicators and notifications
- **Settings**: Allow users to configure scrobbling preferences
- **Privacy**: Respect user privacy and data protection

### 6. Development Workflow
- **Version Control**: Use semantic versioning and clear commit messages
- **Version Management**: Use centralized version management tools for consistency
- **Testing**: Write unit tests for core functionality
- **Documentation**: Keep code well-documented with JSDoc comments
- **Code Review**: All changes should be reviewed before merging

### 7. Security Considerations
- **API Keys**: Never commit API keys or sensitive data to version control
- **Content Security Policy**: Implement proper CSP for the extension
- **Data Storage**: Use Chrome's secure storage APIs for sensitive data
- **Network Security**: Use HTTPS for all API communications

### 8. Performance Requirements
- **Memory Usage**: Keep memory footprint minimal
- **CPU Usage**: Minimize CPU usage during normal operation
- **Network Efficiency**: Batch API calls when possible
- **Startup Time**: Ensure extension loads quickly

### 9. Browser Compatibility
- **Chrome**: Primary target browser (latest stable version)
- **Edge**: Secondary support for Chromium-based Edge
- **Future**: Consider Firefox compatibility if needed

### 10. File Organization
```
src/
├── background/          # Service worker scripts
├── content/            # Content scripts for YouTube Music
├── popup/              # Extension popup UI
├── options/            # Extension options page
├── shared/             # Shared utilities and types
├── api/                # Last.fm API integration
└── utils/              # General utilities
```

### 11. Error Handling Strategy
- **User-Facing Errors**: Show clear, actionable error messages
- **Developer Errors**: Log detailed error information for debugging
- **Network Errors**: Implement retry logic with exponential backoff
- **API Errors**: Handle Last.fm API errors appropriately

### 12. Testing Strategy
- **Unit Tests**: Test individual functions and modules
- **Integration Tests**: Test API integration and data flow
- **E2E Tests**: Test complete user workflows
- **Manual Testing**: Regular testing on YouTube Music

### 13. Deployment
- **Chrome Web Store**: Prepare for Chrome Web Store submission
- **Version Management**: Use centralized version management scripts for consistency
- **Release Process**: Use `npm run release` for one-command build and packaging
- **Rollback Plan**: Have a plan for quick rollbacks if issues arise

### 14. Monitoring & Analytics
- **Error Tracking**: Implement error tracking and reporting
- **Usage Analytics**: Track extension usage (with user consent)
- **Performance Monitoring**: Monitor extension performance metrics

### 15. Legal & Compliance
- **Privacy Policy**: Maintain clear privacy policy
- **Terms of Service**: Comply with Last.fm and YouTube Music ToS
- **GDPR Compliance**: Ensure data protection compliance
- **Open Source**: Consider open-sourcing non-sensitive parts

## Development Commands

### Build & Package
- `npm run build` - Build Madrak for production
- `npm run dev` - Start development mode with hot reload
- `npm run release` - Build and package extension (one command for Chrome Web Store)
- `npm run package` - Build and package extension (creates new ZIP)

### Version Management
- `npm run version:check` - Check version consistency across all files
- `npm run version:update X.Y.Z` - Update version numbers across all files

### Quality Assurance
- `npm test` - Run test suite
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking
- `npm run clean` - Clean build artifacts

## Version Management Workflow

### IMPORTANT: Always use centralized version management tools!

**Before making any version changes:**
1. Check current version consistency: `npm run version:check`
2. If inconsistent, fix with: `npm run version:update <current-version>`

**For version bumps:**
1. Use the centralized tool: `npm run version:update X.Y.Z`
2. Review changes: `git diff`
3. Commit changes: `git add . && git commit -m "Bump version to X.Y.Z"`
4. Create tag: `git tag vX.Y.Z`
5. Build and package: `npm run release`

**Files managed by version tool:**
- `package.json` - NPM package version
- `src/manifest.json` - Chrome extension version
- `src/shared/constants.ts` - EXTENSION_VERSION constant
- `README.md` - Documentation version
- `src/popup/popup.html` - UI version display
- `src/options/options.html` - Options page version display

**Never manually edit version numbers!** Always use `npm run version:update` to ensure consistency.

## Getting Started
1. Clone the Madrak repository
2. Run `npm install` to install dependencies
3. Set up environment variables for Last.fm API
4. Run `npm run dev` to start development
5. Load the extension in Chrome developer mode

## Contributing
- Follow the established code style and patterns
- Write tests for new features
- Update documentation as needed
- Submit pull requests for review
- Ensure all checks pass before merging
