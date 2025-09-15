/**
 * Content script for YouTube Music integration
 */

console.log('[Madrak] Content script loaded on:', window.location.href);

import { YouTubeMusicTrack, Track, Message } from '../shared/types';
import { YOUTUBE_MUSIC_SELECTORS, MESSAGE_TYPES } from '../shared/constants';
import { convertYouTubeTrack, isSameTrack, log, debug, info, debounce, getSettings } from '../shared/utils';
import { initializeLogger } from '../shared/logger';

export class YouTubeMusicDetector {
  private currentTrack: YouTubeMusicTrack | null = null;
  private lastScrobbledTrack: Track | null = null;
  private observer: MutationObserver | null = null;
  private updateNowPlayingDebounced: (() => void) | null = null;
  private detectTrackDebounced: (() => void) | null = null;
  private lastDetectionTime: number = 0;
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
    
    debug('Initializing YouTube Music detector', {
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now()
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

    info('YouTube Music detector initialized successfully');
  }

  /**
   * Start observing DOM changes
   */
  private startObserving(): void {
    if (!this.isExtensionContextValid()) {
      log('warn', 'Extension context invalidated, cannot start observing');
      return;
    }

    // Find the player bar element to observe more specifically
    const playerBar = document.querySelector('ytmusic-player-bar');
    if (!playerBar) {
      // Fallback to observing document body but with more restrictive settings
      this.observer = new MutationObserver((mutations) => {
        this.handleMutations(mutations);
      });

      this.observer.observe(document.body, {
        childList: true,
        subtree: false, // Only direct children, not all descendants
        characterData: false, // Disable character data observation
        attributes: false,
        attributeOldValue: false,
        characterDataOldValue: false
      });
    } else {
      // Observe only the player bar for better performance
      this.observer = new MutationObserver((mutations) => {
        this.handleMutations(mutations);
      });

      this.observer.observe(playerBar, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['state', 'class'] // Only observe specific attributes
      });
    }

    debug('Started observing DOM changes');
    
    // Run initial detection after a short delay
    setTimeout(() => {
      this.detectCurrentTrack();
    }, 2000);
  }

  /**
   * Handle DOM mutations with throttling
   */
  private handleMutations(mutations: MutationRecord[]): void {
    const now = Date.now();
    
    // Throttle detection calls
    if (now - this.lastDetectionTime < this.DETECTION_THROTTLE_MS) {
      return;
    }

    let shouldCheck = false;
    
    mutations.forEach((mutation) => {
      // Only check for relevant changes
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        shouldCheck = true;
      } else if (mutation.type === 'characterData') {
        // Only check if it's text content that might be track info
        const target = mutation.target as Text;
        if (target.textContent && target.textContent.trim().length > 0) {
          shouldCheck = true;
        }
      } else if (mutation.type === 'attributes') {
        // Check for play state changes
        const target = mutation.target as Element;
        if (target.getAttribute('state') || target.classList.contains('playing') || target.classList.contains('paused')) {
          shouldCheck = true;
        }
      }
    });
    
    if (shouldCheck) {
      this.lastDetectionTime = now;
      this.detectTrackDebounced?.();
    }
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
  private extractArtistName(): string {
    // Try multiple selectors for artist name
    const selectors = [
      'ytmusic-player-bar .byline .yt-simple-endpoint',
      'ytmusic-player-bar .byline a',
      'ytmusic-player-bar .byline .content-info-wrapper a',
      'ytmusic-player-bar .byline'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        let text = element.textContent?.trim() || '';
        
        // If we got the full byline, try to extract just the artist
        if (text.includes('•') || text.includes('–') || text.includes('-')) {
          // Split by common separators and take the first part (artist)
          const parts = text.split(/[•–-]/);
          if (parts.length > 0 && parts[0]) {
            text = parts[0].trim();
          }
        }
        
        // Clean up any extra whitespace or special characters
        text = text.replace(/\s+/g, ' ').trim();
        
        if (text && text.length > 0) {
          debug('✅ ARTIST EXTRACTED', { 
            selector, 
            rawText: `"${element.textContent?.trim() || ''}"`,
            parsedArtist: `"${text}"` 
          });
          return text;
        }
      }
    }
    
