# Madrak Extension Setup

## Getting Last.fm API Credentials

To use this extension, you need to get API credentials from Last.fm:

1. **Go to Last.fm API**: Visit https://www.last.fm/api/account/create
2. **Sign in** with your Last.fm account
3. **Create an application**:
   - Application name: `Madrak` (or any name you prefer)
   - Application description: `Chrome extension for scrobbling YouTube Music`
   - Homepage URL: `https://github.com/yourusername/lastfm-youtube-music-extension`
4. **Copy your credentials**:
   - API Key
   - Shared Secret

## Configuring the Extension

1. **Open the extension source code** in your editor
2. **Edit** `src/background/service-worker.ts`
3. **Replace the placeholder credentials** on lines 22-25:
   ```typescript
   this.authManager = new AuthManager(
     'your_actual_api_key_here', 
     'your_actual_shared_secret_here'
   );
   ```
4. **Rebuild the extension**:
   ```bash
   npm run build
   ```
5. **Reload the extension** in Chrome

## Testing the Extension

1. **Load the extension** in Chrome (`chrome://extensions/`)
2. **Click the extension icon** in the toolbar
3. **Click "Connect to Last.fm"** - it should open a new tab
4. **Authorize the application** on Last.fm
5. **Return to the extension** - it should show your Last.fm username

## Troubleshooting

- **Check the browser console** for any error messages
- **Enable debug mode** in the extension options for detailed logging
- **Check the extension's debug panel** for system information

## Security Note

Never commit your actual API credentials to version control. The placeholder values are safe to commit, but replace them with your real credentials only in your local development environment.
