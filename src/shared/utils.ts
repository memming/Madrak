/**
 * Utility functions used throughout the extension
 */

import { Track, ScrobbleData, YouTubeMusicTrack, ExtensionSettings } from './types';
import { DEFAULT_SETTINGS } from './constants';

/**
 * Generate a unique ID for tracking purposes
 */
export function generateId(): string {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

/**
 * Format duration in seconds to MM:SS format
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Parse duration string (MM:SS or HH:MM:SS) to seconds
 */
export function parseDuration(durationStr: string): number {
  const parts = durationStr.split(':').map(Number);
  if (parts.length === 2) {
    // MM:SS format
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  } else if (parts.length === 3) {
    // HH:MM:SS format
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  }
  return 0;
}

/**
 * Check if a track meets the minimum length requirement for scrobbling
 */
export function isTrackLongEnough(track: Track, minLength: number = 30): boolean {
  return (track.duration || 0) >= minLength;
}

/**
 * Check if enough of the track has been played to qualify for scrobbling
 */
export function hasPlayedEnough(
  currentTime: number,
  duration: number,
  threshold: number = 50
): boolean {
  if (duration === 0) return false;
  const percentage = (currentTime / duration) * 100;
  return percentage >= threshold;
}

/**
 * Sanitize track data for Last.fm API
 */
export function sanitizeTrack(track: Track): Track {
  return {
    artist: track.artist?.trim() || '',
    title: track.title?.trim() || '',
    album: track.album?.trim() || '',
    duration: track.duration || 0,
    timestamp: track.timestamp || Math.floor(Date.now() / 1000),
    albumArtist: track.albumArtist?.trim() || '',
    trackNumber: track.trackNumber || 0,
    mbid: track.mbid || '',
  };
}

/**
 * Convert YouTube Music track to our Track format
 */
export function convertYouTubeTrack(ytTrack: YouTubeMusicTrack): Track {
  return {
    artist: ytTrack.artist,
    title: ytTrack.title,
    album: ytTrack.album || undefined,
    duration: ytTrack.duration,
    timestamp: Math.floor(Date.now() / 1000),
  };
}

/**
 * Check if two tracks are the same
 */
export function isSameTrack(track1: Track, track2: Track): boolean {
  return (
    track1.artist.toLowerCase() === track2.artist.toLowerCase() &&
    track1.title.toLowerCase() === track2.title.toLowerCase() &&
    (track1.album || '').toLowerCase() === (track2.album || '').toLowerCase()
  );
}

/**
 * Create a scrobble data object from a track
 */
export function createScrobbleData(track: Track): ScrobbleData {
  return {
    ...track,
    timestamp: Math.floor(Date.now() / 1000),
  };
}

/**
 * Get settings from Chrome storage with defaults
 */
export async function getSettings(): Promise<ExtensionSettings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['extension_settings'], (result) => {
      const settings = result?.['extension_settings'] || DEFAULT_SETTINGS;
      resolve(settings);
    });
  });
}

/**
 * Save settings to Chrome storage
 */
export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ 'extension_settings': settings }, () => {
      resolve();
    });
  });
}

/**
 * Debounce function to limit function calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function to limit function calls
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Sleep function for delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate MD5 hash for Last.fm API authentication
 */
export async function generateMD5(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('MD5', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create a query string from an object
 */
export function createQueryString(params: Record<string, string | number>): string {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
}

/**
 * Parse query string to object
 */
export function parseQueryString(queryString: string): Record<string, string> {
  const params: Record<string, string> = {};
  const pairs = queryString.split('&');
  
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key && value) {
      params[decodeURIComponent(key)] = decodeURIComponent(value);
    }
  }
  
  return params;
}

/**
 * Check if we're on YouTube Music
 */
export function isYouTubeMusic(): boolean {
  return typeof window !== 'undefined' && window.location.hostname === 'music.youtube.com';
}

/**
 * Log levels for different types of messages
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Logger configuration
 */
interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableStorage: boolean;
  maxStorageEntries: number;
}

/**
 * Default logger configuration
 */
const DEFAULT_LOGGER_CONFIG: LoggerConfig = {
  level: 'info',
  enableConsole: true,
  enableStorage: false,
  maxStorageEntries: 1000,
};

/**
 * Current logger configuration
 */
let loggerConfig: LoggerConfig = { ...DEFAULT_LOGGER_CONFIG };

/**
 * Log entry interface
 */
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  args: any[];
  source: string;
  context?: any;
}

/**
 * Log storage for debugging
 */
let logStorage: LogEntry[] = [];

/**
 * Set logger configuration
 */
export function setLoggerConfig(config: Partial<LoggerConfig>): void {
  loggerConfig = { ...loggerConfig, ...config };
}

/**
 * Get current logger configuration
 */
export function getLoggerConfig(): LoggerConfig {
  return { ...loggerConfig };
}

/**
 * Check if a log level should be output
 */
function shouldLog(level: LogLevel): boolean {
  const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  const currentLevelIndex = levels.indexOf(loggerConfig.level);
  const messageLevelIndex = levels.indexOf(level);
  return messageLevelIndex >= currentLevelIndex;
}

/**
 * Create a log entry
 */
function createLogEntry(level: LogLevel, message: string, args: any[], source: string, context?: any): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    args,
    source,
    context,
  };
}

/**
 * Store log entry
 */
