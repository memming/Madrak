/**
 * Core types and interfaces for the Last.fm Scrobbler extension
 */

export interface Track {
  artist: string;
  title: string;
  album?: string | undefined;
  duration?: number | undefined;
  timestamp?: number | undefined;
  albumArtist?: string | undefined;
  trackNumber?: number | undefined;
  mbid?: string | undefined;
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
  album?: string | undefined;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  url?: string | undefined;
  thumbnail?: string | undefined;
}

export interface Message {
  type: 'TRACK_DETECTED' | 'TRACK_ENDED' | 'SCROBBLE_SUCCESS' | 'SCROBBLE_ERROR' | 'AUTH_SUCCESS' | 'AUTH_ERROR' | 'SETTINGS_UPDATE' | 'GET_QUEUE_STATS' | 'START_AUTH' | 'COMPLETE_AUTH' | 'LOGOUT' | 'CLEAR_ALL_DATA' | 'GET_DEBUG_INFO' | 'EXPORT_LOGS' | 'PING' | 'GET_CURRENT_TRACK';
  data?: any;
  error?: string;
}

export interface ScrobbleQueueItem {
  track: ScrobbleData;
  timestamp: number;
  retryCount: number;
  id: string;
}

export interface ApiError {
  code: number;
  message: string;
  details?: any;
}

