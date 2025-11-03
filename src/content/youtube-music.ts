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
  private lastTrackSnapshot: YouTubeMusicTrack | null = null; // Snapshot of last track state for scrobbling
  private intervalId: number | null = null;
  private timeUpdateIntervalId: number | null = null;
  private updateNowPlayingDebounced: (() => void) | null = null;
  private lastTitle: string = '';
  private lastPlayerBarHTML: string = '';
  private scrobbleSubmitted: boolean = false;
  private lastTrackChangeTime: number = 0; // Track when last change occurred
  private lastChangedTrackId: string = ''; // Track the last changed track to prevent duplicates
  private contextInvalidated: boolean = false; // Track if extension context has been invalidated
  private readonly POLL_INTERVAL_MS = 10000; // Check title every 10 seconds (lightweight)
  private readonly TIME_UPDATE_INTERVAL_MS = 1000; // Update currentTime every 1 second (critical for accurate scrobbling)
  private readonly TRACK_CHANGE_COOLDOWN_MS = 2000; // Minimum 2 seconds between track changes

  constructor() {
    this.updateNowPlayingDebounced = debounce(() => this.updateNowPlaying(), 2000);
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
    
    // Start lightweight polling (no MutationObserver!)
    this.startPolling();
    
    // Initial track detection
    setTimeout(() => {
      this.detectCurrentTrack();
    }, 1000);
    
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
   * Start hybrid polling approach:
   * - Title checking every 10s (lightweight)
   * - Time updates every 1s (critical for accurate scrobbling)
   */
  private startPolling(): void {
    if (!this.isExtensionContextValid()) {
      this.handleContextInvalidation();
      return;
    }

    info('🚀 Starting hybrid polling: 10s title check + 1s time updates');
    
    // Main polling: Check for track changes every 10 seconds
    this.intervalId = window.setInterval(() => {
      this.checkForChanges();
    }, this.POLL_INTERVAL_MS);
    
    // Time update polling: Update currentTime every 1 second
    // This is lightweight (2 DOM queries) but critical for accurate scrobbling
    this.timeUpdateIntervalId = window.setInterval(() => {
      this.updateCurrentTime();
    }, this.TIME_UPDATE_INTERVAL_MS);
    
    debug(`✅ Polling intervals started: title check=${this.POLL_INTERVAL_MS}ms, time update=${this.TIME_UPDATE_INTERVAL_MS}ms`);
    
    // Pause polling when tab is hidden to save battery
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.intervalId !== null) {
          window.clearInterval(this.intervalId);
          this.intervalId = null;
        }
        if (this.timeUpdateIntervalId !== null) {
          window.clearInterval(this.timeUpdateIntervalId);
          this.timeUpdateIntervalId = null;
        }
        debug('⏸️ Polling paused - tab hidden');
      } else if (!document.hidden) {
        if (this.intervalId === null) {
          this.intervalId = window.setInterval(() => {
            this.checkForChanges();
          }, this.POLL_INTERVAL_MS);
        }
        if (this.timeUpdateIntervalId === null) {
          this.timeUpdateIntervalId = window.setInterval(() => {
            this.updateCurrentTime();
          }, this.TIME_UPDATE_INTERVAL_MS);
        }
        debug('▶️ Polling resumed - tab visible');
      }
    });
  }

  /**
   * Check for track changes by comparing document.title
   * Only runs full detection when title actually changes
   */
  private checkForChanges(): void {
    // Early exit if context invalidated
    if (this.contextInvalidated) {
      return;
    }
    
    try {
      const currentTitle = document.title;
      const playerBar = document.querySelector(YOUTUBE_MUSIC_SELECTORS.PLAYER_BAR);
      const currentPlayerBarHTML = playerBar ? playerBar.innerHTML : '';
      
      if (currentTitle !== this.lastTitle || currentPlayerBarHTML !== this.lastPlayerBarHTML) {
        debug('📝 Title or player bar changed, running full detection', {
          oldTitle: this.lastTitle,
          newTitle: currentTitle,
          titleChanged: currentTitle !== this.lastTitle,
          playerBarChanged: currentPlayerBarHTML !== this.lastPlayerBarHTML
        });
        this.lastTitle = currentTitle;
        this.lastPlayerBarHTML = currentPlayerBarHTML;
        this.detectCurrentTrack();
      }
    } catch (error) {
      debug('Error checking for changes:', error);
    }
  }
  
  /**
   * Update only the currentTime for the current track
   * This is lightweight but runs more frequently (1s)
   * Critical for accurate scrobbling playDuration
   * Also checks for track changes to catch them faster than title polling
   */
  private updateCurrentTime(): void {
    // Early exit if context invalidated
    if (this.contextInvalidated) {
      return;
    }
    
    if (!this.currentTrack) {
      debug('⏱️ Time update skipped - no current track');
      return; // No track playing yet
    }
    
    try {
      // Quick check: did the title change? (lightweight, just check document.title)
      const currentTitle = document.title;
      if (currentTitle !== this.lastTitle) {
        debug('⚡ Title changed detected during time update - triggering full detection', {
          oldTitle: this.lastTitle,
          newTitle: currentTitle
        });
        this.lastTitle = currentTitle;
        this.detectCurrentTrack();
        return; // Full detection will handle everything
      }
      
      // Lightweight update: only get currentTime and isPlaying
      let currentTimeText = '';
      const currentTimeElement = document.querySelector(YOUTUBE_MUSIC_SELECTORS.CURRENT_TIME);
      
      if (currentTimeElement?.textContent?.trim()) {
        currentTimeText = currentTimeElement.textContent.trim();
      } else {
        // Fallback
        const timeInfoElement = document.querySelector('ytmusic-player-bar .time-info');
        if (timeInfoElement) {
          const timeMatches = timeInfoElement.textContent?.match(/\d+:\d+/g);
          if (timeMatches && timeMatches.length >= 1 && timeMatches[0]) {
            currentTimeText = timeMatches[0];
          }
        }
      }
      
      const currentTime = this.parseDuration(currentTimeText || '0:00');
      const isPlaying = this.isCurrentlyPlaying();
      
      // CRITICAL FIX: Verify the time makes sense before updating
      // If currentTime jumped backwards significantly (>5s), the track likely changed
      // Trigger full detection to handle it properly
      if (this.currentTrack.currentTime > 0 && 
          currentTime < this.currentTrack.currentTime - 5) {
        debug('⚠️ Time jumped backwards - likely track changed, triggering detection', {
          oldTime: this.currentTrack.currentTime,
          newTime: currentTime,
          track: `${this.currentTrack.artist} - ${this.currentTrack.title}`
        });
        this.detectCurrentTrack();
        return; // Let full detection handle it
      }
      
      // Only update if time is reasonable (not jumped too far forward either)
      // Allow some tolerance for seeks but prevent corruption from new track
      if (this.currentTrack.currentTime > 0 && 
          currentTime > this.currentTrack.currentTime + 30) {
        debug('⚠️ Time jumped forward significantly - possible seek or track change, triggering detection', {
          oldTime: this.currentTrack.currentTime,
          newTime: currentTime,
          track: `${this.currentTrack.artist} - ${this.currentTrack.title}`
        });
        this.detectCurrentTrack();
        return; // Let full detection handle it
      }
      
      // Update only time-related fields
      this.currentTrack.currentTime = currentTime;
      this.currentTrack.isPlaying = isPlaying;
      
      // CRITICAL: Take a snapshot for scrobbling purposes
      // This preserves the accurate state even if track changes before we detect it
      this.lastTrackSnapshot = {
        ...this.currentTrack,
        currentTime: currentTime,
        isPlaying: isPlaying
      };
      
      // Use debug level to avoid console spam
      debug('⏱️ Time update', {
        track: `${this.currentTrack.artist} - ${this.currentTrack.title}`,
        currentTime,
        duration: this.currentTrack.duration,
        percentPlayed: this.currentTrack.duration > 0 
          ? Math.round((currentTime / this.currentTrack.duration) * 100) 
          : 0,
        isPlaying
      });
    } catch (error) {
      log('error', 'Error updating current time:', error);
    }
  }

  /**
   * Detect the currently playing track
   */
  private detectCurrentTrack(): void {
    try {
      const track = this.extractTrackInfo();
      
      if (!track) {
        this.handleTrackEnded();
        return;
      }

      // Check if track has changed
      const trackHasChanged = !this.currentTrack || this.hasTrackChanged(track);
      
      if (trackHasChanged) {
        this.handleTrackChanged(track);
      } else if (this.currentTrack && this.currentTrack.isPlaying !== track.isPlaying) {
        this.handlePlayStateChanged(track);
      } else {
        // Track unchanged but update state (especially currentTime for scrobbling)
        debug('Track state update', {
          track: `${track.artist} - ${track.title}`,
          currentTime: track.currentTime,
          duration: track.duration,
          isPlaying: track.isPlaying,
          percentPlayed: track.duration > 0 
            ? Math.round((track.currentTime / track.duration) * 100) 
            : 0
        });
      }

      // Always update currentTrack with latest state
      this.currentTrack = track;
      
      // Also update snapshot for same track (full detection has complete info)
      if (!trackHasChanged && this.currentTrack) {
        this.lastTrackSnapshot = { ...track };
      }
    } catch (err) {
      log('error', 'Failed to detect current track', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        url: window.location.href
      });
    }
  }

  /**
   * Extract artist name - simplified for performance
   */
  private extractArtistName(): string {
    // Use only the most reliable selector
    const element = document.querySelector('ytmusic-player-bar .byline .yt-simple-endpoint');
    if (!element) return '';
    
    let text = element.textContent?.trim() || '';
    
    // If we got the full byline, try to extract just the artist
    if (text.includes('•') || text.includes('–') || text.includes('-')) {
      const parts = text.split(/[•–-]/);
      if (parts.length > 0 && parts[0]) {
        text = parts[0].trim();
      }
    }
    
    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * Extract album name - simplified for performance
   */
  private extractAlbumName(): string {
    // Use only the most reliable selector
    const element = document.querySelector('ytmusic-player-bar .byline');
    if (!element) return '';
    
    let text = element.textContent?.trim() || '';
    
    // If we got the full byline, extract album info
    if (text.includes('•') || text.includes('–') || text.includes('-')) {
      const parts = text.split(/[•–-]/);
      if (parts.length > 1) {
        text = parts.slice(1).join(' ').trim();
      }
    }
    
    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * Extract year - simplified for performance
   */
  private extractYear(albumText: string): string {
    if (!albumText) return '';
    
    const yearMatch = albumText.match(/\b(19|20)\d{2}\b/);
    return yearMatch ? yearMatch[0] : '';
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

      // Check if we have basic track info
      if (!title || !artist) {
        return null;
      }

      // Get duration - with smart fallback
      let durationText = '';
      const durationElement = document.querySelector(YOUTUBE_MUSIC_SELECTORS.DURATION);
      
      if (durationElement?.textContent?.trim()) {
        durationText = durationElement.textContent.trim();
      } else {
        // Fallback: Look for time pattern in time-info area
        const timeInfoElement = document.querySelector('ytmusic-player-bar .time-info');
        if (timeInfoElement) {
          const timeMatches = timeInfoElement.textContent?.match(/\d+:\d+/g);
          if (timeMatches && timeMatches.length >= 2 && timeMatches[1]) {
            // Usually format is "currentTime / duration" or "currentTime duration"
            durationText = timeMatches[1]; // Take the second time as duration
          } else if (timeMatches && timeMatches.length === 1 && timeMatches[0]) {
            durationText = timeMatches[0];
          }
        }
      }
      
      const duration = this.parseDuration(durationText || '0:00');

      // Get current time - with smart fallback
      let currentTimeText = '';
      const currentTimeElement = document.querySelector(YOUTUBE_MUSIC_SELECTORS.CURRENT_TIME);
      
      if (currentTimeElement?.textContent?.trim()) {
        currentTimeText = currentTimeElement.textContent.trim();
      } else {
        // Fallback: Look for time pattern in time-info area
        const timeInfoElement = document.querySelector('ytmusic-player-bar .time-info');
        if (timeInfoElement) {
          const timeMatches = timeInfoElement.textContent?.match(/\d+:\d+/g);
          if (timeMatches && timeMatches.length >= 1 && timeMatches[0]) {
            // Take the first time as current time
            currentTimeText = timeMatches[0];
          }
        }
      }
      
      const currentTime = this.parseDuration(currentTimeText || '0:00');
      
      // Debug log time extraction
      debug('Time extraction:', {
        track: `${artist} - ${title}`,
        durationText,
        duration,
        currentTimeText,
        currentTime,
        durationElement: durationElement?.className,
        currentTimeElement: currentTimeElement?.className
      });

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
    // REMOVED: newTrack.isPlaying requirement - detect time jumps even when paused
    if (this.currentTrack.currentTime > newTrack.currentTime + 5) {
      debug('Track replayed or seeked backwards', {
        previousTime: this.currentTrack.currentTime,
        newTime: newTrack.currentTime,
      });
      return true;
    }

    // Detect if track has completed and restarted
    // If we were near the end (within 5 seconds) and now we're at the beginning (< 5 seconds)
    // ONLY if significant time has passed since last change (prevents double detection)
    const now = Date.now();
    const timeSinceLastChange = now - this.lastTrackChangeTime;
    
    if (this.currentTrack.duration > 0 && 
        this.currentTrack.currentTime >= this.currentTrack.duration - 5 &&
        newTrack.currentTime < 5 &&
        timeSinceLastChange > this.TRACK_CHANGE_COOLDOWN_MS) {
      debug('Track completed and restarted', {
        previousTime: this.currentTrack.currentTime,
        duration: this.currentTrack.duration,
        newTime: newTrack.currentTime,
        timeSinceLastChange,
      });
      return true;
    }

    return false;
  }

  /**
   * Handle track change
   */
  private handleTrackChanged(track: YouTubeMusicTrack): void {
    const now = Date.now();
    const timeSinceLastChange = now - this.lastTrackChangeTime;
    const trackId = `${track.artist}|${track.title}`;
    
    // ANTI-DOUBLE-SCROBBLE: Prevent duplicate track change events within cooldown period
    if (timeSinceLastChange < this.TRACK_CHANGE_COOLDOWN_MS && this.lastChangedTrackId === trackId) {
      debug('BLOCKED DUPLICATE: Track change event within cooldown period', {
        track: `${track.artist} - ${track.title}`,
        timeSinceLastChange,
        cooldownMs: this.TRACK_CHANGE_COOLDOWN_MS,
      });
      return;
    }
    
    log('info', `Track changed: ${track.artist} - ${track.title}`, {
      duration: track.duration,
      currentTime: track.currentTime,
      isPlaying: track.isPlaying
    });
    
    this.scrobbleSubmitted = false; // Reset the flag for the new track
    this.lastTrackChangeTime = now;
    this.lastChangedTrackId = trackId;

    const newTrackData = {
      track: convertYouTubeTrack(track),
      youtubeTrack: track,
    };

    let endedTrackData = null;
    // Use lastTrackSnapshot if available (most accurate), otherwise fall back to currentTrack
    const trackToScrobble = this.lastTrackSnapshot || this.currentTrack;
    
    if (trackToScrobble) {
      const convertedOldTrack = convertYouTubeTrack(trackToScrobble);
      
      // Use the snapshot's currentTime as playDuration - this is the most accurate
      // The snapshot was taken during the last time update (within 1 second)
      const playDuration = trackToScrobble.currentTime;
      
      endedTrackData = {
        track: convertedOldTrack,
        youtubeTrack: trackToScrobble,
        playDuration: playDuration,
      };
      
      log('info', `Previous track ended for scrobbling consideration`, {
        track: `${trackToScrobble.artist} - ${trackToScrobble.title}`,
        duration: trackToScrobble.duration,
        playDuration: playDuration,
        snapshotUsed: this.lastTrackSnapshot !== null,
        percentPlayed: trackToScrobble.duration > 0 
          ? Math.round((playDuration / trackToScrobble.duration) * 100) 
          : 0
      });
      
      // Clear the snapshot after using it
      this.lastTrackSnapshot = null;
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
      // Reset the scrobble flag so the same track can be scrobbled if replayed
      this.scrobbleSubmitted = false;
    }
  }

  /**
   * Check if we should scrobble the current track
   */
  private checkForScrobble(): void {
    // Use snapshot if available, otherwise current track
    const trackToScrobble = this.lastTrackSnapshot || this.currentTrack;
    
    if (!trackToScrobble) {
      debug('checkForScrobble: No track to scrobble');
      return;
    }

    if (this.scrobbleSubmitted) {
      debug('checkForScrobble: Scrobble already submitted for this track');
      return;
    }

    this.scrobbleSubmitted = true;
    const convertedTrack = convertYouTubeTrack(trackToScrobble);
    
    // Use the snapshot's currentTime directly - it's the most accurate
    const playDuration = trackToScrobble.currentTime;
    
    debug('checkForScrobble: Sending TRACK_ENDED message for scrobbling', {
      track: {
        artist: convertedTrack.artist,
        title: convertedTrack.title,
        duration: convertedTrack.duration,
        playDuration: playDuration,
        snapshotUsed: this.lastTrackSnapshot !== null
      }
    });

    // Send track ended message for scrobbling
    this.sendMessage({
      type: MESSAGE_TYPES.TRACK_ENDED,
      data: {
        track: convertedTrack,
        youtubeTrack: trackToScrobble,
        playDuration: playDuration,
      },
    });
    
    // Clear snapshot after use
    this.lastTrackSnapshot = null;
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
   * Check if music is currently playing - simplified for performance
   */
  private isCurrentlyPlaying(): boolean {
    // Primary method: Check the main play/pause button's aria-label
    const playPauseButton = document.querySelector('#play-pause-button button[aria-label]');
    if (playPauseButton) {
      const ariaLabel = playPauseButton.getAttribute('aria-label');
      return ariaLabel === 'Pause'; // "Pause" means it's currently playing
    }
    
    // Fallback: Check if we have track info (assume playing if track exists)
    const trackTitle = document.querySelector(YOUTUBE_MUSIC_SELECTORS.TRACK_TITLE);
    return !!(trackTitle?.textContent?.trim());
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
   * Handle extension context invalidation
   */
  private handleContextInvalidation(): void {
    if (this.contextInvalidated) {
      return; // Already handled
    }
    
    this.contextInvalidated = true;
    
    // Log once at info level
    info('Extension context invalidated - detector will stop. Please reload the page to resume scrobbling.', {
      url: window.location.href,
      reason: 'Extension was reloaded or updated'
    });
    
    // Stop all polling
    this.destroy();
  }

  /**
   * Send message to background script
   */
  private sendMessage(message: Message): void {
    if (!this.isExtensionContextValid()) {
      this.handleContextInvalidation();
      return;
    }

    try {
      chrome.runtime.sendMessage(message).catch((error) => {
        // Handle disconnected port errors gracefully (common when extension reloads)
        if (error.message && error.message.includes('disconnected port')) {
          debug('Message failed - extension port disconnected:', message.type);
          this.handleContextInvalidation();
        } else {
          log('error', 'Failed to send message:', error);
        }
      });
    } catch (error) {
      // Handle extension context invalidation
      if (error instanceof Error && error.message.includes('Extension context invalidated')) {
        debug('Extension context invalidated while sending message:', message.type);
        this.handleContextInvalidation();
      } else {
        log('error', 'Failed to send message - unexpected error:', error);
      }
    }
  }

  /**
   * Handle messages from background script
   */
  private handleMessage(message: Message, _sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void): void {
    if (!this.isExtensionContextValid()) {
      this.handleContextInvalidation();
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
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.timeUpdateIntervalId !== null) {
      window.clearInterval(this.timeUpdateIntervalId);
      this.timeUpdateIntervalId = null;
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
    console.log('[Madrak] Extension context invalidated detected in global error handler');
    if (detector) {
      detector['handleContextInvalidation']();
    }
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeDetector);
} else {
  initializeDetector();
}
