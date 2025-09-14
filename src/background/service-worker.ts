/**
 * Background service worker for Last.fm Scrobbler
 */

import { Message, Track, ExtensionSettings } from '../shared/types';
import { MESSAGE_TYPES, STORAGE_KEYS, NOTIFICATION_IDS } from '../shared/constants';
import { getSettings, saveSettings, log, debug, info, error, showNotification } from '../shared/utils';
import { initializeLogger, logSystemInfo } from '../shared/logger';
import { AuthManager } from '../api/auth';
import { Scrobbler } from '../api/scrobbler';

class BackgroundService {
  private authManager: AuthManager;
  private scrobbler: Scrobbler | null = null;
  private settings: ExtensionSettings | null = null;
  private isInitialized: boolean = false;

  constructor() {
    // Initialize with placeholder values - will be updated from settings
    this.authManager = new AuthManager('', '');
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
      initializeLogger(this.settings);
      
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
      
      this.isInitialized = true;
      info('Background service initialized successfully');
    } catch (error) {
      error('Failed to initialize background service', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  /**
   * Handle messages from content scripts and popup
   */
  private handleMessage(message: Message, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void): void {
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
      default:
        log('warn', 'Unknown message type:', message.type);
    }

    sendResponse({ success: true });
  }

  /**
   * Handle track detected message
   */
  private async handleTrackDetected(data: any): Promise<void> {
    try {
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
  private async handleTrackEnded(data: any): Promise<void> {
    try {
      if (!this.scrobbler || !this.settings?.isEnabled) {
        return;
      }

      const track: Track = data.track;
      const playDuration = data.playDuration || 0;

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
  private async handleAuthSuccess(data: any): Promise<void> {
    try {
      log('info', 'Authentication successful');
      
      // Reinitialize scrobbler with authenticated API
      if (this.settings) {
        this.scrobbler = new Scrobbler(this.authManager.getApi(), this.settings);
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
      
      if (this.scrobbler) {
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
  private handleStorageChanged(changes: { [key: string]: chrome.storage.StorageChange }, areaName: string): void {
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
