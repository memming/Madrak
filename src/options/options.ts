/**
 * Options page script for Last.fm Scrobbler extension
 */

import { ExtensionSettings, LastFmUser } from '../shared/types';
import { STORAGE_KEYS, DEFAULT_SETTINGS, MESSAGE_TYPES } from '../shared/constants';
import { getSettings, saveSettings, log } from '../shared/utils';

class OptionsController {
  private settings: ExtensionSettings = DEFAULT_SETTINGS;
  private user: LastFmUser | null = null;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the options page
   */
  private async initialize(): Promise<void> {
    try {
      log('info', 'Initializing options page');
      
      // Load settings and user data
      await this.loadData();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Populate form
      this.populateForm();
      
      // Update UI
      this.updateUI();
      
      log('info', 'Options page initialized successfully');
    } catch (error) {
      log('error', 'Failed to initialize options page:', error);
      this.showToast('Failed to initialize options page', 'error');
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
      
      log('info', 'Data loaded:', { 
        isAuthenticated: !!this.user,
        settings: this.settings 
      });
    } catch (error) {
      log('error', 'Failed to load data:', error);
      throw error;
    }
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Save button
    const saveButton = document.getElementById('saveButton');
    saveButton?.addEventListener('click', () => this.handleSave());

    // Toggle switches
    const toggles = document.querySelectorAll('input[type="checkbox"]');
    toggles.forEach(toggle => {
      toggle.addEventListener('change', () => this.handleSettingChange());
    });

    // Number inputs
    const numberInputs = document.querySelectorAll('input[type="number"]');
    numberInputs.forEach(input => {
      input.addEventListener('change', () => this.handleSettingChange());
    });

    // Range slider
    const scrobbleThreshold = document.getElementById('scrobbleThreshold') as HTMLInputElement;
    scrobbleThreshold?.addEventListener('input', (e) => {
      const value = (e.target as HTMLInputElement).value;
      const valueDisplay = document.getElementById('scrobbleThresholdValue');
      if (valueDisplay) {
        valueDisplay.textContent = `${value}%`;
      }
      this.handleSettingChange();
    });

    // Account button
    const accountButton = document.getElementById('accountButton');
    accountButton?.addEventListener('click', () => this.handleAccountAction());

    // Clear data button
    const clearDataButton = document.getElementById('clearDataButton');
    clearDataButton?.addEventListener('click', () => this.handleClearData());

    // Footer links
    const helpLink = document.getElementById('helpLink');
    helpLink?.addEventListener('click', (e) => {
      e.preventDefault();
      this.handleHelp();
    });

    const privacyLink = document.getElementById('privacyLink');
    privacyLink?.addEventListener('click', (e) => {
      e.preventDefault();
      this.handlePrivacy();
    });

    const githubLink = document.getElementById('githubLink');
    githubLink?.addEventListener('click', (e) => {
      e.preventDefault();
      this.handleGitHub();
    });
  }

  /**
   * Populate form with current settings
   */
  private populateForm(): void {
    // General settings
    this.setCheckboxValue('enableScrobbling', this.settings.isEnabled);
    this.setCheckboxValue('autoScrobble', this.settings.autoScrobble);
    this.setCheckboxValue('showNotifications', this.settings.showNotifications);

    // Scrobbling settings
    this.setInputValue('minTrackLength', this.settings.minTrackLength.toString());
    this.setSliderValue('scrobbleThreshold', this.settings.scrobbleThreshold.toString());
    this.updateSliderDisplay('scrobbleThreshold', this.settings.scrobbleThreshold.toString());

    // Debug mode
    this.setCheckboxValue('debugMode', this.settings.debugMode);
    this.setSelectValue('logLevel', this.settings.logLevel);
  }

  /**
   * Update UI based on current state
   */
  private updateUI(): void {
    this.updateAccountInfo();
    this.updateStats();
  }

