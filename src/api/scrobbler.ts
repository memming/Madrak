/**
 * Scrobbling functionality
 */

import { Track, ScrobbleData, ScrobbleQueueItem, ExtensionSettings } from '../shared/types';
import { STORAGE_KEYS, SCROBBLE_STATUS, LASTFM_CONSTANTS } from '../shared/constants';
import { 
  isTrackLongEnough, 
  hasPlayedEnough, 
  createScrobbleData, 
  sanitizeTrack,
  log,
  debug,
  info,
  warn,
  error,
  logScrobbleAttempt,
  sleep 
} from '../shared/utils';
import { LastFmApi } from './lastfm-api';

export class Scrobbler {
  private api: LastFmApi;
  private scrobbleQueue: ScrobbleQueueItem[] = [];
  private isProcessing: boolean = false;
  private settings: ExtensionSettings;

  constructor(api: LastFmApi, settings: ExtensionSettings) {
    this.api = api;
    this.settings = settings;
  }

  /**
   * Initialize the scrobbler
   */
  async initialize(): Promise<void> {
    try {
      await this.loadScrobbleQueue();
      log('info', 'Scrobbler initialized');
    } catch (error) {
      log('error', 'Failed to initialize scrobbler:', error);
    }
  }

  /**
   * Update settings
   */
  updateSettings(settings: ExtensionSettings): void {
    this.settings = settings;
  }

  /**
   * Check if a track should be scrobbled
   */
  shouldScrobble(track: Track, currentTime: number): boolean {
    debug('Checking if track should be scrobbled', {
      track: {
        artist: track.artist,
        title: track.title,
        album: track.album,
        duration: track.duration
      },
      currentTime,
      settings: {
        isEnabled: this.settings.isEnabled,
        autoScrobble: this.settings.autoScrobble,
        minTrackLength: this.settings.minTrackLength,
        scrobbleThreshold: this.settings.scrobbleThreshold
      },
      isAuthenticated: this.api.isAuthenticated()
    });

    // Check if scrobbling is enabled
    if (!this.settings.isEnabled || !this.settings.autoScrobble) {
      debug('Scrobbling disabled', {
        isEnabled: this.settings.isEnabled,
        autoScrobble: this.settings.autoScrobble
      });
      return false;
    }

    // Check if user is authenticated
    if (!this.api.isAuthenticated()) {
      debug('User not authenticated, cannot scrobble');
      return false;
    }

    // Check minimum track length
    if (!isTrackLongEnough(track, this.settings.minTrackLength)) {
      debug('Track too short to scrobble', {
        trackDuration: track.duration,
        minRequired: this.settings.minTrackLength,
        track: `${track.artist} - ${track.title}`
      });
      return false;
    }

    // Check if enough of the track has been played
    const playedPercentage = track.duration ? (currentTime / track.duration) * 100 : 0;
    if (!hasPlayedEnough(currentTime, track.duration || 0, this.settings.scrobbleThreshold)) {
      debug('Not enough of track played yet', {
        currentTime,
        duration: track.duration,
        playedPercentage: playedPercentage.toFixed(1) + '%',
        requiredPercentage: this.settings.scrobbleThreshold + '%',
        track: `${track.artist} - ${track.title}`
      });
      return false;
    }

    debug('Track meets all scrobbling criteria', {
      track: `${track.artist} - ${track.title}`,
      playedPercentage: playedPercentage.toFixed(1) + '%',
      duration: track.duration
    });

    return true;
  }

  /**
   * Add a track to the scrobble queue
   */
  async queueScrobble(track: Track): Promise<void> {
    try {
      debug('Starting scrobble queue process', {
        originalTrack: {
          artist: track.artist,
          title: track.title,
          album: track.album,
          duration: track.duration,
          timestamp: track.timestamp
        }
      });

      const sanitizedTrack = sanitizeTrack(track);
      const scrobbleData = createScrobbleData(sanitizedTrack);

      debug('Track sanitized and prepared for scrobbling', {
        sanitizedTrack: {
          artist: sanitizedTrack.artist,
          title: sanitizedTrack.title,
          album: sanitizedTrack.album,
          duration: sanitizedTrack.duration,
          timestamp: sanitizedTrack.timestamp
        },
        scrobbleData: {
          artist: scrobbleData.artist,
          title: scrobbleData.title,
          album: scrobbleData.album,
          duration: scrobbleData.duration,
          timestamp: scrobbleData.timestamp
        }
      });

      const queueItem: ScrobbleQueueItem = {
        track: {
          ...scrobbleData,
          timestamp: scrobbleData.timestamp || Math.floor(Date.now() / 1000)
        },
        timestamp: scrobbleData.timestamp || Math.floor(Date.now() / 1000),
        retryCount: 0,
        id: Math.random().toString(36).substr(2, 9),
      };

      debug('Created queue item', {
        queueItemId: queueItem.id,
        track: `${scrobbleData.artist} - ${scrobbleData.title}`,
        timestamp: scrobbleData.timestamp,
        currentQueueSize: this.scrobbleQueue.length
      });

      // Check if this track is already in the queue
      const existingItem = this.scrobbleQueue.find(
        item => item.track.artist === scrobbleData.artist && 
                item.track.title === scrobbleData.title &&
                Math.abs(item.timestamp - scrobbleData.timestamp) < 60 // Within 1 minute
      );

      if (existingItem) {
        debug('Track already in queue, skipping duplicate', {
          existingItemId: existingItem.id,
          track: `${scrobbleData.artist} - ${scrobbleData.title}`,
          timeDifference: Math.abs(existingItem.timestamp - scrobbleData.timestamp)
        });
        return;
      }

      this.scrobbleQueue.push(queueItem);
      await this.saveScrobbleQueue();

      info(`Queued scrobble: ${scrobbleData.artist} - ${scrobbleData.title}`, {
        queueItemId: queueItem.id,
        queueSize: this.scrobbleQueue.length,
        track: scrobbleData
      });
      
      // Process the queue
      this.processQueue();
    } catch (err) {
      error('Failed to queue scrobble', {
        track: {
          artist: track.artist,
          title: track.title,
          album: track.album
        },
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      });
    }
  }

