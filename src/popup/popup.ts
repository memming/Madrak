/**
 * Popup script for Last.fm Scrobbler extension
 */

import { Message, ExtensionSettings, LastFmUser } from '../shared/types';
import { MESSAGE_TYPES, STORAGE_KEYS } from '../shared/constants';
import { getSettings, saveSettings, log, formatDuration, getStoredLogs, exportLogs, clearStoredLogs } from '../shared/utils';
import { getDebugInfo, exportDebugLogs, clearDebugLogs } from '../shared/logger';

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
      log('info', 'Initializing popup');
      
      // Load settings and user data
      await this.loadData();
      
      // Set up event listeners
      this.setupEventListeners();
      
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
   * Update the UI based on current state
   */
  private updateUI(): void {
    try {
      if (this.isAuthenticated) {
        this.showMainSection();
        this.updateUserInfo();
        this.updateStats();
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
   * Update statistics
   */
  private async updateStats(): Promise<void> {
    try {
      // Get queue count from background script
      const response = await this.sendMessageToBackground({
        type: 'GET_QUEUE_STATS'
      });

      if (response?.stats) {
        const queueCount = document.getElementById('queueCount');
        if (queueCount) {
          queueCount.textContent = response.stats.total.toString();
        }
      }

      // Get last scrobble time
      const lastScrobble = await this.getLastScrobbleTime();
      const lastScrobbleElement = document.getElementById('lastScrobble');
      if (lastScrobbleElement) {
        if (lastScrobble) {
          const timeAgo = this.getTimeAgo(lastScrobble);
          lastScrobbleElement.textContent = timeAgo;
        } else {
          lastScrobbleElement.textContent = 'Never';
        }
      }

      // Update scrobbled count (placeholder for now)
      const scrobbledCount = document.getElementById('scrobbledCount');
      if (scrobbledCount) {
        scrobbledCount.textContent = '0'; // TODO: Get actual count
      }
    } catch (error) {
      log('error', 'Failed to update stats:', error);
    }
  }

  /**
   * Update current track information
   */
  private async updateCurrentTrack(): Promise<void> {
    try {
      // Get current track from active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length === 0) return;

      const tab = tabs[0];
      if (!tab.url?.includes('music.youtube.com')) {
        this.hideCurrentTrack();
        return;
      }

      // Send message to content script to get current track
      const response = await chrome.tabs.sendMessage(tab.id!, {
        type: 'GET_CURRENT_TRACK'
      });

      if (response?.track) {
        this.showCurrentTrack(response.track);
      } else {
        this.hideCurrentTrack();
      }
    } catch (error) {
      log('error', 'Failed to update current track:', error);
      this.hideCurrentTrack();
    }
  }

  /**
   * Show current track section
   */
  private showCurrentTrack(track: any): void {
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
    if (trackArtwork && track.thumbnail) {
      trackArtwork.src = track.thumbnail;
      trackArtwork.alt = `${track.title} artwork`;
    }

    // Update scrobble status
    this.updateScrobbleStatus(track);
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
   * Update scrobble status
   */
  private updateScrobbleStatus(track: any): void {
    const statusElement = document.getElementById('scrobbleStatus');
    if (!statusElement) return;

    const statusIcon = statusElement.querySelector('.status-icon');
    const statusText = statusElement.querySelector('.status-text');

    if (!statusIcon || !statusText) return;

    // Check if track meets scrobbling requirements
    const minLength = this.settings?.minTrackLength || 30;
    const threshold = this.settings?.scrobbleThreshold || 50;
    const duration = track.duration || 0;
    const currentTime = track.currentTime || 0;

    if (duration < minLength) {
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
      const connectButton = document.getElementById('connectButton') as HTMLButtonElement;
      if (connectButton) {
        connectButton.classList.add('loading');
        connectButton.disabled = true;
      }

      // Start authentication flow
      const response = await this.sendMessageToBackground({
        type: 'START_AUTH'
      });

      if (response?.authUrl) {
        // Open authentication URL
        await chrome.tabs.create({ url: response.authUrl });
      }
    } catch (error) {
      log('error', 'Failed to start authentication:', error);
      this.showError('Failed to start authentication');
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
        type: 'LOGOUT'
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
    contents.forEach(content => content.style.display = 'none');
    const activeContent = document.getElementById(`${tabName}Tab`);
    if (activeContent) {
      activeContent.style.display = 'block';
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
          <span class="info-value">1.0.0</span>
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
   * Send message to background script
   */
  private async sendMessageToBackground(message: Message): Promise<any> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
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

  /**
   * Get last scrobble time
   */
  private async getLastScrobbleTime(): Promise<number | null> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get([STORAGE_KEYS.LAST_SCROBBLE], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result[STORAGE_KEYS.LAST_SCROBBLE] || null);
        }
      });
    });
  }

  /**
   * Get time ago string
   */
  private getTimeAgo(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
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
