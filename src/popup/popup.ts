/**
 * Popup script for Last.fm Scrobbler extension
 */

import { Message, ExtensionSettings, LastFmUser } from '../shared/types';
import { MESSAGE_TYPES, STORAGE_KEYS } from '../shared/constants';
import { getSettings, saveSettings, log, getStoredLogs } from '../shared/utils';
import { getDebugInfo, exportDebugLogs, clearDebugLogs, initializeLogger } from '../shared/logger';

class PopupController {
  private settings: ExtensionSettings | null = null;
  private user: LastFmUser | null = null;
  private isAuthenticated: boolean = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the popup
   */
  private async initialize(): Promise<void> {
    try {
      // Initialize logger first
      const settings = await getSettings();
      initializeLogger(settings);
      
      log('info', 'Initializing popup');
      
      // Load settings and user data
      await this.loadData();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Set up message listeners
      this.setupMessageListeners();
      
      // Update UI
      this.updateUI();
      
      log('info', 'Popup initialized successfully');
    } catch (error) {
      log('error', 'Failed to initialize popup:', error);
      this.showError('Failed to initialize popup');
    }
  }

  /**
   * Load settings and user data
   */
  private async loadData(): Promise<void> {
    try {
      // Load settings
      this.settings = await getSettings();
      
      // Load user data
      this.user = await this.getStoredUser();
      this.isAuthenticated = !!this.user;
      
      log('info', 'Data loaded:', { isAuthenticated: this.isAuthenticated });
    } catch (error) {
      log('error', 'Failed to load data:', error);
      throw error;
    }
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Connect button
    const connectButton = document.getElementById('connectButton');
    connectButton?.addEventListener('click', () => this.handleConnect());

    // Disconnect button
    const disconnectButton = document.getElementById('disconnectButton');
    disconnectButton?.addEventListener('click', () => this.handleDisconnect());

    // Pause button
    const pauseButton = document.getElementById('pauseButton');
    pauseButton?.addEventListener('click', () => this.handlePauseToggle());

    // Settings button
    const settingsButton = document.getElementById('settingsButton');
    settingsButton?.addEventListener('click', () => this.handleSettings());

    // Debug button
    const debugButton = document.getElementById('debugButton');
    debugButton?.addEventListener('click', () => this.handleDebug());

    // Debug panel controls
    const exportLogsButton = document.getElementById('exportLogsButton');
    exportLogsButton?.addEventListener('click', () => this.handleExportLogs());

    const clearLogsButton = document.getElementById('clearLogsButton');
    clearLogsButton?.addEventListener('click', () => this.handleClearLogs());

    const closeDebugButton = document.getElementById('closeDebugButton');
    closeDebugButton?.addEventListener('click', () => this.handleCloseDebug());

    // Debug tabs
    const debugTabs = document.querySelectorAll('.debug-tab');
    debugTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const tabName = target.getAttribute('data-tab');
        if (tabName) {
          this.switchDebugTab(tabName);
        }
      });
    });

    // Retry button
    const retryButton = document.getElementById('retryButton');
    retryButton?.addEventListener('click', () => this.initialize());

    // Help and feedback links
    const helpLink = document.getElementById('helpLink');
    helpLink?.addEventListener('click', (e) => {
      e.preventDefault();
      this.handleHelp();
    });

    const feedbackLink = document.getElementById('feedbackLink');
    feedbackLink?.addEventListener('click', (e) => {
      e.preventDefault();
      this.handleFeedback();
    });
  }

  /**
   * Set up message listeners for background communication
   */
  private setupMessageListeners(): void {
    chrome.runtime.onMessage.addListener((message: Message, _sender, _sendResponse) => {
      console.log('[Madrak] Popup received message:', message.type);
      
      switch (message.type) {
        case 'AUTH_SUCCESS':
          this.handleAuthSuccess(message.data);
          break;
        case 'AUTH_ERROR':
          this.handleAuthError(message.data);
          break;
        case MESSAGE_TYPES.SETTINGS_UPDATE:
          this.handleSettingsUpdate(message.data);
          break;
        default:
          console.log('[Madrak] Popup: Unknown message type:', message.type);
      }
    });
  }


  /**
   * Handle successful authentication
   */
  private async handleAuthSuccess(data: any): Promise<void> {
    try {
      console.log('[Madrak] Popup: Authentication successful', data);
      log('info', 'Authentication successful in popup', data);
      
      // Reload data to get updated user info
      await this.loadData();
      
      // Update UI to show authenticated state
      this.updateUI();
      
      // Show success message
      this.showSuccess('Successfully connected to Last.fm!');
      
    } catch (error) {
      console.error('[Madrak] Popup: Failed to handle auth success:', error);
      log('error', 'Failed to handle authentication success:', error);
    }
  }

  /**
   * Handle authentication error
   */
  private handleAuthError(data: any): void {
    try {
      console.error('[Madrak] Popup: Authentication failed', data);
      log('error', 'Authentication failed in popup', data);
      
      const errorMessage = data?.error || 'Authentication failed';
      this.showError(`Authentication failed: ${errorMessage}`);
      
    } catch (error) {
      console.error('[Madrak] Popup: Failed to handle auth error:', error);
      log('error', 'Failed to handle authentication error:', error);
    }
  }

  /**
   * Handle settings update
   */
  private async handleSettingsUpdate(data: any): Promise<void> {
    try {
      console.log('[Madrak] Popup: Settings updated', data);
      log('info', 'Settings updated in popup', data);
      
      // Reload settings
      this.settings = data.settings;
      
      // Refresh debug info if debug panel is open
      const debugPanel = document.getElementById('debugPanel');
      if (debugPanel && debugPanel.style.display !== 'none') {
        this.refreshDebugInfo();
      }
      
      // Update UI
      this.updateUI();
      
    } catch (error) {
      console.error('[Madrak] Popup: Failed to handle settings update:', error);
      log('error', 'Failed to handle settings update:', error);
    }
  }

  /**
   * Show success message
   */
  private showSuccess(message: string): void {
    // Create a temporary success message
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    successDiv.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      right: 10px;
      background: #4CAF50;
      color: white;
      padding: 10px;
      border-radius: 4px;
      z-index: 1000;
      text-align: center;
    `;
    
    document.body.appendChild(successDiv);
    
    // Remove after 3 seconds
    setTimeout(() => {
      if (successDiv.parentNode) {
        successDiv.parentNode.removeChild(successDiv);
      }
    }, 3000);
  }



  /**
   * Update the UI based on current state
   */
  private updateUI(): void {
    try {
      if (this.isAuthenticated) {
        this.showMainSection();
        this.updateUserInfo();
        this.updateCurrentTrack();
      } else {
        this.showAuthSection();
      }
      
      this.updateStatusIndicator();
    } catch (error) {
      log('error', 'Failed to update UI:', error);
      this.showError('Failed to update UI');
    }
  }

  /**
   * Show authentication section
   */
  private showAuthSection(): void {
    document.getElementById('authSection')?.classList.remove('hidden');
    document.getElementById('mainSection')?.classList.add('hidden');
    document.getElementById('errorSection')?.classList.add('hidden');
  }

  /**
   * Show main section
   */
  private showMainSection(): void {
    document.getElementById('authSection')?.classList.add('hidden');
    document.getElementById('mainSection')?.classList.remove('hidden');
    document.getElementById('errorSection')?.classList.add('hidden');
  }

  /**
   * Show error section
   */
  private showError(message: string): void {
    document.getElementById('authSection')?.classList.add('hidden');
    document.getElementById('mainSection')?.classList.add('hidden');
    document.getElementById('errorSection')?.classList.remove('hidden');
    
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) {
      errorMessage.textContent = message;
    }
  }

  /**
   * Update user information
   */
  private updateUserInfo(): void {
    if (!this.user) return;

    const userName = document.getElementById('userName');
    if (userName) {
      userName.textContent = this.user.name;
    }

    const userPlaycount = document.getElementById('userPlaycount');
    if (userPlaycount) {
      const playcount = this.user.playcount || 0;
      userPlaycount.textContent = `${playcount.toLocaleString()} plays`;
    }

    const userAvatar = document.getElementById('userAvatar') as HTMLImageElement;
    if (userAvatar && this.user.image && this.user.image.length > 0) {
      // Get the largest available image
      const largestImage = this.user.image.reduce((prev, current) => {
        const prevSize = this.getImageSize(prev.size);
        const currentSize = this.getImageSize(current.size);
        return currentSize > prevSize ? current : prev;
      });
      
      userAvatar.src = largestImage['#text'];
      userAvatar.alt = `${this.user.name}'s avatar`;
    }
  }

  /**
   * Get image size value for comparison
   */
  private getImageSize(size: string): number {
    const sizes = { 'small': 1, 'medium': 2, 'large': 3, 'extralarge': 4, 'mega': 5 };
    return sizes[size as keyof typeof sizes] || 0;
  }


  /**
   * Update current track information
   */
  private async updateCurrentTrack(): Promise<void> {
    try {
      // Get current tab from active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length === 0) {
        this.hideCurrentTrack();
        return;
      }

      const tab = tabs[0];
      if (!tab?.url?.includes('music.youtube.com')) {
        this.showNotOnYouTubeMusic();
        return;
      }

      // Check if content script is available
      if (!tab?.id) {
        this.hideCurrentTrack();
        return;
      }

      try {
        // Send message to content script to get current track
        const response = await chrome.tabs.sendMessage(tab.id, {
          type: MESSAGE_TYPES.GET_CURRENT_TRACK
        });

        if (response?.success && response?.track) {
          this.showCurrentTrack(response.track, {
            isPlaying: response.isPlaying,
            currentTime: response.currentTime,
            thumbnail: response.thumbnail
          });
        } else {
          this.hideCurrentTrack();
        }
      } catch (messageError) {
        // Handle specific message errors
        if (messageError instanceof Error) {
          if (messageError.message.includes('Could not establish connection') || 
              messageError.message.includes('Receiving end does not exist')) {
            log('warn', 'Content script not available on this tab', {
              tabId: tab.id,
              url: tab.url,
              error: messageError.message
            });
            this.showContentScriptNotAvailable();
          } else {
            log('error', 'Failed to communicate with content script:', messageError);
            this.hideCurrentTrack();
          }
        } else {
          log('error', 'Unknown error communicating with content script:', messageError);
          this.hideCurrentTrack();
        }
      }
    } catch (error) {
      log('error', 'Failed to update current track:', error);
      this.hideCurrentTrack();
    }
  }

  /**
   * Show current track section
   */
  private showCurrentTrack(track: any, additionalInfo?: { isPlaying?: boolean; currentTime?: number; thumbnail?: string }): void {
    const section = document.getElementById('currentTrackSection');
    if (section) {
      section.style.display = 'block';
    }

    const trackTitle = document.getElementById('trackTitle');
    if (trackTitle) {
      trackTitle.textContent = track.title || 'Unknown Title';
    }

    const trackArtist = document.getElementById('trackArtist');
    if (trackArtist) {
      trackArtist.textContent = track.artist || 'Unknown Artist';
    }

    const trackAlbum = document.getElementById('trackAlbum');
    if (trackAlbum) {
      trackAlbum.textContent = track.album || '';
    }

    const trackArtwork = document.getElementById('trackArtwork') as HTMLImageElement;
    if (trackArtwork) {
      const thumbnail = additionalInfo?.thumbnail || track.thumbnail;
      if (thumbnail) {
        trackArtwork.src = thumbnail;
        trackArtwork.alt = `${track.title} artwork`;
      }
    }

    // Update scrobble status with additional info
    this.updateScrobbleStatus(track, additionalInfo);
  }

  /**
   * Hide current track section
   */
  private hideCurrentTrack(): void {
    const section = document.getElementById('currentTrackSection');
    if (section) {
      section.style.display = 'none';
    }
  }

  /**
   * Show not on YouTube Music message
   */
  private showNotOnYouTubeMusic(): void {
    const section = document.getElementById('currentTrackSection');
    if (section) {
      section.style.display = 'block';
    }

    const trackTitle = document.getElementById('trackTitle');
    if (trackTitle) {
      trackTitle.textContent = 'Not on YouTube Music';
    }

    const trackArtist = document.getElementById('trackArtist');
    if (trackArtist) {
      trackArtist.textContent = 'Open YouTube Music to start scrobbling';
    }

    const trackAlbum = document.getElementById('trackAlbum');
    if (trackAlbum) {
      trackAlbum.textContent = '';
    }

    const trackArtwork = document.getElementById('trackArtwork') as HTMLImageElement;
    if (trackArtwork) {
      trackArtwork.src = '';
      trackArtwork.alt = '';
    }

    // Update scrobble status to show info
    const statusElement = document.getElementById('scrobbleStatus');
    if (statusElement) {
      const statusIcon = statusElement.querySelector('.status-icon');
      const statusText = statusElement.querySelector('.status-text');
      
      if (statusIcon && statusText) {
        statusIcon.textContent = '🎵';
        statusText.textContent = 'Go to music.youtube.com';
      }
    }
  }

  /**
   * Show content script not available message
   */
  private showContentScriptNotAvailable(): void {
    const section = document.getElementById('currentTrackSection');
    if (section) {
      section.style.display = 'block';
    }

    const trackTitle = document.getElementById('trackTitle');
    if (trackTitle) {
      trackTitle.textContent = 'Content script not loaded';
    }

    const trackArtist = document.getElementById('trackArtist');
    if (trackArtist) {
      trackArtist.textContent = 'Please refresh the YouTube Music page';
    }

    const trackAlbum = document.getElementById('trackAlbum');
    if (trackAlbum) {
      trackAlbum.textContent = '';
    }

    const trackArtwork = document.getElementById('trackArtwork') as HTMLImageElement;
    if (trackArtwork) {
      trackArtwork.src = '';
      trackArtwork.alt = '';
    }

    // Update scrobble status to show error
    const statusElement = document.getElementById('scrobbleStatus');
    if (statusElement) {
      const statusIcon = statusElement.querySelector('.status-icon');
      const statusText = statusElement.querySelector('.status-text');
      
      if (statusIcon && statusText) {
        statusIcon.textContent = '⚠️';
        statusText.textContent = 'Refresh page to enable tracking';
      }
    }
  }

  /**
   * Update scrobble status
   */
  private updateScrobbleStatus(track: any, additionalInfo?: { isPlaying?: boolean; currentTime?: number; thumbnail?: string }): void {
    const statusElement = document.getElementById('scrobbleStatus');
    if (!statusElement) return;

    const statusIcon = statusElement.querySelector('.status-icon');
    const statusText = statusElement.querySelector('.status-text');

    if (!statusIcon || !statusText) return;

    // Use additional info if available, otherwise fall back to track data
    const currentTime = additionalInfo?.currentTime ?? track.currentTime ?? 0;
    const isPlaying = additionalInfo?.isPlaying ?? track.isPlaying ?? false;

    // Check if track meets scrobbling requirements
    const minLength = this.settings?.minTrackLength || 30;
    const threshold = this.settings?.scrobbleThreshold || 50;
    const duration = track.duration || 0;

    if (!isPlaying) {
      statusIcon.textContent = '⏸️';
      statusText.textContent = 'Paused';
    } else if (duration < minLength) {
      statusIcon.textContent = '⏱️';
      statusText.textContent = 'Track too short to scrobble';
    } else if (currentTime / duration < threshold / 100) {
      statusIcon.textContent = '⏳';
      statusText.textContent = 'Playing...';
    } else {
      statusIcon.textContent = '✅';
      statusText.textContent = 'Ready to scrobble';
    }
  }

  /**
   * Update status indicator
   */
  private updateStatusIndicator(): void {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');

    if (!statusDot || !statusText) return;

    statusDot.className = 'status-dot';
    statusText.textContent = 'Checking...';

    if (this.isAuthenticated) {
      statusDot.classList.add('connected');
      statusText.textContent = 'Connected';
    } else {
      statusDot.classList.add('error');
      statusText.textContent = 'Not connected';
    }
  }

  /**
   * Handle connect button click
   */
  private async handleConnect(): Promise<void> {
    try {
      console.log('[Madrak] Connect button clicked');
      log('info', 'Connect button clicked in popup', { 
        isAuthenticated: this.isAuthenticated,
        hasUser: !!this.user,
        hasSettings: !!this.settings
      });
      
      // Check if already authenticated
      if (this.isAuthenticated) {
        console.log('[Madrak] User is already authenticated, showing main section');
        this.showMainSection();
        this.updateUI();
        return;
      }
      
      const connectButton = document.getElementById('connectButton') as HTMLButtonElement;
      if (connectButton) {
        connectButton.classList.add('loading');
        connectButton.disabled = true;
      }

      console.log('[Madrak] Sending START_AUTH message to background');
      log('info', 'Sending START_AUTH message to background script');
      
      // Ensure service worker is active before sending message
      await this.ensureServiceWorkerActive();
      
      // Start authentication flow
      const response = await this.sendMessageToBackground({
        type: MESSAGE_TYPES.START_AUTH
      });

      console.log('[Madrak] Received response from background:', response);
      log('info', 'Received response from background script', { response });

      if (response?.success) {
        console.log('[Madrak] Authentication completed successfully');
        log('info', 'Authentication completed successfully in popup');
        this.showSuccess('Successfully connected to Last.fm!');
        
        // Reload data and update UI
        console.log('[Madrak] Reloading user data and updating UI');
        await this.loadData();
        this.updateUI();
      } else {
        console.error('[Madrak] Authentication failed:', response?.error);
        log('error', 'Authentication failed in popup', { error: response?.error });
        this.showError(`Authentication failed: ${response?.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[Madrak] Failed to start authentication:', error);
      
      let errorMessage = 'Unknown error';
      let errorDetails = '';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        errorDetails = error.stack || '';
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        errorMessage = (error as any).message || error.toString() || 'Object error';
        errorDetails = JSON.stringify(error, null, 2);
      } else {
        errorMessage = String(error);
      }
      
      console.error('[Madrak] Error details:', errorDetails);
      log('error', 'Failed to start authentication:', { 
        error: errorMessage, 
        details: errorDetails,
        originalError: error 
      });
      this.showError(`Failed to start authentication: ${errorMessage}`);
    } finally {
      const connectButton = document.getElementById('connectButton') as HTMLButtonElement;
      if (connectButton) {
        connectButton.classList.remove('loading');
        connectButton.disabled = false;
      }
    }
  }

  /**
   * Handle disconnect button click
   */
  private async handleDisconnect(): Promise<void> {
    try {
      await this.sendMessageToBackground({
        type: MESSAGE_TYPES.LOGOUT
      });

      // Reload data and update UI
      await this.loadData();
      this.updateUI();
    } catch (error) {
      log('error', 'Failed to disconnect:', error);
      this.showError('Failed to disconnect');
    }
  }

  /**
   * Handle pause toggle
   */
  private async handlePauseToggle(): Promise<void> {
    try {
      if (!this.settings) return;

      this.settings.isEnabled = !this.settings.isEnabled;
      await saveSettings(this.settings);

      // Notify background script
      await this.sendMessageToBackground({
        type: MESSAGE_TYPES.SETTINGS_UPDATE,
        data: { settings: this.settings }
      });

      // Update UI
      this.updateUI();
    } catch (error) {
      log('error', 'Failed to toggle pause:', error);
    }
  }

  /**
   * Handle settings button click
   */
  private handleSettings(): void {
    chrome.runtime.openOptionsPage();
  }

  /**
   * Handle debug button click
   */
  private handleDebug(): void {
    const debugPanel = document.getElementById('debugPanel');
    if (debugPanel) {
      debugPanel.style.display = debugPanel.style.display === 'none' ? 'block' : 'none';
      if (debugPanel.style.display === 'block') {
        this.loadDebugInfo();
      }
    }
  }

  /**
   * Handle export logs button click
   */
  private async handleExportLogs(): Promise<void> {
    try {
      const debugData = exportDebugLogs();
      const blob = new Blob([debugData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `lastfm-scrobbler-debug-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export logs:', error);
    }
  }

  /**
   * Handle clear logs button click
   */
  private async handleClearLogs(): Promise<void> {
    try {
      if (confirm('Are you sure you want to clear all debug logs?')) {
        clearDebugLogs();
        this.loadDebugInfo();
      }
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  }

  /**
   * Handle close debug button click
   */
  private handleCloseDebug(): void {
    const debugPanel = document.getElementById('debugPanel');
    if (debugPanel) {
      debugPanel.style.display = 'none';
    }
  }

  /**
   * Switch debug tab
   */
  private switchDebugTab(tabName: string): void {
    // Update tab buttons
    const tabs = document.querySelectorAll('.debug-tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
    activeTab?.classList.add('active');

    // Update tab content
    const contents = document.querySelectorAll('.debug-tab-content');
    contents.forEach(content => (content as HTMLElement).style.display = 'none');
    const activeContent = document.getElementById(`${tabName}Tab`);
    if (activeContent) {
      (activeContent as HTMLElement).style.display = 'block';
    }

    // Load content for the active tab
    if (tabName === 'logs') {
      this.loadRecentLogs();
    } else if (tabName === 'errors') {
      this.loadErrorLogs();
    } else if (tabName === 'system') {
      this.loadSystemInfo();
    }
  }

  /**
   * Load debug information
   */
  private async loadDebugInfo(): Promise<void> {
    this.loadRecentLogs();
    this.loadErrorLogs();
    this.loadSystemInfo();
  }

  /**
   * Refresh debug information (called when settings change)
   */
  private refreshDebugInfo(): void {
    // Only refresh if debug panel is visible
    const debugPanel = document.getElementById('debugPanel');
    if (debugPanel && debugPanel.style.display !== 'none') {
      this.loadSystemInfo();
    }
  }

  /**
   * Load recent logs
   */
  private loadRecentLogs(): void {
    const logEntries = document.getElementById('logEntries');
    if (!logEntries) return;

    try {
      const logs = getStoredLogs(undefined, 20);
      
      if (logs.length === 0) {
        logEntries.innerHTML = '<div class="log-entry"><span class="log-message">No logs available</span></div>';
        return;
      }

      logEntries.innerHTML = logs.map(log => `
        <div class="log-entry">
          <span class="log-time">${new Date(log.timestamp).toLocaleTimeString()}</span>
          <span class="log-level ${log.level}">${log.level.toUpperCase()}</span>
          <span class="log-message">${log.message}</span>
        </div>
      `).join('');
    } catch (error) {
      logEntries.innerHTML = '<div class="log-entry"><span class="log-message">Error loading logs</span></div>';
    }
  }

  /**
   * Load error logs
   */
  private loadErrorLogs(): void {
    const errorEntries = document.getElementById('errorEntries');
    if (!errorEntries) return;

    try {
      const errors = getStoredLogs('error', 20);
      
      if (errors.length === 0) {
        errorEntries.innerHTML = '<div class="log-entry"><span class="log-message">No errors found</span></div>';
        return;
      }

      errorEntries.innerHTML = errors.map(log => `
        <div class="log-entry">
          <span class="log-time">${new Date(log.timestamp).toLocaleTimeString()}</span>
          <span class="log-level ${log.level}">${log.level.toUpperCase()}</span>
          <span class="log-message">${log.message}</span>
        </div>
      `).join('');
    } catch (error) {
      errorEntries.innerHTML = '<div class="log-entry"><span class="log-message">Error loading error logs</span></div>';
    }
  }

  /**
   * Load system information
   */
  private loadSystemInfo(): void {
    const systemInfo = document.getElementById('systemInfo');
    if (!systemInfo) return;

    try {
      const debugInfo = getDebugInfo();
      
      systemInfo.innerHTML = `
        <div class="info-item">
          <span class="info-label">Extension Version</span>
          <span class="info-value">0.3.0</span>
        </div>
        <div class="info-item">
          <span class="info-label">User Agent</span>
          <span class="info-value">${debugInfo.userAgent}</span>
        </div>
        <div class="info-item">
          <span class="info-label">URL</span>
          <span class="info-value">${debugInfo.url}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Debug Mode</span>
          <span class="info-value">${debugInfo.loggerConfig.enableStorage ? 'Enabled' : 'Disabled'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Log Level</span>
          <span class="info-value">${debugInfo.loggerConfig.level}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Recent Errors</span>
          <span class="info-value">${debugInfo.recentErrors.length}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Timestamp</span>
          <span class="info-value">${new Date(debugInfo.timestamp).toLocaleString()}</span>
        </div>
      `;
    } catch (error) {
      systemInfo.innerHTML = '<div class="info-item"><span class="info-label">Error loading system info</span></div>';
    }
  }

  /**
   * Handle help link click
   */
  private handleHelp(): void {
    chrome.tabs.create({ url: 'https://github.com/yourusername/lastfm-youtube-music-extension#help' });
  }

  /**
   * Handle feedback link click
   */
  private handleFeedback(): void {
    chrome.tabs.create({ url: 'https://github.com/yourusername/lastfm-youtube-music-extension/issues' });
  }

  /**
   * Ensure service worker is active before sending message
   */
  private async ensureServiceWorkerActive(): Promise<void> {
    try {
      // Send a ping message to wake up the service worker
      await new Promise<void>((resolve) => {
        chrome.runtime.sendMessage({ type: MESSAGE_TYPES.PING }, () => {
          if (chrome.runtime.lastError) {
            // If ping fails, that's okay - we'll try the actual message anyway
            console.log('[Madrak] Service worker ping failed, proceeding anyway');
          }
          resolve();
        });
      });
    } catch (error) {
      // Ignore ping errors, proceed with actual message
      console.log('[Madrak] Service worker ping error, proceeding anyway');
    }
  }

  /**
   * Send message to background script
   */
  private async sendMessageToBackground(message: Message): Promise<any> {
    const maxRetries = 3;
    let retryCount = 0;

    const attemptSend = (): Promise<any> => {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            const error = chrome.runtime.lastError;
            console.error('[Madrak] Message port error (attempt ' + (retryCount + 1) + '):', error);
            
            // Handle specific message port errors
            if (error.message?.includes('message port closed') && retryCount < maxRetries) {
              retryCount++;
              console.log('[Madrak] Service worker may be sleeping, retrying in 200ms... (attempt ' + retryCount + '/' + maxRetries + ')');
              
              // Wake up service worker first
              chrome.runtime.sendMessage({ type: MESSAGE_TYPES.PING }, () => {
                // Wait a bit longer for service worker to wake up
                setTimeout(() => {
                  attemptSend().then(resolve).catch(reject);
                }, 200);
              });
            } else {
              reject(new Error(`Service worker unavailable after ${retryCount} retries: ${error.message}`));
            }
          } else {
            console.log('[Madrak] Message sent successfully, response received');
            resolve(response);
          }
        });
      });
    };

    return attemptSend();
  }

  /**
   * Get stored user data
   */
  private async getStoredUser(): Promise<LastFmUser | null> {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get([STORAGE_KEYS.LASTFM_USER], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result[STORAGE_KEYS.LASTFM_USER] || null);
        }
      });
    });
  }

}

// Initialize popup when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new PopupController();
  });
} else {
  new PopupController();
}