    debug('❌ NO ARTIST FOUND', { 
      triedSelectors: selectors,
      bylineElement: document.querySelector('ytmusic-player-bar .byline')?.textContent?.trim() || 'NOT FOUND'
    });
    return '';
  }

  /**
   * Extract album name with improved parsing
   */
  private extractAlbumName(): string {
    // Try multiple selectors for album name
    const selectors = [
      'ytmusic-player-bar .subtitle',
      'ytmusic-player-bar .byline .secondary-text',
      'ytmusic-player-bar .byline'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        let text = element.textContent?.trim() || '';
        
        // If we got the full byline, try to extract album info
        if (text.includes('•') || text.includes('–') || text.includes('-')) {
          // Split by common separators and take parts after the first (album/year)
          const parts = text.split(/[•–-]/);
          if (parts.length > 1) {
            // Join all parts after the first one (artist)
            text = parts.slice(1).join(' ').trim();
          }
        }
        
        // Clean up any extra whitespace or special characters
        text = text.replace(/\s+/g, ' ').trim();
        
        if (text && text.length > 0) {
          debug('✅ ALBUM EXTRACTED', { 
            selector, 
            rawText: `"${element.textContent?.trim() || ''}"`,
            parsedAlbum: `"${text}"` 
          });
          return text;
        }
      }
    }
    
    debug('❌ NO ALBUM FOUND', { 
      triedSelectors: selectors,
      subtitleElement: document.querySelector('ytmusic-player-bar .subtitle')?.textContent?.trim() || 'NOT FOUND',
      bylineElement: document.querySelector('ytmusic-player-bar .byline')?.textContent?.trim() || 'NOT FOUND'
    });
    return '';
  }

  /**
   * Extract year from album info
   */
  private extractYear(albumText: string): string {
    if (!albumText) return '';
    
    // Look for 4-digit year patterns in the album text
    const yearMatch = albumText.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      const year = yearMatch[0];
      debug('✅ YEAR EXTRACTED', { 
        fromAlbum: `"${albumText}"`,
        extractedYear: `"${year}"` 
      });
      return year;
    }
    
    // Also check the full byline for year info
    const bylineElement = document.querySelector('ytmusic-player-bar .byline');
    if (bylineElement) {
      const bylineText = bylineElement.textContent?.trim() || '';
      const bylineYearMatch = bylineText.match(/\b(19|20)\d{2}\b/);
      if (bylineYearMatch) {
        const year = bylineYearMatch[0];
        debug('✅ YEAR EXTRACTED FROM BYLINE', { 
          fromByline: `"${bylineText}"`,
          extractedYear: `"${year}"` 
        });
        return year;
      }
    }
    
    debug('❌ NO YEAR FOUND', { 
      albumText: `"${albumText}"`,
      bylineText: document.querySelector('ytmusic-player-bar .byline')?.textContent?.trim() || 'NOT FOUND'
    });
    return '';
  }

  /**
   * Extract track information from the DOM
   */
  private extractTrackInfo(): YouTubeMusicTrack | null {
    try {
      // Get track title
      const titleElement = document.querySelector(YOUTUBE_MUSIC_SELECTORS.TRACK_TITLE);
      const title = titleElement?.textContent?.trim() || '';

      // Get artist name with improved parsing
      let artist = this.extractArtistName();
      
      // Get album name with improved parsing
      let album = this.extractAlbumName();

      // Extract year from album info if available
      const year = this.extractYear(album);
      
      // Clean album name by removing the year if it was found
      if (year) {
        album = album.replace(/\b(19|20)\d{2}\b/g, '').replace(/\s+/g, ' ').trim();
      }
      
      // Log parsed track information with clear delimiters
      debug(`[ARTIST][TITLE][ALBUM][YEAR]`, {
        '[ARTIST]': `"${artist}"`,
        '[TITLE]': `"${title}"`,
        '[ALBUM]': `"${album}"`,
        '[YEAR]': `"${year}"`
      });

      // Check if we have basic track info
      if (!title || !artist) {
        debug('❌ INSUFFICIENT TRACK INFO - Missing title or artist', { 
          title: `"${title}"`, 
          artist: `"${artist}"` 
        });
        return null;
      }

      // Get duration with multiple fallback selectors
      let durationElement = document.querySelector(YOUTUBE_MUSIC_SELECTORS.DURATION);
      let durationText = durationElement?.textContent?.trim() || '';
      
      // If no duration found with primary selector, try fallbacks
      if (!durationText) {
        // Try alternative selectors for duration
        const fallbackSelectors = [
          'ytmusic-player-bar .time-info span:last-child',
          'ytmusic-player-bar .time-info .duration',
          'ytmusic-player-bar .time-info span[class*="duration"]',
          'ytmusic-player-bar [class*="duration"]',
          'ytmusic-player-bar .time-info',
          'ytmusic-player-bar'
        ];
        
        for (const selector of fallbackSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            const text = element.textContent?.trim() || '';
            // Look for time pattern in the text
            const timeMatch = text.match(/\d+:\d+/g);
            if (timeMatch && timeMatch.length > 0) {
              // If multiple times found, take the last one (usually duration)
              durationText = timeMatch[timeMatch.length - 1] || '';
              durationElement = element;
              break;
            }
          }
        }
      }
      
      const duration = this.parseDuration(durationText || '0:00');

      // Get current time with multiple fallback selectors
      let currentTimeElement = document.querySelector(YOUTUBE_MUSIC_SELECTORS.CURRENT_TIME);
      let currentTimeText = currentTimeElement?.textContent?.trim() || '';
      
      // If no current time found with primary selector, try fallbacks
      if (!currentTimeText) {
        // Try alternative selectors for current time
        const fallbackSelectors = [
          'ytmusic-player-bar .time-info span:first-child',
          'ytmusic-player-bar .time-info .current-time',
          'ytmusic-player-bar .time-info span[class*="current"]',
          'ytmusic-player-bar [class*="current"]',
          'ytmusic-player-bar .time-info',
          'ytmusic-player-bar'
        ];
        
        for (const selector of fallbackSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            const text = element.textContent?.trim() || '';
            // Look for time pattern in the text
            const timeMatch = text.match(/\d+:\d+/g);
            if (timeMatch && timeMatch.length > 0) {
              // If multiple times found, take the first one (usually current time)
              currentTimeText = timeMatch[0] || '';
              currentTimeElement = element;
              break;
            }
          }
        }
      }
      
      const currentTime = this.parseDuration(currentTimeText || '0:00');

      // Reduced debug logging for performance
      if (duration === 0 || currentTime === 0) {
        debug('Duration parsing - zero duration or current time', { 
          duration, 
          currentTime, 
          durationText, 
          currentTimeText 
        });
      }

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
    
    // If we had a previous track, scrobble it before handling the new track
    if (this.currentTrack) {
      debug('Track changed - scrobbling previous track', {
        previousTrack: {
          artist: this.currentTrack.artist,
          title: this.currentTrack.title,
          duration: this.currentTrack.duration,
          currentTime: this.currentTrack.currentTime
        }
      });
      this.checkForScrobble();
    }
    
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
      this.updateNowPlayingDebounced?.();
    }
  }

  /**
   * Handle play state change
   */
  private handlePlayStateChanged(track: YouTubeMusicTrack): void {
    log('info', `Play state changed: ${track.isPlaying ? 'playing' : 'paused'}`);
    
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

    const convertedTrack = convertYouTubeTrack(this.currentTrack);
    
    debug('checkForScrobble: Checking if track should be scrobbled', {
      track: {
        artist: convertedTrack.artist,
        title: convertedTrack.title,
        duration: convertedTrack.duration,
        currentTime: this.currentTrack.currentTime
      },
      lastScrobbledTrack: this.lastScrobbledTrack ? {
        artist: this.lastScrobbledTrack.artist,
        title: this.lastScrobbledTrack.title
      } : null
    });
    
    // Check if this is the same track we last scrobbled
    if (this.lastScrobbledTrack && isSameTrack(convertedTrack, this.lastScrobbledTrack)) {
      debug('checkForScrobble: Track already scrobbled, skipping');
      return;
    }

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

    this.lastScrobbledTrack = convertedTrack;
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
    // Check for play button (if visible, it means it's paused)
    const playButton = document.querySelector(YOUTUBE_MUSIC_SELECTORS.PLAY_BUTTON);
    const pauseButton = document.querySelector(YOUTUBE_MUSIC_SELECTORS.PAUSE_BUTTON);
    
    // Reduced debug logging for performance
    debug('Play state detection');
    
    // If pause button is visible, it's playing
    if (pauseButton && (pauseButton as HTMLElement).offsetParent !== null) {
      debug('Detected playing state via pause button');
      return true;
    }
    
    // If play button is visible, it's paused
    if (playButton && (playButton as HTMLElement).offsetParent !== null) {
      debug('Detected paused state via play button');
      return false;
    }

    // Try alternative detection methods
    const allPlayButtons = document.querySelectorAll('ytmusic-play-button-renderer');
    debug('Alternative play state detection');

    // Check for any play button with state="playing" that's visible
    for (const button of allPlayButtons) {
      const state = button.getAttribute('state');
      const isVisible = (button as HTMLElement).offsetParent !== null;
      if (state === 'playing' && isVisible) {
        debug('Detected playing state via alternative method');
        return true;
      }
      if (state === 'paused' && isVisible) {
        debug('Detected paused state via alternative method');
        return false;
      }
    }

    // Fallback: check if we have track info and assume it's playing
    const trackTitle = document.querySelector(YOUTUBE_MUSIC_SELECTORS.TRACK_TITLE);
    const hasTrackInfo = trackTitle?.textContent?.trim();
    const fallbackResult = !!hasTrackInfo;
    
    debug('Using fallback play state detection');
    
    return fallbackResult;
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
      
      debug('Parsed duration (MM:SS)');
      
      return totalSeconds;
    } else if (parts.length === 3) {
      // HH:MM:SS format
      const hours = parts[0] || 0;
      const minutes = parts[1] || 0;
      const seconds = parts[2] || 0;
      const totalSeconds = hours * 3600 + minutes * 60 + seconds;
      
      debug('Parsed duration (HH:MM:SS)');
      
      return totalSeconds;
    } else if (parts.length === 1) {
      // Just seconds
      const seconds = parts[0] || 0;
      
      debug('Parsed duration (seconds only)');
      
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
