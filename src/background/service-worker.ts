/**
 * Background service worker for Last.fm Scrobbler
 */

import { Message, Track, ExtensionSettings, YouTubeMusicTrack } from '../shared/types';
import { MESSAGE_TYPES } from '../shared/constants';
import { getSettings, log, debug, info, showNotification } from '../shared/utils';
import { initializeLogger, logSystemInfo } from '../shared/logger';
import { AuthManager } from '../api/auth';
import { Scrobbler } from '../api/scrobbler';

class BackgroundService {
  private authManager: AuthManager;
  private scrobbler: Scrobbler | null = null;
  private settings: ExtensionSettings | null = null;
  private authTabId: number | undefined;
  private authSendResponse: ((response?: any) => void) | undefined;
  private storedToken: string | undefined;
  private currentTrack: Track | null = null;
  private youtubeTrack: YouTubeMusicTrack | null = null;
  private activeTabId: number | null = null;
  // Removed unused isInitialized property

  constructor() {
    // Initialize with placeholder values - will be updated from settings
    // TODO: Replace with your actual Last.fm API credentials
    // Get them from: https://www.last.fm/api/account/create
    this.authManager = new AuthManager(
      'a3720627f403249db395d43df61594df', 
      'b683267386a4cf8747d6a557da8b305c'
    );
    this.initialize();
  }

