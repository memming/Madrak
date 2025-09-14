/**
 * Last.fm authentication handling
 */

import { LastFmSession, LastFmUser, ExtensionSettings } from '../shared/types';
import { STORAGE_KEYS } from '../shared/constants';
import { getSettings, saveSettings, log } from '../shared/utils';
import { LastFmApi } from './lastfm-api';

export class AuthManager {
  private api: LastFmApi;

  constructor(apiKey: string, sharedSecret: string) {
    this.api = new LastFmApi(apiKey, sharedSecret);
  }

  /**
   * Initialize authentication by loading saved session
   */
  async initialize(): Promise<boolean> {
    try {
      const session = await this.getStoredSession();
      if (session) {
        this.api.setSession(session);
        log('info', 'Loaded existing session for user:', session.name);
        return true;
      }
      return false;
    } catch (error) {
      log('error', 'Failed to initialize authentication:', error);
      return false;
    }
  }

  /**
   * Start the authentication flow
   */
  async startAuth(): Promise<string> {
    try {
      const authUrl = this.api.getAuthUrl();
      log('info', 'Starting authentication flow');
      return authUrl;
    } catch (error) {
      log('error', 'Failed to start authentication:', error);
      throw error;
    }
  }

  /**
   * Complete authentication with the token from the callback
   */
  async completeAuth(token: string): Promise<LastFmSession> {
    try {
      const session = await this.api.completeAuth(token);
      await this.saveSession(session);
      
      // Get user info and save it
      const user = await this.api.getUserInfo();
      await this.saveUser(user);
      
      log('info', 'Authentication completed successfully');
      return session;
    } catch (error) {
      log('error', 'Failed to complete authentication:', error);
      throw error;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.api.isAuthenticated();
  }

  /**
   * Get current session
   */
  getSession(): LastFmSession | undefined {
    return this.api.getSession();
  }

  /**
   * Get current user info
   */
  async getUser(): Promise<LastFmUser | null> {
    try {
      return await this.getStoredUser();
    } catch (error) {
      log('error', 'Failed to get user info:', error);
      return null;
    }
  }

  /**
   * Logout and clear stored data
   */
  async logout(): Promise<void> {
    try {
      // Clear stored session and user data
      await chrome.storage.sync.remove([
        STORAGE_KEYS.LASTFM_SESSION,
        STORAGE_KEYS.LASTFM_USER,
        STORAGE_KEYS.AUTH_TOKEN
      ]);

      // Clear in-memory session
      this.api = new LastFmApi(this.api['apiKey'], this.api['sharedSecret']);
      
      log('info', 'Logged out successfully');
    } catch (error) {
      log('error', 'Failed to logout:', error);
      throw error;
    }
  }

  /**
   * Save session to storage
   */
  private async saveSession(session: LastFmSession): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.set({ [STORAGE_KEYS.LASTFM_SESSION]: session }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Get session from storage
   */
  private async getStoredSession(): Promise<LastFmSession | null> {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get([STORAGE_KEYS.LASTFM_SESSION], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result[STORAGE_KEYS.LASTFM_SESSION] || null);
        }
      });
    });
  }

  /**
   * Save user info to storage
   */
  private async saveUser(user: LastFmUser): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.set({ [STORAGE_KEYS.LASTFM_USER]: user }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Get user info from storage
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
   * Validate stored session
   */
  async validateSession(): Promise<boolean> {
    try {
      if (!this.isAuthenticated()) {
        return false;
      }

      // Try to get user info to validate session
      await this.api.getUserInfo();
      return true;
    } catch (error) {
      log('warn', 'Session validation failed:', error);
      // Session is invalid, clear it
      await this.logout();
      return false;
    }
  }

  /**
   * Refresh user data
   */
  async refreshUserData(): Promise<LastFmUser | null> {
    try {
      if (!this.isAuthenticated()) {
        return null;
      }

      const user = await this.api.getUserInfo();
      await this.saveUser(user);
      return user;
    } catch (error) {
      log('error', 'Failed to refresh user data:', error);
      return null;
    }
  }

  /**
   * Get API instance for making requests
   */
  getApi(): LastFmApi {
    return this.api;
  }
}
