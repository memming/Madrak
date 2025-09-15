/**
 * Last.fm API integration
 */

import {
  LastFmApiResponse,
  LastFmSession,
  LastFmUser,
  ScrobbleData,
  ScrobbleResponse,
  Track
} from '../shared/types';
import { LASTFM_API_ENDPOINTS } from '../shared/constants';
import { generateMD5, createQueryString, log, debug, info, error } from '../shared/utils';

export class LastFmApi {
  private apiKey: string;
  private sharedSecret: string;
  private session?: LastFmSession;

  constructor(apiKey: string, sharedSecret: string) {
    this.apiKey = apiKey;
    this.sharedSecret = sharedSecret;
  }

  /**
   * Set the user session
   */
  setSession(session: LastFmSession): void {
    this.session = session;
  }

  /**
   * Get the current session
   */
  getSession(): LastFmSession | undefined {
    return this.session;
  }

  /**
   * Generate API signature for authenticated requests
   */
  private generateSignature(params: Record<string, string>): string {
    const keys = Object.keys(params).sort();
    let signatureString = '';

    for (const key of keys) {
      // Exclude format and callback parameters from signature (like Web Scrobbler)
      if (['format', 'callback'].includes(key)) {
        continue;
      }

      signatureString += `${key}${params[key] || ''}`;
    }

    signatureString += this.sharedSecret;
    return generateMD5(signatureString);
  }

  /**
   * Make an API request to Last.fm
   */
  private async makeRequest<T>(
    method: string,
    params: Record<string, string> = {},
    authenticated: boolean = false
  ): Promise<LastFmApiResponse<T>> {
    const requestParams = {
      method,
      api_key: this.apiKey,
      format: 'json',
      ...params,
    };

    if (authenticated) {
      // For auth.getsession, we don't have a session yet, so don't add sk
      if (this.session && method !== 'auth.getsession') {
        (requestParams as any).sk = this.session.key;
      }
      
      const signature = this.generateSignature(requestParams);
      (requestParams as any).api_sig = signature;
      debug('Generated API signature for authenticated request', { 
        method, 
        hasSession: !!this.session,
        signatureLength: signature.length,
        isAuthGetSession: method === 'auth.getsession'
      });
    }

    // Determine if this method requires POST
    const requiresPost = ['track.updateNowPlaying', 'track.scrobble'].includes(method);
    
    let url: string;
    let fetchOptions: RequestInit = {};
    
    if (requiresPost) {
      // Use POST for track.updateNowPlaying and track.scrobble
      url = LASTFM_API_ENDPOINTS.API;
      fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: createQueryString(requestParams)
      };
    } else {
      // Use GET for other methods
      url = `${LASTFM_API_ENDPOINTS.API}?${createQueryString(requestParams)}`;
    }
    
    debug('Making Last.fm API request', {
      method,
      url: url.replace(this.apiKey, '[API_KEY]'), // Hide API key in logs
      params: { ...requestParams, api_key: '[API_KEY]' }, // Hide API key in params
      authenticated,
      hasSession: !!this.session,
      requiresPost,
      httpMethod: requiresPost ? 'POST' : 'GET'
    });
    
    try {
      const startTime = Date.now();
      const response = await fetch(url, fetchOptions);
      const requestDuration = Date.now() - startTime;
      
      debug('API response received', {
        method,
        status: response.status,
        statusText: response.statusText,
        duration: `${requestDuration}ms`,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        error('API request failed with HTTP error', {
          method,
          status: response.status,
          statusText: response.statusText,
          responseBody: errorText,
          url: url.replace(this.apiKey, '[API_KEY]')
        });
        throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
      }

      const data: LastFmApiResponse<T> = await response.json();
      
      debug('API response parsed', {
        method,
        hasData: !!data,
        status: data['@attr']?.status,
        hasError: !!data.error,
        errorCode: data.error,
        errorMessage: data.message
      });
      
      if (data['@attr']?.status === 'failed') {
        error('Last.fm API returned failed status', {
          method,
          errorCode: data.error,
          errorMessage: data.message,
          response: data
        });
        throw new Error(data.message || 'API request failed');
      }

      info(`API request successful: ${method}`, {
        method,
        duration: `${requestDuration}ms`,
        hasData: !!data
      });

      return data;
    } catch (err) {
      error(`API request failed for ${method}`, {
        method,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        url: url.replace(this.apiKey, '[API_KEY]')
      });
      throw err;
    }
  }

  /**
   * Get user info
   */
  async getUserInfo(username?: string): Promise<LastFmUser> {
    const params = username ? { user: username } : {};
    const response = await this.makeRequest<LastFmUser>('user.getInfo', params);
    
    if (!response.user) {
      throw new Error('User info not found');
    }

    return response.user;
  }

  /**
   * Update now playing status
   */
  async updateNowPlaying(track: Track): Promise<void> {
    if (!this.session) {
      throw new Error('Not authenticated');
    }

    const params = {
      artist: track.artist,
      track: track.title,
      album: track.album || '',
      albumArtist: track.albumArtist || '',
      trackNumber: track.trackNumber?.toString() || '',
      duration: track.duration?.toString() || '',
    };

    try {
      await this.makeRequest('track.updateNowPlaying', params, true);
      log('info', `Updated now playing: ${track.artist} - ${track.title}`);
    } catch (error) {
      log('error', 'Failed to update now playing:', error);
      throw error;
    }
  }

