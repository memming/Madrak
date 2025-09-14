/**
 * Background service worker for Last.fm Scrobbler
 */

import { Message, Track, ExtensionSettings } from '../shared/types';
import { MESSAGE_TYPES } from '../shared/constants';
import { getSettings, log, debug, info, showNotification } from '../shared/utils';
import { initializeLogger, logSystemInfo } from '../shared/logger';
import { AuthManager } from '../api/auth';
import { Scrobbler } from '../api/scrobbler';

class BackgroundService {
  private authManager: AuthManager;
  private scrobbler: Scrobbler | null = null;
  private settings: ExtensionSettings | null = null;
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
  private handleMessage(message: Message, _sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void): void {
    log('info', 'Received message:', message.type);

    switch (message.type) {
      case MESSAGE_TYPES.TRACK_DETECTED:
        this.handleTrackDetected(message.data);
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
        break;
      case MESSAGE_TYPES.LOGOUT:
        this.handleLogout();
        break;
      case MESSAGE_TYPES.GET_QUEUE_STATS:
        this.handleGetQueueStats(sendResponse);
        break;
      case MESSAGE_TYPES.GET_DEBUG_INFO:
        this.handleGetDebugInfo(sendResponse);
        break;
      case MESSAGE_TYPES.EXPORT_LOGS:
        this.handleExportLogs(sendResponse);
        break;
      case MESSAGE_TYPES.CLEAR_ALL_DATA:
        this.handleClearAllData();
        break;
      default:
        log('warn', 'Unknown message type:', message.type);
    }

    // Only send response if not already sent
    if (message.type !== MESSAGE_TYPES.START_AUTH && 
        message.type !== MESSAGE_TYPES.GET_QUEUE_STATS && 
        message.type !== MESSAGE_TYPES.GET_DEBUG_INFO && 
        message.type !== MESSAGE_TYPES.EXPORT_LOGS) {
      sendResponse({ success: true });
    }
  }

  /**
   * Handle track detected message
   */
  private async handleTrackDetected(_data: any): Promise<void> {
    try {
      if (!this.scrobbler || !this.settings?.isEnabled) {
        return;
      }

      const track: Track = _data.track;
      const isNowPlaying = _data.isNowPlaying || false;

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
  private handleTabUpdated(_tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab): void {
    if (changeInfo.status === 'complete' && tab.url?.includes('music.youtube.com')) {
      log('info', 'YouTube Music tab loaded');
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
   * Handle context menu clicks
   */
  private handleContextMenuClick(info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab): void {
    if (info.menuItemId === 'scrobble-now') {
      // Handle manual scrobble request
      this.handleManualScrobble(tab);
    }
  }

  /**
   * Handle manual scrobble request
   */
  private async handleManualScrobble(tab?: chrome.tabs.Tab): Promise<void> {
    try {
      if (!tab?.id) return;

      // Send message to content script to get current track
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'GET_CURRENT_TRACK'
      });

      if (response?.track && this.scrobbler) {
        await this.scrobbler.queueScrobble(response.track);
        showNotification(
          'Manual Scrobble',
          'Track added to scrobble queue',
          'basic'
        );
      }
    } catch (error) {
      log('error', 'Failed to handle manual scrobble:', error);
    }
  }

  /**
   * Create context menu
   */
  private createContextMenu(): void {
    chrome.contextMenus.create({
      id: 'scrobble-now',
      title: 'Scrobble this track',
      contexts: ['page'],
      documentUrlPatterns: ['https://music.youtube.com/*']
    });
  }

  /**
   * Handle start authentication request
   */
  private async handleStartAuth(sendResponse: (response?: any) => void): Promise<void> {
    try {
      console.log('[Madrak] Background: Starting authentication flow');
      log('info', 'Starting authentication flow');
      
      const authUrl = await this.authManager.startAuth();
      
      console.log('[Madrak] Background: Generated auth URL:', authUrl);
      
      if (authUrl) {
        log('info', 'Authentication URL generated:', authUrl);
        sendResponse({ success: true, authUrl });
      } else {
        console.error('[Madrak] Background: Failed to generate authentication URL');
        log('error', 'Failed to generate authentication URL');
        sendResponse({ success: false, error: 'Failed to generate authentication URL' });
      }
    } catch (error) {
      console.error('[Madrak] Background: Failed to start authentication:', error);
      log('error', 'Failed to start authentication:', error);
      sendResponse({ success: false, error: 'Failed to start authentication' });
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
  backgroundService['handleMessage'](message, sender, sendResponse);
});

chrome.runtime.onInstalled.addListener((details) => {
  backgroundService['handleInstalled'](details);
  backgroundService['createContextMenu']();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  backgroundService['handleTabUpdated'](tabId, changeInfo, tab);
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  backgroundService['handleTabActivated'](activeInfo);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  backgroundService['handleStorageChanged'](changes, areaName);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  backgroundService['handleContextMenuClick'](info, tab);
});

chrome.runtime.onSuspend.addListener(() => {
  backgroundService['cleanup']();
});
