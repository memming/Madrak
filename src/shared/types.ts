/**
 * Core types and interfaces for the Last.fm Scrobbler extension
 */

export interface Track {
  artist: string;
  title: string;
  album?: string;
  duration?: number;
  timestamp?: number;
  albumArtist?: string;
  trackNumber?: number;
  mbid?: string;
}

export interface ScrobbleData extends Track {
  timestamp: number;
}

export interface LastFmSession {
  name: string;
  key: string;
  subscriber: number;
}

export interface LastFmUser {
  name: string;
  realname?: string;
  url: string;
  image?: LastFmImage[];
  country?: string;
  age?: string;
  gender?: string;
  subscriber?: number;
  playcount?: number;
  playlists?: number;
  bootstrap?: string;
  registered?: LastFmRegistered;
  type?: string;
  scrobblesource?: string;
}

export interface LastFmImage {
  '#text': string;
  size: 'small' | 'medium' | 'large' | 'extralarge' | 'mega' | '';
}

export interface LastFmRegistered {
  '#text': number;
  unixtime: number;
}

export interface LastFmApiResponse<T = any> {
  track?: T;
  session?: T;
  user?: T;
  error?: number;
  message?: string;
  '@attr'?: {
    status: 'ok' | 'failed';
  };
}

export interface ScrobbleResponse {
  scrobbles: {
    '@attr': {
      accepted: number;
      ignored: number;
    };
    scrobble: Array<{
      track: {
        corrected: '0' | '1';
        '#text': string;
      };
      artist: {
        corrected: '0' | '1';
        '#text': string;
      };
      album: {
        corrected: '0' | '1';
        '#text': string;
      };
      albumArtist: {
        corrected: '0' | '1';
        '#text': string;
      };
      timestamp: string;
      ignoredMessage?: {
        code: string;
        '#text': string;
      };
    }>;
  };
}

export interface ExtensionSettings {
  isEnabled: boolean;
  minTrackLength: number; // in seconds
  autoScrobble: boolean;
  showNotifications: boolean;
  scrobbleThreshold: number; // percentage of track played before scrobbling
  debugMode: boolean; // enable debug logging
  logLevel: 'debug' | 'info' | 'warn' | 'error'; // minimum log level
  lastFmSession?: LastFmSession;
  lastFmUser?: LastFmUser;
}

export interface YouTubeMusicTrack {
  title: string;
  artist: string;
  album?: string;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  url?: string;
  thumbnail?: string;
}

export interface Message {
  type: 'TRACK_DETECTED' | 'TRACK_ENDED' | 'SCROBBLE_SUCCESS' | 'SCROBBLE_ERROR' | 'AUTH_SUCCESS' | 'AUTH_ERROR' | 'SETTINGS_UPDATE';
  data?: any;
  error?: string;
}

export interface ScrobbleQueueItem {
  track: Track;
  timestamp: number;
  retryCount: number;
  id: string;
}

export interface ApiError {
  code: number;
  message: string;
  details?: any;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  isEnabled: true,
  minTrackLength: 30, // 30 seconds
  autoScrobble: true,
  showNotifications: true,
  scrobbleThreshold: 50, // 50% of track
  debugMode: false, // disabled by default
  logLevel: 'info', // info level by default
};

export const LASTFM_API_ENDPOINTS = {
  AUTH: 'https://www.last.fm/api/auth',
  API: 'https://ws.audioscrobbler.com/2.0/',
  SESSION: 'https://ws.audioscrobbler.com/2.0/?method=auth.getSession',
  SCROBBLE: 'https://ws.audioscrobbler.com/2.0/?method=track.scrobble',
  UPDATE_NOW_PLAYING: 'https://ws.audioscrobbler.com/2.0/?method=track.updateNowPlaying',
  USER_INFO: 'https://ws.audioscrobbler.com/2.0/?method=user.getInfo',
} as const;

export const MESSAGE_TYPES = {
  TRACK_DETECTED: 'TRACK_DETECTED',
  TRACK_ENDED: 'TRACK_ENDED',
  SCROBBLE_SUCCESS: 'SCROBBLE_SUCCESS',
  SCROBBLE_ERROR: 'SCROBBLE_ERROR',
  AUTH_SUCCESS: 'AUTH_SUCCESS',
  AUTH_ERROR: 'AUTH_ERROR',
  SETTINGS_UPDATE: 'SETTINGS_UPDATE',
} as const;