function storeLogEntry(entry: LogEntry): void {
  if (!loggerConfig.enableStorage) return;
  
  logStorage.push(entry);
  
  // Keep only the most recent entries
  if (logStorage.length > loggerConfig.maxStorageEntries) {
    logStorage = logStorage.slice(-loggerConfig.maxStorageEntries);
  }
}

/**
 * Get stored logs
 */
export function getStoredLogs(level?: LogLevel, limit?: number): LogEntry[] {
  let logs = logStorage;
  
  if (level) {
    logs = logs.filter(log => log.level === level);
  }
  
  if (limit) {
    logs = logs.slice(-limit);
  }
  
  return logs;
}

/**
 * Clear stored logs
 */
export function clearStoredLogs(): void {
  logStorage = [];
}

/**
 * Export logs as JSON
 */
export function exportLogs(): string {
  return JSON.stringify(logStorage, null, 2);
}

/**
 * Enhanced logging function with debug support
 */
export function log(level: LogLevel, message: string, ...args: any[]): void;
export function log(level: LogLevel, message: string, context: any, ...args: any[]): void;
export function log(level: LogLevel, message: string, contextOrArg?: any, ...args: any[]): void {
  if (!shouldLog(level)) return;
  
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [Madrak] [${level.toUpperCase()}]`;
  
  // Determine if context was provided
  const hasContext = contextOrArg && typeof contextOrArg === 'object' && !Array.isArray(contextOrArg);
  const context = hasContext ? contextOrArg : undefined;
  const logArgs = hasContext ? args : (contextOrArg !== undefined ? [contextOrArg, ...args] : args);
  
  // Create log entry
  const entry = createLogEntry(level, message, logArgs, 'unknown', context);
  
  // Store log entry
  storeLogEntry(entry);
  
  // Output to console
  if (loggerConfig.enableConsole) {
    const consoleArgs = [prefix, message];
    if (context) {
      consoleArgs.push('Context:', context);
    }
    if (logArgs.length > 0) {
      // Convert error objects to readable strings
      const processedArgs = logArgs.map(arg => {
        if (arg instanceof Error) {
          return {
            message: arg.message,
            stack: arg.stack,
            name: arg.name
          };
        }
        return arg;
      });
      consoleArgs.push(...processedArgs);
    }
    
    switch (level) {
      case 'debug':
        console.debug(...consoleArgs);
        break;
      case 'info':
        console.log(...consoleArgs);
        break;
      case 'warn':
        console.warn(...consoleArgs);
        break;
      case 'error':
        console.error(...consoleArgs);
        break;
    }
  }
}

/**
 * Debug logging with context
 */
export function debug(message: string, context?: any, ...args: any[]): void {
  log('debug', message, context, ...args);
}

/**
 * Info logging with context
 */
export function info(message: string, context?: any, ...args: any[]): void {
  log('info', message, context, ...args);
}

/**
 * Warning logging with context
 */
export function warn(message: string, context?: any, ...args: any[]): void {
  log('warn', message, context, ...args);
}

/**
 * Error logging with context
 */
export function error(message: string, context?: any, ...args: any[]): void {
  log('error', message, context, ...args);
}

/**
 * Log API request details
 */
export function logApiRequest(method: string, url: string, params: any, response?: any, error?: any): void {
  const context = {
    method,
    url,
    params,
    response: response ? { status: response.status, data: response.data } : undefined,
    error: error ? { message: error.message, code: error.code } : undefined,
  };
  
  if (error) {
    error(`API Request Failed: ${method} ${url}`, context);
  } else {
    debug(`API Request: ${method} ${url}`, context);
  }
}

/**
 * Log scrobble attempt
 */
export function logScrobbleAttempt(track: any, success: boolean, error?: any): void {
  const context = {
    track: {
      artist: track.artist,
      title: track.title,
      album: track.album,
      duration: track.duration,
      timestamp: track.timestamp,
    },
    success,
    error: error ? { message: error.message, code: error.code } : undefined,
  };
  
  if (success) {
    info(`Scrobble Success: ${track.artist} - ${track.title}`, context);
  } else {
    error(`Scrobble Failed: ${track.artist} - ${track.title}`, context);
  }
}

/**
 * Log track detection
 */
export function logTrackDetection(track: any, source: string, reason?: string): void {
  const context = {
    track: {
      artist: track.artist,
      title: track.title,
      album: track.album,
      duration: track.duration,
      isPlaying: track.isPlaying,
    },
    source,
    reason,
  };
  
  debug(`Track Detected: ${track.artist} - ${track.title}`, context);
}

/**
 * Log authentication events
 */
export function logAuthEvent(event: string, success: boolean, details?: any): void {
  const context = {
    event,
    success,
    details,
  };
  
  if (success) {
    info(`Auth Success: ${event}`, context);
  } else {
    error(`Auth Failed: ${event}`, context);
  }
}

/**
 * Show notification to user
 */
export function showNotification(
  title: string,
  message: string,
  type: 'basic' | 'image' = 'basic',
  iconUrl?: string
): void {
  chrome.notifications.create({
    type,
    iconUrl: iconUrl || 'assets/icon-48.png',
    title,
    message,
  });
}

/**
 * Validate track data
 */
export function validateTrack(track: Track): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!track.artist || track.artist.trim() === '') {
    errors.push('Artist is required');
  }
  
  if (!track.title || track.title.trim() === '') {
    errors.push('Title is required');
  }
  
  if (track.duration && track.duration < 0) {
    errors.push('Duration must be positive');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}