  /**
   * Initialize the background service
   */
  private async initialize(): Promise<void> {
    try {
      info('Initializing background service');
      
      // Load settings
      this.settings = await getSettings();
      
      // Initialize logger with settings
      if (this.settings) {
        initializeLogger(this.settings);
      } else {
        // Use default settings if none loaded
        initializeLogger({
          isEnabled: true,
          minTrackLength: 30,
          autoScrobble: true,
          showNotifications: true,
          scrobbleThreshold: 50,
          debugMode: false,
          logLevel: 'info'
        });
      }
      
      // Log system info for debugging
      logSystemInfo();
      
      debug('Background service initialization started', {
        settings: {
          isEnabled: this.settings.isEnabled,
          debugMode: this.settings.debugMode,
          logLevel: this.settings.logLevel,
          minTrackLength: this.settings.minTrackLength,
          scrobbleThreshold: this.settings.scrobbleThreshold
        }
      });
      
      // Initialize authentication
      await this.authManager.initialize();
      
      // Initialize scrobbler
      if (this.authManager.isAuthenticated()) {
        this.scrobbler = new Scrobbler(this.authManager.getApi(), this.settings);
        await this.scrobbler.initialize();
        debug('Scrobbler initialized with authenticated API');
      } else {
        debug('User not authenticated, scrobbler not initialized');
      }
      
      info('Background service initialized successfully');
    } catch (err) {
      log('error', 'Failed to initialize background service', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      });
    }
  }

  /**
   * Handle messages from content scripts and popup
   */
  private handleMessage(message: Message, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void): boolean {
    log('info', 'Received message:', message.type);

    switch (message.type) {
      case 'PING':
        // Respond to ping to keep service worker active
        sendResponse({ success: true, pong: true });
        return false; // Response sent synchronously
      case MESSAGE_TYPES.TRACK_DETECTED:
        this.handleTrackDetected(message.data, sender);
        break;
      case MESSAGE_TYPES.TRACK_ENDED:
        this.handleTrackEnded(message.data);
        break;
      case MESSAGE_TYPES.AUTH_SUCCESS:
        this.handleAuthSuccess(message.data);
        break;
      case MESSAGE_TYPES.AUTH_ERROR:
        this.handleAuthError(message.data);
        break;
      case MESSAGE_TYPES.SETTINGS_UPDATE:
        this.handleSettingsUpdate(message.data);
        break;
      case MESSAGE_TYPES.START_AUTH:
        this.handleStartAuth(sendResponse);
        return true; // Response will be sent asynchronously
      case MESSAGE_TYPES.COMPLETE_AUTH:
        this.handleCompleteAuth(message.data, sendResponse);
        return true; // Response will be sent asynchronously
      case MESSAGE_TYPES.LOGOUT:
        this.handleLogout();
        break;
      case MESSAGE_TYPES.GET_QUEUE_STATS:
        this.handleGetQueueStats(sendResponse);
        return true; // Response will be sent asynchronously
      case MESSAGE_TYPES.GET_DEBUG_INFO:
        this.handleGetDebugInfo(sendResponse);
        return true; // Response will be sent asynchronously
      case MESSAGE_TYPES.GET_CURRENT_TRACK:
        this.handleGetCurrentTrack(sendResponse);
        return true; // Response will be sent asynchronously
      case MESSAGE_TYPES.EXPORT_LOGS:
        this.handleExportLogs(sendResponse);
        return true; // Response will be sent asynchronously
      case MESSAGE_TYPES.CLEAR_ALL_DATA:
        this.handleClearAllData();
        break;
      default:
        log('warn', 'Unknown message type:', message.type);
    }

    // Send response for synchronous messages
    sendResponse({ success: true });
    return false; // Response sent synchronously
  }

  /**
   * Handle track detected message
   */
  private async handleTrackDetected(data: any, sender: chrome.runtime.MessageSender): Promise<void> {
    try {
      this.currentTrack = data.track;
      this.youtubeTrack = data.youtubeTrack;
      this.activeTabId = sender.tab?.id ?? null;

      if (!this.scrobbler || !this.settings?.isEnabled) {
        return;
      }

      const track: Track = data.track;
      const isNowPlaying = data.isNowPlaying || false;

      if (isNowPlaying) {
        // Update now playing status
        await this.scrobbler.updateNowPlaying(track);
      }

      log('info', `Track detected: ${track.artist} - ${track.title}`);
    } catch (error) {
      log('error', 'Failed to handle track detected:', error);
    }
  }

  /**
   * Handle track ended message
   */
  private async handleTrackEnded(_data: any): Promise<void> {
    try {
      this.currentTrack = null;
      this.youtubeTrack = null;
      this.activeTabId = null;

      if (!this.scrobbler || !this.settings?.isEnabled) {
        return;
      }

      const track: Track = _data.track;
      const playDuration = _data.playDuration || 0;

      // Check if track should be scrobbled
      if (this.scrobbler.shouldScrobble(track, playDuration)) {
        await this.scrobbler.queueScrobble(track);
        
        // Show notification if enabled
        if (this.settings?.showNotifications) {
          showNotification(
            'Track Scrobbled',
            `${track.artist} - ${track.title}`,
            'basic'
          );
        }
      }

      log('info', `Track ended: ${track.artist} - ${track.title}`);
    } catch (error) {
      log('error', 'Failed to handle track ended:', error);
    }
  }

  /**
   * Handle authentication success
   */
  private async handleAuthSuccess(_data: any): Promise<void> {
    try {
      log('info', 'Authentication successful');
      
      // Reinitialize scrobbler with authenticated API
      if (this.settings) {
        this.scrobbler = new Scrobbler(this.authManager.getApi(), this.settings);
        await this.scrobbler.initialize();
      } else {
        // Use default settings if none loaded
        const defaultSettings = {
          isEnabled: true,
          minTrackLength: 30,
          autoScrobble: true,
          showNotifications: true,
          scrobbleThreshold: 50,
          debugMode: false,
          logLevel: 'info' as const
        };
        this.scrobbler = new Scrobbler(this.authManager.getApi(), defaultSettings);
        await this.scrobbler.initialize();
      }

      // Show notification
      showNotification(
        'Connected to Last.fm',
        'You are now connected to your Last.fm account',
        'basic'
      );
    } catch (error) {
      log('error', 'Failed to handle auth success:', error);
    }
  }

  /**
   * Handle authentication error
   */
  private handleAuthError(data: any): void {
    log('error', 'Authentication failed:', data.error);
    
    showNotification(
      'Authentication Failed',
      'Failed to connect to Last.fm. Please try again.',
      'basic'
    );
  }

  /**
   * Handle settings update
   */
  private async handleSettingsUpdate(data: any): Promise<void> {
    try {
      this.settings = data.settings;
      
      // Re-initialize logger with new settings
      if (this.settings) {
        initializeLogger(this.settings);
        debug('Logger re-initialized with new settings', {
          debugMode: this.settings.debugMode,
          logLevel: this.settings.logLevel
        });
      }
      
      if (this.scrobbler && this.settings) {
        this.scrobbler.updateSettings(this.settings);
      }

      log('info', 'Settings updated');
    } catch (error) {
      log('error', 'Failed to handle settings update:', error);
    }
  }

  /**
   * Handle extension installation
   */
  private handleInstalled(details: chrome.runtime.InstalledDetails): void {
    log('info', 'Extension installed/updated:', details.reason);
    
    if (details.reason === 'install') {
      // Open options page on first install
      chrome.runtime.openOptionsPage();
    }
  }

  /**
   * Handle tab updates
   */
  private handleTabUpdated(tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab): void {
    if (tabId === this.activeTabId && changeInfo.status === 'loading') {
      if (!tab.url?.includes('music.youtube.com')) {
        log('info', 'YouTube Music tab navigated away, clearing current track');
        this.currentTrack = null;
        this.youtubeTrack = null;
        this.activeTabId = null;
      }
    }
    if (changeInfo.status === 'complete' && tab.url?.includes('music.youtube.com')) {
      log('info', 'YouTube Music tab loaded');
    }
  }

  /**
   * Handle tab removal
   */
  private handleTabRemoved(tabId: number): void {
    if (tabId === this.activeTabId) {
      log('info', 'YouTube Music tab closed, clearing current track');
      this.currentTrack = null;
      this.youtubeTrack = null;
      this.activeTabId = null;
    }
  }

  /**
   * Handle tab activation
   */
  private handleTabActivated(activeInfo: chrome.tabs.TabActiveInfo): void {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
      if (tab.url?.includes('music.youtube.com')) {
        log('info', 'YouTube Music tab activated');
      }
    });
  }

  /**
   * Handle storage changes
   */
  private handleStorageChanged(_changes: { [key: string]: chrome.storage.StorageChange }, areaName: string): void {
    if (areaName === 'sync') {
      // Settings changed, reload them
      this.initialize();
    }
  }


  /**
   * Handle start authentication request - get token and open Last.fm auth page
   */
  private async handleStartAuth(sendResponse: (response?: any) => void): Promise<void> {
    try {
      console.log('[Madrak] Background: Starting Last.fm authentication flow');
      log('info', 'Starting Last.fm authentication flow');
      
      // Get token from Last.fm API
      console.log('[Madrak] Background: Getting token from Last.fm API');
      log('info', 'Getting token from Last.fm API');
      const token = await this.authManager.getApi().getToken();
      
      console.log('[Madrak] Background: Received token, generating auth URL');
      log('info', 'Received token from Last.fm API', { 
        tokenLength: token.length,
        tokenPreview: token.substring(0, 10) + '...'
      });
      
      // Generate auth URL with token
      const authUrl = this.authManager.getApi().getAuthUrl(token);
      console.log('[Madrak] Background: Generated auth URL:', authUrl);
      log('info', 'Generated authentication URL with token', { authUrl });
      
      // Store token for later use
      this.storedToken = token;
      
      // Open Last.fm authentication page in a new tab
      chrome.tabs.create({ url: authUrl }, (tab) => {
        if (chrome.runtime.lastError) {
          console.error('[Madrak] Background: Failed to open auth tab:', chrome.runtime.lastError);
          log('error', 'Failed to open authentication tab', { error: chrome.runtime.lastError });
          sendResponse({ success: false, error: 'Failed to open authentication tab' });
          return;
        }
        
        console.log('[Madrak] Background: Opened authentication tab:', tab?.id);
        log('info', 'Opened authentication tab', { tabId: tab?.id });
        
        // Store the tab ID and sendResponse for callback handling
        this.authTabId = tab?.id;
        this.authSendResponse = sendResponse;
        
        // Send immediate response that tab was opened
        sendResponse({ success: true, message: 'Authentication tab opened' });
      });
      
    } catch (error) {
      console.error('[Madrak] Background: Failed to start authentication:', error);
      log('error', 'Failed to start authentication', { error });
      sendResponse({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to start authentication' 
      });
    }
  }

  /**
   * Handle Last.fm authentication callback - user has authorized the app
   */
  private async handleAuthCallback(tabId: number): Promise<void> {
    try {
      console.log('[Madrak] Background: Handling Last.fm authentication callback');
      log('info', 'Handling Last.fm authentication callback', { 
        hasStoredToken: !!this.storedToken,
        tabId
      });
      
      if (!this.storedToken) {
        throw new Error('No stored token found for authentication');
      }
      
      // Complete authentication using stored token
      const session = await this.authManager.completeAuth(this.storedToken);
      
      console.log('[Madrak] Background: Authentication completed successfully');
      log('info', 'Authentication completed successfully', { 
        username: session.name,
        sessionKey: session.key ? '[PRESENT]' : '[MISSING]'
      });
      
      // Initialize scrobbler with new session
      if (this.settings) {
        this.scrobbler = new Scrobbler(this.authManager.getApi(), this.settings);
        await this.scrobbler.initialize();
        console.log('[Madrak] Background: Scrobbler initialized successfully');
        log('info', 'Scrobbler initialized with authenticated session');
      }
      
      // Close the authentication tab
      if (tabId) {
        chrome.tabs.remove(tabId);
        console.log('[Madrak] Background: Closed authentication tab');
      }
      
      // Send success response if we have a pending response
      if (this.authSendResponse) {
        this.authSendResponse({ success: true, session });
        this.authSendResponse = undefined;
      }
      
      // Clear auth state
      this.authTabId = undefined;
      this.storedToken = undefined;
      
    } catch (error) {
      console.error('[Madrak] Background: Failed to handle auth callback:', error);
      log('error', 'Failed to handle authentication callback', { error });
      
      // Send error response if we have a pending response
      if (this.authSendResponse) {
        this.authSendResponse({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to complete authentication' 
        });
        this.authSendResponse = undefined;
      }
      
      // Clear auth state
      this.authTabId = undefined;
      this.storedToken = undefined;
    }
  }

  /**
   * Handle complete authentication request
   */
  private async handleCompleteAuth(data: any, sendResponse: (response?: any) => void): Promise<void> {
    try {
      console.log('[Madrak] Background: Starting authentication completion process');
      log('info', 'Starting authentication completion process', { 
        hasData: !!data,
        dataKeys: data ? Object.keys(data) : []
      });
      
      const token = data?.token;
      console.log('[Madrak] Background: Token received:', token ? `${token.substring(0, 10)}...` : 'EMPTY');
      
      if (!token) {
        console.error('[Madrak] Background: No token provided for authentication');
        log('error', 'No token provided for authentication');
        sendResponse({ success: false, error: 'No token provided' });
        return;
      }
      
      if (typeof token !== 'string' || token.trim().length === 0) {
        console.error('[Madrak] Background: Invalid token format:', typeof token, token.length);
        log('error', 'Invalid token format', { tokenType: typeof token, tokenLength: token.length });
        sendResponse({ success: false, error: 'Invalid token format' });
        return;
      }
      
      console.log('[Madrak] Background: Token validation passed, calling authManager.completeAuth');
      log('info', 'Token validation passed, proceeding with authentication', {
        tokenLength: token.length,
        tokenPreview: token.substring(0, 10) + '...'
      });
      
      // Complete authentication using the token
      const session = await this.authManager.completeAuth(token.trim());
      
      console.log('[Madrak] Background: Authentication completed successfully');
      log('info', 'Authentication completed successfully', { 
        username: session.name,
        sessionKey: session.key ? '[PRESENT]' : '[MISSING]',
        sessionName: session.name || 'UNKNOWN'
      });
      
      // Initialize scrobbler with new session
      console.log('[Madrak] Background: Initializing scrobbler with new session');
      if (this.settings) {
        this.scrobbler = new Scrobbler(this.authManager.getApi(), this.settings);
        await this.scrobbler.initialize();
        console.log('[Madrak] Background: Scrobbler initialized successfully');
        log('info', 'Scrobbler initialized with authenticated session');
      } else {
        console.warn('[Madrak] Background: No settings available for scrobbler initialization');
        log('warn', 'No settings available for scrobbler initialization');
      }
      
      console.log('[Madrak] Background: Sending success response to popup');
      sendResponse({ success: true, session });
      
    } catch (error) {
      console.error('[Madrak] Background: Failed to complete authentication:', error);
      log('error', 'Failed to complete authentication', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      sendResponse({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to complete authentication' 
      });
    }
  }

  /**
   * Handle logout request
   */
  private async handleLogout(): Promise<void> {
    try {
      log('info', 'Logging out user');
      
      await this.authManager.logout();
      this.scrobbler = null;
      
      log('info', 'User logged out successfully');
    } catch (error) {
      log('error', 'Failed to logout:', error);
    }
  }

  /**
   * Handle get current track request from popup
   */
  private handleGetCurrentTrack(sendResponse: (response?: any) => void): void {
    try {
      if (this.currentTrack && this.youtubeTrack) {
        sendResponse({
          success: true,
          track: this.currentTrack,
          isPlaying: this.youtubeTrack.isPlaying,
          currentTime: this.youtubeTrack.currentTime,
          thumbnail: this.youtubeTrack.thumbnail,
        });
      } else {
        sendResponse({ success: true, track: null, isPlaying: false });
      }
    } catch (error) {
      log('error', 'Failed to get current track:', error);
      sendResponse({ success: false, error: 'Failed to get current track' });
    }
  }


  /**
   * Handle get queue stats request
   */
  private async handleGetQueueStats(sendResponse: (response?: any) => void): Promise<void> {
    try {
      if (this.scrobbler) {
        const stats = await this.scrobbler.getQueueStats();
        sendResponse({ success: true, stats });
      } else {
        sendResponse({ success: true, stats: { total: 0, pending: 0, failed: 0 } });
      }
    } catch (error) {
      log('error', 'Failed to get queue stats:', error);
      sendResponse({ success: false, error: 'Failed to get queue stats' });
    }
  }

  /**
   * Handle get debug info request
   */
  private async handleGetDebugInfo(sendResponse: (response?: any) => void): Promise<void> {
    try {
      const { getDebugInfo } = await import('../shared/logger');
      const debugInfo = getDebugInfo();
      sendResponse({ success: true, debugInfo });
    } catch (error) {
      log('error', 'Failed to get debug info:', error);
      sendResponse({ success: false, error: 'Failed to get debug info' });
    }
  }

  /**
   * Handle export logs request
   */
  private async handleExportLogs(sendResponse: (response?: any) => void): Promise<void> {
    try {
      const { exportDebugLogs } = await import('../shared/logger');
      const logs = exportDebugLogs();
      sendResponse({ success: true, logs });
    } catch (error) {
      log('error', 'Failed to export logs:', error);
      sendResponse({ success: false, error: 'Failed to export logs' });
    }
  }

  /**
   * Handle clear all data request
   */
  private async handleClearAllData(): Promise<void> {
    try {
      log('info', 'Clearing all extension data');
      
      // Clear storage
      await chrome.storage.sync.clear();
      await chrome.storage.local.clear();
      
      // Reset state
      this.scrobbler = null;
      this.settings = null;
      
      // Reinitialize
      await this.initialize();
      
      log('info', 'All data cleared successfully');
    } catch (error) {
      log('error', 'Failed to clear all data:', error);
    }
  }

  /**
   * Cleanup on extension shutdown
   */
  private cleanup(): void {
    log('info', 'Background service cleaning up');
  }
}