  /**
   * Scrobble a track
   */
  async scrobble(scrobbles: ScrobbleData[]): Promise<ScrobbleResponse> {
    if (!this.session) {
      throw new Error('Not authenticated');
    }

    if (scrobbles.length === 0) {
      throw new Error('No tracks to scrobble');
    }

    const params: Record<string, string> = {};
    
    scrobbles.forEach((scrobble, index) => {
      params[`artist[${index}]`] = scrobble.artist;
      params[`track[${index}]`] = scrobble.title;
      params[`timestamp[${index}]`] = scrobble.timestamp.toString();
      params[`album[${index}]`] = scrobble.album || '';
      params[`albumArtist[${index}]`] = scrobble.albumArtist || '';
      params[`trackNumber[${index}]`] = scrobble.trackNumber?.toString() || '';
      params[`duration[${index}]`] = scrobble.duration?.toString() || '';
    });

    try {
      const response = await this.makeRequest<any>('track.scrobble', params, true);
      
      if (!(response as any).scrobbles) {
        throw new Error('Invalid scrobble response');
      }

      log('info', `Scrobbled ${(response as any).scrobbles['@attr'].accepted} tracks successfully`);
      return response as ScrobbleResponse;
    } catch (error) {
      log('error', 'Failed to scrobble tracks:', error);
      throw error;
    }
  }

  /**
   * Get a token from Last.fm API
   */
  async getToken(): Promise<string> {
    try {
      debug('Getting token from Last.fm API', {
        apiKey: this.apiKey ? '[PRESENT]' : '[MISSING]',
        apiUrl: LASTFM_API_ENDPOINTS.API
      });

      const params = {
        method: 'auth.gettoken',
        api_key: this.apiKey,
        format: 'json'
      };

      const queryString = createQueryString(params);
      const url = `${LASTFM_API_ENDPOINTS.API}?${queryString}`;

      debug('Making token request to Last.fm', { url: url.replace(this.apiKey, '[API_KEY]') });

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`Last.fm API error: ${data.message || 'Unknown error'}`);
      }

      if (!data.token) {
        throw new Error('No token received from Last.fm API');
      }

      debug('Successfully received token from Last.fm', {
        tokenLength: data.token.length,
        tokenPreview: data.token.substring(0, 10) + '...'
      });

      return data.token;
    } catch (err) {
      error('Failed to get token from Last.fm API', err);
      throw err;
    }
  }

  /**
   * Get authentication URL for Last.fm using token
   */
  getAuthUrl(token: string): string {
    try {
      debug('Generating authentication URL with token', {
        tokenLength: token.length,
        tokenPreview: token.substring(0, 10) + '...',
        apiKey: this.apiKey ? '[PRESENT]' : '[MISSING]'
      });

      const authUrl = `${LASTFM_API_ENDPOINTS.AUTH}?api_key=${this.apiKey}&token=${token}`;

      debug('Generated authentication URL', {
        authUrl: authUrl.replace(this.apiKey, '[API_KEY]').replace(token, '[TOKEN]')
      });

      return authUrl;
    } catch (err) {
      error('Failed to generate authentication URL', err);
      throw err;
    }
  }

  /**
   * Complete authentication with token
   */
  async completeAuth(token: string): Promise<LastFmSession> {
    const params = {
      token,
    };

    try {
      // auth.getsession requires signing, so we need to use authenticated: true
      const response = await this.makeRequest<any>('auth.getsession', params, true);
      
      if (!response.session) {
        throw new Error('Authentication failed');
      }

      this.session = response.session as LastFmSession;
      log('info', `Authentication successful for user: ${response.session.name}`);
      
      return response.session as LastFmSession;
    } catch (error) {
      log('error', 'Authentication failed:', error);
      throw error;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.session;
  }

  /**
   * Get user's recent tracks
   */
  async getRecentTracks(username?: string, limit: number = 50): Promise<any> {
    const params = {
      user: username || this.session?.name || '',
      limit: limit.toString(),
    };

    const response = await this.makeRequest('user.getRecentTracks', params);
    return response;
  }

  /**
   * Get user's top tracks
   */
  async getTopTracks(username?: string, period: string = '7day', limit: number = 50): Promise<any> {
    const params = {
      user: username || this.session?.name || '',
      period,
      limit: limit.toString(),
    };

    const response = await this.makeRequest('user.getTopTracks', params);
    return response;
  }

  /**
   * Search for tracks
   */
  async searchTracks(query: string, limit: number = 30): Promise<any> {
    const params = {
      track: query,
      limit: limit.toString(),
    };

    const response = await this.makeRequest('track.search', params);
    return response;
  }

  /**
   * Get track info
   */
  async getTrackInfo(artist: string, track: string, username?: string): Promise<any> {
    const params = {
      artist,
      track,
      username: username || this.session?.name || '',
    };

    const response = await this.makeRequest('track.getInfo', params);
    return response;
  }

  /**
   * Get artist info
   */
  async getArtistInfo(artist: string): Promise<any> {
    const params = {
      artist,
    };

    const response = await this.makeRequest('artist.getInfo', params);
    return response;
  }

  /**
   * Get album info
   */
  async getAlbumInfo(artist: string, album: string): Promise<any> {
    const params = {
      artist,
      album,
    };

    const response = await this.makeRequest('album.getInfo', params);
    return response;
  }
}
