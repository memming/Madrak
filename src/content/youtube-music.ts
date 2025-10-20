/**
 * Content script for YouTube Music integration
 */

console.log(`[${EXTENSION_NAME}] v${EXTENSION_VERSION} - Content script loaded on:`, window.location.href);

import { YouTubeMusicTrack, Message } from '../shared/types';
import { YOUTUBE_MUSIC_SELECTORS, MESSAGE_TYPES, STORAGE_KEYS, EXTENSION_NAME, EXTENSION_VERSION } from '../shared/constants';
import { convertYouTubeTrack, log, debug, info, debounce, getSettings } from '../shared/utils';
import { initializeLogger } from '../shared/logger';

export class YouTubeMusicDetector {
  private currentTrack: YouTubeMusicTrack | null = null;
  private observer: MutationObserver | null = null;
  private updateNowPlayingDebounced: (() => void) | null = null;
  private detectTrackDebounced: (() => void) | null = null;
  private lastDetectionTime: number = 0;
  private scrobbleSubmitted: boolean = false; // Add this line
  private readonly DETECTION_THROTTLE_MS = 1000; // Minimum 1 second between detections

  constructor() {
    this.updateNowPlayingDebounced = debounce(() => this.updateNowPlaying(), 2000);
    this.detectTrackDebounced = debounce(() => this.detectCurrentTrack(), 500);
    this.initialize().catch(error => {
      console.error('[Madrak] Failed to initialize detector:', error);
    });
  }

