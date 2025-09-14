/**
 * Content script for YouTube Music integration
 */

import { YouTubeMusicTrack, Track, Message } from '../shared/types';
import { YOUTUBE_MUSIC_SELECTORS, MESSAGE_TYPES } from '../shared/constants';
import { convertYouTubeTrack, isSameTrack, log, debug, info, warn, error, logTrackDetection, debounce } from '../shared/utils';

export class YouTubeMusicDetector {
  private currentTrack: YouTubeMusicTrack | null = null;
  private lastScrobbledTrack: Track | null = null;
  private isPlaying: boolean = false;
  private playStartTime: number = 0;
  private observer: MutationObserver | null = null;
  private updateNowPlayingDebounced: (() => void) | null = null;

  constructor() {
    this.updateNowPlayingDebounced = debounce(() => this.updateNowPlaying(), 2000);
    this.initialize();
  }

  /**
   * Initialize the detector
   */
  private initialize(): void {
    debug('Initializing YouTube Music detector', {
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now()
    });
    
    // Start observing DOM changes
    this.startObserving();
    
    // Initial track detection
    this.detectCurrentTrack();
    
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
    });

    info('YouTube Music detector initialized successfully');
  }

  /**
   * Start observing DOM changes
   */
  private startObserving(): void {
    this.observer = new MutationObserver((mutations) => {
      let shouldCheck = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
          shouldCheck = true;
        }
      });
      
      if (shouldCheck) {
        this.detectCurrentTrack();
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  /**
   * Detect the currently playing track
   */
  private detectCurrentTrack(): void {
    try {
      debug('Starting track detection', {
        currentTrack: this.currentTrack ? {
          artist: this.currentTrack.artist,
          title: this.currentTrack.title,
          isPlaying: this.currentTrack.isPlaying
        } : null,
        timestamp: Date.now()
      });

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
            title: this.currentTrack.title
          } : null,
          newTrack: {
            artist: track.artist,
            title: track.title
          }
        });
        this.handleTrackChanged(track);
      } else if (this.currentTrack.isPlaying !== track.isPlaying) {
        debug('Play state changed', {
          track: `${track.artist} - ${track.title}`,
          wasPlaying: this.currentTrack.isPlaying,
          nowPlaying: track.isPlaying
        });
        this.handlePlayStateChanged(track);
      } else {
        debug('No significant changes detected', {
          track: `${track.artist} - ${track.title}`,
          isPlaying: track.isPlaying
        });
      }

      this.currentTrack = track;
    } catch (error) {
      error('Failed to detect current track', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        url: window.location.href
      });
    }
  }

  /**
   * Extract track information from the DOM
   */
  private extractTrackInfo(): YouTubeMusicTrack | null {
    try {
      // Get track title
      const titleElement = document.querySelector(YOUTUBE_MUSIC_SELECTORS.TRACK_TITLE);
      const title = titleElement?.textContent?.trim() || '';

      // Get artist name
      const artistElement = document.querySelector(YOUTUBE_MUSIC_SELECTORS.ARTIST_NAME);
      const artist = artistElement?.textContent?.trim() || '';

      // Get album name
      const albumElement = document.querySelector(YOUTUBE_MUSIC_SELECTORS.ALBUM_NAME);
      const album = albumElement?.textContent?.trim() || '';

      // Check if we have basic track info
      if (!title || !artist) {
        return null;
      }

      // Get duration
      const durationElement = document.querySelector(YOUTUBE_MUSIC_SELECTORS.DURATION);
      const durationText = durationElement?.textContent?.trim() || '0:00';
      const duration = this.parseDuration(durationText);

      // Get current time
      const currentTimeElement = document.querySelector(YOUTUBE_MUSIC_SELECTORS.CURRENT_TIME);
      const currentTimeText = currentTimeElement?.textContent?.trim() || '0:00';
      const currentTime = this.parseDuration(currentTimeText);

      // Check if playing
      const isPlaying = this.isCurrentlyPlaying();

      // Get thumbnail
      const thumbnailElement = document.querySelector(YOUTUBE_MUSIC_SELECTORS.ALBUM_ART) as HTMLImageElement;
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
    
    return (
      this.currentTrack.title !== newTrack.title ||
      this.currentTrack.artist !== newTrack.artist ||
      this.currentTrack.album !== newTrack.album
    );
  }

  /**
   * Handle track change
   */
  private handleTrackChanged(track: YouTubeMusicTrack): void {
    log('info', `Track changed: ${track.artist} - ${track.title}`);
    
    // Convert to our Track format
    const convertedTrack = convertYouTubeTrack(track);
    
    // Send track detected message
    this.sendMessage({
      type: MESSAGE_TYPES.TRACK_DETECTED,
      data: {
        track: convertedTrack,
        youtubeTrack: track,
      },
    });

    // Update now playing if track is playing
    if (track.isPlaying) {
      this.playStartTime = Date.now();
      this.updateNowPlayingDebounced?.();
    }
  }

  /**
   * Handle play state change
   */
  private handlePlayStateChanged(track: YouTubeMusicTrack): void {
    log('info', `Play state changed: ${track.isPlaying ? 'playing' : 'paused'}`);
    
    if (track.isPlaying) {
      this.playStartTime = Date.now();
      this.updateNowPlayingDebounced?.();
    } else {
      // Track was paused, check if we should scrobble
      this.checkForScrobble();
    }
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
    if (!this.currentTrack) return;

    const convertedTrack = convertYouTubeTrack(this.currentTrack);
    
    // Check if this is the same track we last scrobbled
    if (this.lastScrobbledTrack && isSameTrack(convertedTrack, this.lastScrobbledTrack)) {
      return;
    }

    // Send track ended message for scrobbling
    this.sendMessage({
      type: MESSAGE_TYPES.TRACK_ENDED,
      data: {
        track: convertedTrack,
        youtubeTrack: this.currentTrack,
        playDuration: this.currentTrack.currentTime,
      },
    });

    this.lastScrobbledTrack = convertedTrack;
  }

  /**
   * Update now playing status
   */
  private updateNowPlaying(): void {
    if (!this.currentTrack || !this.currentTrack.isPlaying) return;

    const convertedTrack = convertYouTubeTrack(this.currentTrack);
    
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
    // Check for play button (if visible, it means it's paused)
    const playButton = document.querySelector(YOUTUBE_MUSIC_SELECTORS.PLAY_BUTTON);
    const pauseButton = document.querySelector(YOUTUBE_MUSIC_SELECTORS.PAUSE_BUTTON);
    
    // If pause button is visible, it's playing
    if (pauseButton && (pauseButton as HTMLElement).offsetParent !== null) {
      return true;
    }
    
    // If play button is visible, it's paused
    if (playButton && (playButton as HTMLElement).offsetParent !== null) {
      return false;
    }

    // Fallback: check if we have track info and assume it's playing
    const hasTrackInfo = document.querySelector(YOUTUBE_MUSIC_SELECTORS.TRACK_TITLE)?.textContent?.trim();
    return !!hasTrackInfo;
  }

  /**
   * Parse duration string to seconds
   */
  private parseDuration(durationStr: string): number {
    const parts = durationStr.split(':').map(Number);
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
  }

  /**
   * Send message to background script
   */
  private sendMessage(message: Message): void {
    chrome.runtime.sendMessage(message).catch((error) => {
      log('error', 'Failed to send message:', error);
    });
  }

  /**
   * Handle messages from background script
   */
  private handleMessage(message: Message, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void): void {
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
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new YouTubeMusicDetector();
  });
} else {
  new YouTubeMusicDetector();
}