  /**
   * Update account information
   */
  private updateAccountInfo(): void {
    const accountName = document.getElementById('accountName');
    const accountStatus = document.getElementById('accountStatus');
    const accountAvatar = document.getElementById('accountAvatar') as HTMLImageElement;
    const accountButton = document.getElementById('accountButton') as HTMLButtonElement;

    if (this.user) {
      if (accountName) accountName.textContent = this.user.name;
      if (accountStatus) accountStatus.textContent = 'Connected to Last.fm';
      if (accountButton) {
        accountButton.textContent = 'Disconnect';
        accountButton.className = 'btn btn-danger';
      }

      if (accountAvatar && this.user.image && this.user.image.length > 0) {
        const largestImage = this.user.image.reduce((prev, current) => {
          const prevSize = this.getImageSize(prev.size);
          const currentSize = this.getImageSize(current.size);
          return currentSize > prevSize ? current : prev;
        });
        
        accountAvatar.src = largestImage['#text'];
        accountAvatar.alt = `${this.user.name}'s avatar`;
      }
    } else {
      if (accountName) accountName.textContent = 'Not connected';
      if (accountStatus) accountStatus.textContent = 'Connect your Last.fm account';
      if (accountButton) {
        accountButton.textContent = 'Connect';
        accountButton.className = 'btn btn-outline';
      }
    }
  }