  /**
   * Process the scrobble queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.scrobbleQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.scrobbleQueue.length > 0) {
        const item = this.scrobbleQueue.shift();
        if (!item) break;

        try {
          await this.sendScrobble(item);
          log('info', `Successfully scrobbled: ${item.track.artist} - ${item.track.title}`);
        } catch (error) {
          log('error', `Failed to scrobble: ${item.track.artist} - ${item.track.title}`, error);
          
          // Retry logic
          if (item.retryCount < LASTFM_CONSTANTS.MAX_RETRIES) {
            item.retryCount++;
            this.scrobbleQueue.unshift(item); // Put back at the front
            await sleep(LASTFM_CONSTANTS.RETRY_DELAY * item.retryCount);
          } else {
            log('error', `Max retries exceeded for: ${item.track.artist} - ${item.track.title}`);
          }
        }

        // Rate limiting
        await sleep(200); // 200ms between requests
      }

      await this.saveScrobbleQueue();
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Send a scrobble to Last.fm
   */
  private async sendScrobble(item: ScrobbleQueueItem): Promise<void> {
    try {
      const response = await this.api.scrobble([item.track]);
      
      if (response.scrobbles['@attr'].accepted === 0) {
        throw new Error('No scrobbles were accepted');
      }

      // Update last scrobble time
      await this.updateLastScrobbleTime();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update now playing status
   */
  async updateNowPlaying(track: Track): Promise<void> {
    try {
      if (!this.api.isAuthenticated()) {
        return;
      }

      const sanitizedTrack = sanitizeTrack(track);
      await this.api.updateNowPlaying(sanitizedTrack);
      log('info', `Updated now playing: ${sanitizedTrack.artist} - ${sanitizedTrack.title}`);
    } catch (error) {
      log('error', 'Failed to update now playing:', error);
    }
  }

  /**
   * Get scrobble queue
   */
  getQueue(): ScrobbleQueueItem[] {
    return [...this.scrobbleQueue];
  }

  /**
   * Clear scrobble queue
   */
  async clearQueue(): Promise<void> {
    this.scrobbleQueue = [];
    await this.saveScrobbleQueue();
    log('info', 'Scrobble queue cleared');
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): { total: number; pending: number; failed: number } {
    const total = this.scrobbleQueue.length;
    const failed = this.scrobbleQueue.filter(item => item.retryCount > 0).length;
    const pending = total - failed;

    return { total, pending, failed };
  }

  /**
   * Load scrobble queue from storage
   */
  private async loadScrobbleQueue(): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get([STORAGE_KEYS.SCROBBLE_QUEUE], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          this.scrobbleQueue = result[STORAGE_KEYS.SCROBBLE_QUEUE] || [];
          resolve();
        }
      });
    });
  }

  /**
   * Save scrobble queue to storage
   */
  private async saveScrobbleQueue(): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [STORAGE_KEYS.SCROBBLE_QUEUE]: this.scrobbleQueue }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Update last scrobble time
   */
  private async updateLastScrobbleTime(): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [STORAGE_KEYS.LAST_SCROBBLE]: Date.now() }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Get last scrobble time
   */
  async getLastScrobbleTime(): Promise<number | null> {
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
   * Check if scrobbling is working properly
   */
  async healthCheck(): Promise<{ isHealthy: boolean; issues: string[] }> {
    const issues: string[] = [];

    // Check authentication
    if (!this.api.isAuthenticated()) {
      issues.push('Not authenticated with Last.fm');
    }

    // Check settings
    if (!this.settings.isEnabled) {
      issues.push('Scrobbling is disabled');
    }

    // Check queue size
    if (this.scrobbleQueue.length > 100) {
      issues.push('Scrobble queue is very large');
    }

    // Check last scrobble time
    const lastScrobble = await this.getLastScrobbleTime();
    if (lastScrobble && Date.now() - lastScrobble > 24 * 60 * 60 * 1000) {
      issues.push('No scrobbles in the last 24 hours');
    }

    return {
      isHealthy: issues.length === 0,
      issues,
    };
  }
}
