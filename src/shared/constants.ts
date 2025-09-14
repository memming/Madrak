/**
 * Constants used throughout the extension
 */

export const EXTENSION_NAME = 'Madrak';
export const EXTENSION_VERSION = '1.0.0';

// Chrome extension storage keys
export const STORAGE_KEYS = {
  SETTINGS: 'extension_settings',
  LASTFM_SESSION: 'lastfm_session',
  LASTFM_USER: 'lastfm_user',
  SCROBBLE_QUEUE: 'scrobble_queue',
  LAST_SCROBBLE: 'last_scrobble',
  AUTH_TOKEN: 'auth_token',
} as const;

// YouTube Music selectors
export const YOUTUBE_MUSIC_SELECTORS = {
  // Track information
  TRACK_TITLE: '[data-testid="entityTitle"]',
  ARTIST_NAME: '[data-testid="byline"]',
  ALBUM_NAME: '[data-testid="album"]',
  
  // Player controls
  PLAY_BUTTON: '[data-testid="play-button"]',
  PAUSE_BUTTON: '[data-testid="pause-button"]',
  PLAYER_BAR: '[data-testid="progress-bar"]',
  
  // Time information
  CURRENT_TIME: '[data-testid="current-time"]',
  DURATION: '[data-testid="duration"]',
  
  // Album art
  ALBUM_ART: '[data-testid="album-art"] img',
  
  // Player state indicators
  PLAYING_INDICATOR: '.playing',
  PAUSED_INDICATOR: '.paused',
} as const;

// Last.fm API constants
export const LASTFM_CONSTANTS = {
  MIN_TRACK_LENGTH: 30, // seconds
  MAX_TRACK_LENGTH: 600, // 10 minutes
  SCROBBLE_THRESHOLD: 50, // percentage
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // milliseconds
  API_RATE_LIMIT: 5, // requests per second
} as const;

// Notification IDs
export const NOTIFICATION_IDS = {
  SCROBBLE_SUCCESS: 'scrobble_success',
  SCROBBLE_ERROR: 'scrobble_error',
  AUTH_SUCCESS: 'auth_success',
  AUTH_ERROR: 'auth_error',
  TRACK_DETECTED: 'track_detected',
} as const;

// Error codes
export const ERROR_CODES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  API_ERROR: 'API_ERROR',
  INVALID_TRACK: 'INVALID_TRACK',
  RATE_LIMIT: 'RATE_LIMIT',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

// Event names
export const EVENTS = {
  TRACK_CHANGED: 'track_changed',
  TRACK_PLAYING: 'track_playing',
  TRACK_PAUSED: 'track_paused',
  TRACK_ENDED: 'track_ended',
  SCROBBLE_QUEUED: 'scrobble_queued',
  SCROBBLE_SENT: 'scrobble_sent',
  SCROBBLE_FAILED: 'scrobble_failed',
  AUTH_STARTED: 'auth_started',
  AUTH_COMPLETED: 'auth_completed',
  AUTH_FAILED: 'auth_failed',
  SETTINGS_CHANGED: 'settings_changed',
} as const;

// CSS classes for UI elements
export const CSS_CLASSES = {
  LOADING: 'lastfm-loading',
  ERROR: 'lastfm-error',
  SUCCESS: 'lastfm-success',
  WARNING: 'lastfm-warning',
  HIDDEN: 'lastfm-hidden',
  VISIBLE: 'lastfm-visible',
} as const;

// Local storage keys for temporary data
export const TEMP_STORAGE_KEYS = {
  CURRENT_TRACK: 'current_track',
  PLAY_START_TIME: 'play_start_time',
  LAST_UPDATE_TIME: 'last_update_time',
  PENDING_SCROBBLES: 'pending_scrobbles',
} as const;

// API response status codes
export const API_STATUS = {
  OK: 'ok',
  FAILED: 'failed',
} as const;

// Scrobble status
export const SCROBBLE_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  FAILED: 'failed',
  IGNORED: 'ignored',
} as const;

// Message types for communication between components
export const MESSAGE_TYPES = {
  TRACK_DETECTED: 'TRACK_DETECTED',
  TRACK_ENDED: 'TRACK_ENDED',
  SCROBBLE_SUCCESS: 'SCROBBLE_SUCCESS',
  SCROBBLE_ERROR: 'SCROBBLE_ERROR',
  AUTH_SUCCESS: 'AUTH_SUCCESS',
  AUTH_ERROR: 'AUTH_ERROR',
  SETTINGS_UPDATE: 'SETTINGS_UPDATE',
  GET_QUEUE_STATS: 'GET_QUEUE_STATS',
  START_AUTH: 'START_AUTH',
  LOGOUT: 'LOGOUT',
  CLEAR_ALL_DATA: 'CLEAR_ALL_DATA',
  GET_DEBUG_INFO: 'GET_DEBUG_INFO',
  EXPORT_LOGS: 'EXPORT_LOGS',
} as const;

// Last.fm API endpoints
export const LASTFM_API_ENDPOINTS = {
  AUTH: 'https://www.last.fm/api/auth',
  API: 'https://ws.audioscrobbler.com/2.0/',
  SESSION: 'https://ws.audioscrobbler.com/2.0/?method=auth.getSession',
  SCROBBLE: 'https://ws.audioscrobbler.com/2.0/?method=track.scrobble',
  UPDATE_NOW_PLAYING: 'https://ws.audioscrobbler.com/2.0/?method=track.updateNowPlaying',
  USER_INFO: 'https://ws.audioscrobbler.com/2.0/?method=user.getInfo',
} as const;

// Default extension settings
export const DEFAULT_SETTINGS = {
  isEnabled: true,
  minTrackLength: 30, // 30 seconds
  autoScrobble: true,
  showNotifications: true,
  scrobbleThreshold: 50, // 50% of track
  debugMode: false, // disabled by default
  logLevel: 'info', // info level by default
} as const;