  /**
   * Update statistics
   */
  private async updateStats(): Promise<void> {
    try {
      // Get queue stats from background script
      const response = await this.sendMessageToBackground({
        type: MESSAGE_TYPES.GET_QUEUE_STATS
      });

      if (response?.stats) {
        const queueSize = document.getElementById('queueSize');
        if (queueSize) {
          queueSize.textContent = response.stats.total.toString();
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

      // Update total scrobbles (placeholder)
      const totalScrobbles = document.getElementById('totalScrobbles');
      if (totalScrobbles) {
        totalScrobbles.textContent = '0'; // TODO: Get actual count
      }

      // Update uptime (placeholder)
      const uptime = document.getElementById('uptime');
      if (uptime) {
        uptime.textContent = '0h 0m'; // TODO: Calculate actual uptime
      }
    } catch (error) {
      log('error', 'Failed to update stats:', error);
    }
  }

  /**
   * Handle save button click
   */
  private async handleSave(): Promise<void> {
    try {
      // Collect form data
      this.collectFormData();
      
      // Save settings
      await saveSettings(this.settings);
      
      // Notify background script
      await this.sendMessageToBackground({
        type: MESSAGE_TYPES.SETTINGS_UPDATE,
        data: { settings: this.settings }
      });
      
      this.showToast('Settings saved successfully', 'success');
    } catch (error) {
      log('error', 'Failed to save settings:', error);
      this.showToast('Failed to save settings', 'error');
    }
  }

  /**
   * Handle setting change
   */
  private handleSettingChange(): void {
    // Mark form as dirty (you could add visual indicator here)
    const saveButton = document.getElementById('saveButton') as HTMLButtonElement;
    if (saveButton) {
      saveButton.style.opacity = '1';
    }
  }

  /**
   * Handle account action (connect/disconnect)
   */
  private async handleAccountAction(): Promise<void> {
    try {
      if (this.user) {
        // Disconnect
        await this.sendMessageToBackground({
          type: MESSAGE_TYPES.LOGOUT
        });
        
        this.user = null;
        this.updateAccountInfo();
        this.showToast('Disconnected from Last.fm', 'success');
      } else {
        // Connect
        const response = await this.sendMessageToBackground({
          type: MESSAGE_TYPES.START_AUTH
        });

        if (response?.authUrl) {
          chrome.tabs.create({ url: response.authUrl });
        }
      }
    } catch (error) {
      log('error', 'Failed to handle account action:', error);
      this.showToast('Failed to handle account action', 'error');
    }
  }

  /**
   * Handle clear data
   */
  private async handleClearData(): Promise<void> {
    try {
      if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
        await this.sendMessageToBackground({
          type: MESSAGE_TYPES.CLEAR_ALL_DATA
        });
        
        // Reset to defaults
        this.settings = DEFAULT_SETTINGS;
        this.user = null;
        
        this.populateForm();
        this.updateUI();
        
        this.showToast('All data cleared', 'success');
      }
    } catch (error) {
      log('error', 'Failed to clear data:', error);
      this.showToast('Failed to clear data', 'error');
    }
  }

  /**
   * Handle help link
   */
  private handleHelp(): void {
    chrome.tabs.create({ url: 'https://github.com/yourusername/lastfm-youtube-music-extension#help' });
  }

  /**
   * Handle privacy link
   */
  private handlePrivacy(): void {
    chrome.tabs.create({ url: 'https://github.com/yourusername/lastfm-youtube-music-extension#privacy' });
  }

  /**
   * Handle GitHub link
   */
  private handleGitHub(): void {
    chrome.tabs.create({ url: 'https://github.com/yourusername/lastfm-youtube-music-extension' });
  }

  /**
   * Collect form data into settings object
   */
  private collectFormData(): void {
    this.settings.isEnabled = this.getCheckboxValue('enableScrobbling');
    this.settings.autoScrobble = this.getCheckboxValue('autoScrobble');
    this.settings.showNotifications = this.getCheckboxValue('showNotifications');
    this.settings.minTrackLength = parseInt(this.getInputValue('minTrackLength')) || 30;
    this.settings.scrobbleThreshold = parseInt(this.getSliderValue('scrobbleThreshold')) || 50;
    this.settings.debugMode = this.getCheckboxValue('debugMode');
    this.settings.logLevel = this.getSelectValue('logLevel') as 'debug' | 'info' | 'warn' | 'error';
  }

  /**
   * Get checkbox value
   */
  private getCheckboxValue(id: string): boolean {
    const element = document.getElementById(id) as HTMLInputElement;
    return element?.checked || false;
  }

  /**
   * Set checkbox value
   */
  private setCheckboxValue(id: string, value: boolean): void {
    const element = document.getElementById(id) as HTMLInputElement;
    if (element) {
      element.checked = value;
    }
  }

  /**
   * Get input value
   */
  private getInputValue(id: string): string {
    const element = document.getElementById(id) as HTMLInputElement;
    return element?.value || '';
  }

  /**
   * Set input value
   */
  private setInputValue(id: string, value: string): void {
    const element = document.getElementById(id) as HTMLInputElement;
    if (element) {
      element.value = value;
    }
  }

  /**
   * Get slider value
   */
  private getSliderValue(id: string): string {
    const element = document.getElementById(id) as HTMLInputElement;
    return element?.value || '50';
  }

  /**
   * Set slider value
   */
  private setSliderValue(id: string, value: string): void {
    const element = document.getElementById(id) as HTMLInputElement;
    if (element) {
      element.value = value;
    }
  }

  /**
   * Get select value
   */
  private getSelectValue(id: string): string {
    const element = document.getElementById(id) as HTMLSelectElement;
    return element?.value || '';
  }

  /**
   * Set select value
   */
  private setSelectValue(id: string, value: string): void {
    const element = document.getElementById(id) as HTMLSelectElement;
    if (element) {
      element.value = value;
    }
  }

  /**
   * Update slider display
   */
  private updateSliderDisplay(id: string, value: string): void {
    const valueDisplay = document.getElementById(`${id}Value`);
    if (valueDisplay) {
      valueDisplay.textContent = `${value}%`;
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
   * Send message to background script
   */
  private async sendMessageToBackground(message: any): Promise<any> {
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

  /**
   * Show toast notification
   */
  private showToast(message: string, type: 'success' | 'error' | 'warning' = 'success'): void {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    // Remove toast after 3 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 3000);
  }
}

// Initialize options page when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new OptionsController();
  });
} else {
  new OptionsController();
}