  /**
   * Initialize the detector
   */
  private async initialize(): Promise<void> {
    // Initialize logger first
    try {
      const settings = await getSettings();
      initializeLogger(settings);
      debug('Logger initialized with settings', {
        debugMode: settings.debugMode,
        logLevel: settings.logLevel
      });
    } catch (error) {
      console.error('[Madrak] Failed to initialize logger:', error);
    }
    
    debug(`🎵 ${EXTENSION_NAME} v${EXTENSION_VERSION} - Initializing YouTube Music detector`, {
      version: EXTENSION_VERSION,
      name: EXTENSION_NAME,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    });
    
    // Check if extension context is valid
    if (!this.isExtensionContextValid()) {
      log('warn', 'Extension context invalidated, skipping initialization');
      return;
    }
    
    // Start observing DOM changes
    this.startObserving();
    
    // Initial track detection
    this.detectCurrentTrack();
    
    // Listen for messages from background script
    try {
      chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
        this.handleMessage(message, sender, sendResponse);
      });
    } catch (error) {
      log('error', 'Failed to set up message listener:', error);
      return;
    }

    // Listen for storage changes
    try {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'sync' && changes[STORAGE_KEYS.SETTINGS]) {
          const settingsChange = changes[STORAGE_KEYS.SETTINGS];
          if (settingsChange && settingsChange.newValue) {
            const newSettings = settingsChange.newValue;
            initializeLogger(newSettings);
            debug('Logger re-initialized after settings change from storage.', {
              debugMode: newSettings.debugMode,
              logLevel: newSettings.logLevel,
            });
          }
        }
      });
    } catch (error) {
      log('error', 'Failed to set up storage change listener:', error);
    }

    info(`✅ ${EXTENSION_NAME} v${EXTENSION_VERSION} - YouTube Music detector initialized successfully`, {
      version: EXTENSION_VERSION,
      url: window.location.href
    });
  }

  /**
   * Start observing DOM changes
   */
  private startObserving(): void {
    if (!this.isExtensionContextValid()) {
      log('warn', 'Extension context invalidated, cannot start observing');
      return;
    }

    const playerBar = document.querySelector('ytmusic-player-bar');
    if (!playerBar) {
      // If the player bar isn't available, retry after a short delay.
      // This handles cases where the content script loads before the full page is ready.
      setTimeout(() => this.startObserving(), 1000);
      return;
    }

    this.observer = new MutationObserver(() => this.detectTrackDebounced?.());
    this.observer.observe(playerBar, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['state', 'play-button-state', 'class', 'aria-label', 'title', 'value'],
    });

    debug('Started observing DOM changes on the player bar');
    
    // Initial detection after a short delay
    setTimeout(() => this.detectCurrentTrack(), 2000);
  }

  /**
   * Detect the currently playing track
   */
  private detectCurrentTrack(): void {
    try {
      // Reduced debug logging for performance
      debug('Starting track detection');

      const track = this.extractTrackInfo();
      
      if (!track) {
        debug('No track detected, handling track end');
        this.handleTrackEnded();
        return;
      }

      debug('Track extracted from DOM', {
        extractedTrack: {
          artist: track.artist,
          title: track.title,
          album: track.album,
          duration: track.duration,
          currentTime: track.currentTime,
          isPlaying: track.isPlaying
        }
      });

      // Check if track has changed
      if (!this.currentTrack || this.hasTrackChanged(track)) {
        debug('Track changed detected', {
          previousTrack: this.currentTrack ? {
            artist: this.currentTrack.artist,
            title: this.currentTrack.title,
            isPlaying: this.currentTrack.isPlaying
          } : null,
          newTrack: {
            artist: track.artist,
            title: track.title,
            isPlaying: track.isPlaying
          }
        });
        this.handleTrackChanged(track);
      } else if (this.currentTrack.isPlaying !== track.isPlaying) {
        debug('Play state changed', {
          track: `${track.artist} - ${track.title}`,
          wasPlaying: this.currentTrack.isPlaying,
          nowPlaying: track.isPlaying,
          previousTrack: this.currentTrack,
          newTrack: track
        });
        this.handlePlayStateChanged(track);
      } else {
        debug('No significant changes detected', {
          track: `${track.artist} - ${track.title}`,
          isPlaying: track.isPlaying,
          currentTrack: this.currentTrack,
          newTrack: track
        });
      }

      this.currentTrack = track;
    } catch (err) {
      log('error', 'Failed to detect current track', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        url: window.location.href
      });
    }
  }

  /**
   * Extract artist name with improved parsing
   */
  private extractArtistAlbumYear(bylineText: string): { artist: string; album: string; year: string } {
    if (!bylineText) {
      return { artist: '', album: '', year: '' };
    }

    const parts = bylineText.split('•').map(part => part.trim());
    const artist = parts[0] || '';
    let album = '';
    let year = '';

    if (parts.length > 1) {
      const remainingParts = parts.slice(1);
      const yearMatch = remainingParts.find(part => /\b(19|20)\d{2}\b/.test(part));
      if (yearMatch) {
        year = yearMatch;
        album = remainingParts.filter(part => part !== yearMatch).join(' ').trim();
      } else {
        album = remainingParts.join(' ').trim();
      }
    }
    
    return { artist, album, year };
  }

  /**
   * Extract track information from the DOM
   */
  private extractTrackInfo(): YouTubeMusicTrack | null {
    try {
      const playerBar = document.querySelector('ytmusic-player-bar');
      if (!playerBar) {
        return null; // Player bar not found, no track info to extract
      }

      const titleElement = playerBar.querySelector(YOUTUBE_MUSIC_SELECTORS.TRACK_TITLE);
      const title = titleElement?.textContent?.trim() || '';

      const bylineElement = playerBar.querySelector('.byline');
      const bylineText = bylineElement?.textContent?.trim() || '';
      
      // Simplified extraction logic for artist, album, and year
      const { artist, album, year } = this.extractArtistAlbumYear(bylineText);

      if (!title || !artist) {
        debug('❌ INSUFFICIENT TRACK INFO - Missing title or artist', { title: `"${title}"`, artist: `"${artist}"` });
        return null;
      }
      
      const timeInfoElement = playerBar.querySelector('.time-info');
      const timeInfoText = timeInfoElement?.textContent?.trim() || '';
      const [currentTimeText, durationText] = timeInfoText.split('/').map(s => s.trim());
      
      const currentTime = this.parseDuration(currentTimeText || '0:00');
      const duration = this.parseDuration(durationText || '0:00');
      
      const isPlaying = this.isCurrentlyPlaying();
      const thumbnailElement = playerBar.querySelector(YOUTUBE_MUSIC_SELECTORS.ALBUM_ART) as HTMLImageElement;
      const thumbnail = thumbnailElement?.src || '';

      return {
        title,
        artist,
        album: album || undefined,
        duration,
        currentTime,
        isPlaying,
        thumbnail: thumbnail || undefined,
      };
    } catch (error) {
      log('error', 'Failed to extract track info:', error);
      return null;
    }
  }

  /**
   * Check if a track has changed
   */
  private hasTrackChanged(newTrack: YouTubeMusicTrack): boolean {
    if (!this.currentTrack) return true;

    const isDifferentTrack =
      this.currentTrack.title !== newTrack.title ||
      this.currentTrack.artist !== newTrack.artist ||
      this.currentTrack.album !== newTrack.album;

    if (isDifferentTrack) {
      debug('Track changed based on metadata (artist, title, or album)');
      return true;
    }

    // If the same track is being played again, it's a change.
    // This is detected by a significant jump backwards in time (e.g. replay or seek).
    // A threshold of 5 seconds is used to avoid minor fluctuations.
    if (newTrack.isPlaying && this.currentTrack.currentTime > newTrack.currentTime + 5) {
      debug('Track replayed or seeked backwards', {
        previousTime: this.currentTrack.currentTime,
        newTime: newTrack.currentTime,
      });
      return true;
    }

    return false;
  }

  /**
   * Handle track change
   */
  private handleTrackChanged(track: YouTubeMusicTrack): void {
    log('info', `Track changed: ${track.artist} - ${track.title}`);
    this.scrobbleSubmitted = false; // Reset the flag for the new track

    const newTrackData = {
      track: convertYouTubeTrack(track),
      youtubeTrack: track,
    };

    let endedTrackData = null;
    if (this.currentTrack) {
      const convertedOldTrack = convertYouTubeTrack(this.currentTrack);
      endedTrackData = {
        track: convertedOldTrack,
        youtubeTrack: this.currentTrack,
        playDuration: this.currentTrack.currentTime,
      };
    }

    this.sendMessage({
      type: 'TRACK_CHANGED',
      data: {
        newTrack: newTrackData,
        endedTrack: endedTrackData,
      },
    });

    // Update now playing if track is playing
    if (track.isPlaying) {
      this.updateNowPlayingDebounced?.();
    }
  }

  /**
   * Handle play state change
   */
  private handlePlayStateChanged(track: YouTubeMusicTrack): void {
    const wasPlaying = this.currentTrack?.isPlaying || false;
    const isNowPlaying = track.isPlaying;
    
    // Log specific pause/resume events
    if (wasPlaying && !isNowPlaying) {
      log('info', `⏸️ TRACK PAUSED: ${track.artist} - ${track.title}`, {
        currentTime: track.currentTime,
        duration: track.duration,
        playProgress: track.duration ? `${Math.round((track.currentTime / track.duration) * 100)}%` : 'unknown'
      });
    } else if (!wasPlaying && isNowPlaying) {
      log('info', `▶️ TRACK RESUMED: ${track.artist} - ${track.title}`, {
        currentTime: track.currentTime,
        duration: track.duration,
        playProgress: track.duration ? `${Math.round((track.currentTime / track.duration) * 100)}%` : 'unknown'
      });
    }
    
    log('info', `Play state changed: ${track.isPlaying ? 'playing' : 'paused'}`);
    
    // Update the background script with the new play state
    const convertedTrack = convertYouTubeTrack(track);
    this.sendMessage({
      type: MESSAGE_TYPES.TRACK_DETECTED,
      data: {
        track: convertedTrack,
        youtubeTrack: track,
        isNowPlaying: false, // Don't update Last.fm "Now Playing" on pause/resume
      },
    });
    
    if (track.isPlaying) {
      this.updateNowPlayingDebounced?.();
    }
    // Note: We don't scrobble when paused - only when track changes or ends
  }

  /**
   * Handle track ended
   */
  private handleTrackEnded(): void {
    if (this.currentTrack) {
      log('info', 'Track ended');
      this.checkForScrobble();
      this.currentTrack = null;
    }
  }

  /**
   * Check if we should scrobble the current track
   */
  private checkForScrobble(): void {
    if (!this.currentTrack) {
      debug('checkForScrobble: No current track to scrobble');
      return;
    }

    if (this.scrobbleSubmitted) {
      debug('checkForScrobble: Scrobble already submitted for this track');
      return;
    }

    this.scrobbleSubmitted = true;
    const convertedTrack = convertYouTubeTrack(this.currentTrack);
    
    debug('checkForScrobble: Sending TRACK_ENDED message for scrobbling', {
      track: {
        artist: convertedTrack.artist,
        title: convertedTrack.title,
        duration: convertedTrack.duration,
        playDuration: this.currentTrack.currentTime
      }
    });

    // Send track ended message for scrobbling
    this.sendMessage({
      type: MESSAGE_TYPES.TRACK_ENDED,
      data: {
        track: convertedTrack,
        youtubeTrack: this.currentTrack,
        playDuration: this.currentTrack.currentTime,
      },
    });
  }

  /**
   * Update now playing status
   */
  private updateNowPlaying(): void {
    debug('updateNowPlaying called', {
      hasCurrentTrack: !!this.currentTrack,
      isPlaying: this.currentTrack?.isPlaying,
      track: this.currentTrack ? {
        artist: this.currentTrack.artist,
        title: this.currentTrack.title,
        isPlaying: this.currentTrack.isPlaying
      } : null
    });

    if (!this.currentTrack || !this.currentTrack.isPlaying) {
      debug('updateNowPlaying: Skipping - no track or not playing');
      return;
    }

    const convertedTrack = convertYouTubeTrack(this.currentTrack);
    
    debug('Sending now playing update to background', {
      track: {
        artist: convertedTrack.artist,
        title: convertedTrack.title,
        album: convertedTrack.album,
        duration: convertedTrack.duration
      }
    });
    
    this.sendMessage({
      type: MESSAGE_TYPES.TRACK_DETECTED,
      data: {
        track: convertedTrack,
        youtubeTrack: this.currentTrack,
        isNowPlaying: true,
      },
    });
  }

  /**
   * Check if music is currently playing
   */
  private isCurrentlyPlaying(): boolean {
    const playPauseButton = document.querySelector('#play-pause-button');
    return playPauseButton?.getAttribute('aria-label') === 'Pause';
  }

  /**
   * Parse duration string to seconds
   */
  private parseDuration(durationStr: string): number {
    if (!durationStr || durationStr.trim() === '') {
      return 0;
    }
    
    // Clean the string - remove any non-numeric characters except colons
    const cleaned = durationStr.replace(/[^\d:]/g, '').trim();
    
    if (!cleaned) {
      return 0;
    }
    
    const parts = cleaned.split(':').map(Number);
    
    // Handle different time formats
    if (parts.length === 2) {
      // MM:SS format
      const minutes = parts[0] || 0;
      const seconds = parts[1] || 0;
      const totalSeconds = minutes * 60 + seconds;
      return totalSeconds;
    } else if (parts.length === 3) {
      // HH:MM:SS format
      const hours = parts[0] || 0;
      const minutes = parts[1] || 0;
      const seconds = parts[2] || 0;
      const totalSeconds = hours * 3600 + minutes * 60 + seconds;
      return totalSeconds;
    } else if (parts.length === 1) {
      // Just seconds
      const seconds = parts[0] || 0;
      return seconds;
    }
    
    debug('Failed to parse duration');
    
    return 0;
  }

  /**
   * Check if extension context is valid
   */
  private isExtensionContextValid(): boolean {
    try {
      return !!(chrome && chrome.runtime && chrome.runtime.id);
    } catch (error) {
      return false;
    }
  }

  /**
   * Send message to background script
   */
  private sendMessage(message: Message): void {
    if (!this.isExtensionContextValid()) {
      log('warn', 'Extension context invalidated, cannot send message:', message.type);
      return;
    }

    try {
      chrome.runtime.sendMessage(message).catch((error) => {
        log('error', 'Failed to send message:', error);
      });
    } catch (error) {
      log('error', 'Failed to send message - extension context invalidated:', error);
    }
  }

  /**
   * Handle messages from background script
   */
  private handleMessage(message: Message, _sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void): void {
    if (!this.isExtensionContextValid()) {
      log('warn', 'Extension context invalidated, ignoring message:', message.type);
      sendResponse();
      return;
    }

    switch (message.type) {
      case MESSAGE_TYPES.SETTINGS_UPDATE:
        // Settings were updated, we might need to re-evaluate current track
        this.detectCurrentTrack();
        break;
      default:
        // Handle other message types if needed
        break;
    }
    
    sendResponse();
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}

// Initialize the detector when the script loads
let detector: YouTubeMusicDetector | null = null;

function initializeDetector() {
  try {
    console.log('[Madrak] Content script: Initializing YouTube Music detector');
    log('info', 'Content script: Initializing YouTube Music detector');
    detector = new YouTubeMusicDetector();
  } catch (error) {
    console.error('[Madrak] Content script: Failed to initialize detector:', error);
    log('error', 'Failed to initialize YouTube Music detector:', error);
  }
}

// Add global error handler for extension context invalidation
window.addEventListener('error', (event) => {
  if (event.error && event.error.message && event.error.message.includes('Extension context invalidated')) {
    log('warn', 'Extension context invalidated, cleaning up detector');
    if (detector) {
      detector.destroy();
      detector = null;
    }
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeDetector);
} else {
  initializeDetector();
}