// Initialize the background service
const backgroundService = new BackgroundService();

// Set up event listeners
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  return backgroundService['handleMessage'](message, sender, sendResponse);
});

chrome.runtime.onInstalled.addListener((details) => {
  backgroundService['handleInstalled'](details);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  backgroundService['handleTabUpdated'](tabId, changeInfo, tab);
  
  // Check for Last.fm authentication callback - user has completed authorization
  if (changeInfo.status === 'complete' && tab.url && tabId === backgroundService['authTabId']) {
    // Check if user is on Last.fm domain and has completed authorization
    if (tab.url.includes('last.fm') || tab.url.includes('lastfm.com')) {
      // Only handle callback if we have a stored token (active auth flow)
      if (backgroundService['storedToken']) {
        // Wait a bit to ensure the authorization process is complete
        setTimeout(() => {
          console.log('[Madrak] Background: Detected user on Last.fm after authorization');
          backgroundService['handleAuthCallback'](tabId);
        }, 2000); // Wait 2 seconds for authorization to complete
      } else {
        console.log('[Madrak] Background: User on Last.fm but no active auth flow - ignoring');
      }
    }
  }
});

// Note: Authentication callback handling removed - now using manual token entry

chrome.tabs.onActivated.addListener((activeInfo) => {
  backgroundService['handleTabActivated'](activeInfo);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  backgroundService['handleStorageChanged'](changes, areaName);
});


chrome.tabs.onRemoved.addListener((tabId) => {
  backgroundService['handleTabRemoved'](tabId);
});

chrome.runtime.onSuspend.addListener(() => {
  backgroundService['cleanup']();
});
