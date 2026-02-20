import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = 'http://10.170.122.99:8000';
const FETCH_TIMEOUT_MS = 8000; // Fail fast when backend is unreachable

// Dummy credentials for testing when backend is not available
const DUMMY_EMAIL = 'test@example.com';
const DUMMY_PASSWORD = 'password123';
const DUMMY_TOKEN_PREFIX = 'dummy-token-';

/**
 * Fetch with timeout - prevents infinite loading when backend is unreachable.
 */
const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
};

const isOfflineError = (error) =>
  !error.response &&
  (error.name === 'AbortError' ||
    error.name === 'TypeError' ||
    (error.message && (error.message.toLowerCase().includes('fetch') || error.message.toLowerCase().includes('network'))));

/**
 * AuthService handles all authentication-related operations including login, signup, logout,
 * token management, and session persistence.
 * Uses dummy/offline mode when backend is unreachable.
 */
export const AuthService = {
  // Token storage keys
  ACCESS_TOKEN_KEY: 'mindsentry_access_token',
  REFRESH_TOKEN_KEY: 'mindsentry_refresh_token',
  USER_DATA_KEY: 'mindsentry_user_data',

  /**
   * Registers a new user account
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {string} name - User full name
   * @returns {Promise<{user, accessToken, refreshToken}>}
   */
  signup: async (email, password, name) => {
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.detail || 'Signup failed');
      }

      const data = await response.json();
      await AuthService.storeTokens(data.access_token, data.refresh_token);
      await AuthService.storeUserData(data.user);
      return {
        user: data.user,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
      };
    } catch (error) {
      if (isOfflineError(error)) {
        const dummyUser = { email, name: name || email.split('@')[0], id: 'dummy-' + Date.now() };
        const dummyToken = 'dummy-token-' + Date.now();
        await AuthService.storeTokens(dummyToken, dummyToken);
        await AuthService.storeUserData(dummyUser);
        return {
          user: dummyUser,
          accessToken: dummyToken,
          refreshToken: dummyToken,
        };
      }
      throw error;
    }
  },

  /**
   * Logs in a user with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<{user, accessToken, refreshToken}>}
   */
  login: async (email, password) => {
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.detail || 'Login failed');
      }

      const data = await response.json();
      await AuthService.storeTokens(data.access_token, data.refresh_token);
      await AuthService.storeUserData(data.user);
      return {
        user: data.user,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
      };
    } catch (error) {
      if (isOfflineError(error)) {
        if (email.toLowerCase().trim() === DUMMY_EMAIL && password === DUMMY_PASSWORD) {
          const dummyUser = { email, name: 'Test User', id: 'dummy-login' };
          const dummyToken = 'dummy-token-' + Date.now();
          await AuthService.storeTokens(dummyToken, dummyToken);
          await AuthService.storeUserData(dummyUser);
          return {
            user: dummyUser,
            accessToken: dummyToken,
            refreshToken: dummyToken,
          };
        }
        throw new Error('Backend unavailable. Use test@example.com / password123 to sign in.');
      }
      throw error;
    }
  },



  /**
   * Refreshes the access token using the refresh token
   * @returns {Promise<{accessToken, refreshToken}>}
   */
  refreshAccessToken: async () => {
    try {
      const refreshToken = await AuthService.getRefreshToken();
      
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      
      // Store new tokens
      await AuthService.storeTokens(data.access_token, data.refresh_token);
      
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
      };
    } catch (error) {
      console.error('Token refresh error:', error);
      // If refresh fails, clear auth data
      await AuthService.logout();
      throw error;
    }
  },

  /**
   * Logs out the current user and clears tokens
   * @returns {Promise<void>}
   */
  logout: async () => {
    try {
      const accessToken = await AuthService.getAccessToken();

      // Immediately clear local auth storage so UI can react quickly.
      await SecureStore.deleteItemAsync(AuthService.ACCESS_TOKEN_KEY);
      await SecureStore.deleteItemAsync(AuthService.REFRESH_TOKEN_KEY);
      await SecureStore.deleteItemAsync(AuthService.USER_DATA_KEY);

      // Notify backend of logout in the background (non-blocking). Use fetchWithTimeout
      // to avoid long hangs when backend is unreachable. Errors are caught to
      // prevent unhandled promise rejections.
      if (accessToken) {
        fetchWithTimeout(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
        }).catch((error) => {
          console.warn('Backend logout failed (background):', error);
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  },

  /**
   * Stores access and refresh tokens securely
   * @private
   */
  storeTokens: async (accessToken, refreshToken) => {
    try {
      if (accessToken) {
        await SecureStore.setItemAsync(AuthService.ACCESS_TOKEN_KEY, accessToken);
      }
      if (refreshToken) {
        await SecureStore.setItemAsync(AuthService.REFRESH_TOKEN_KEY, refreshToken);
      }
    } catch (error) {
      console.error('Error storing tokens:', error);
      throw error;
    }
  },

  /**
   * Stores user data
   * @private
   */
  storeUserData: async (userData) => {
    try {
      await SecureStore.setItemAsync(AuthService.USER_DATA_KEY, JSON.stringify(userData));
    } catch (error) {
      console.error('Error storing user data:', error);
      throw error;
    }
  },

  /**
   * Retrieves the stored access token
   * @returns {Promise<string|null>}
   */
  getAccessToken: async () => {
    try {
      return await SecureStore.getItemAsync(AuthService.ACCESS_TOKEN_KEY);
    } catch (error) {
      console.error('Error retrieving access token:', error);
      return null;
    }
  },

  /**
   * Retrieves the stored refresh token
   * @returns {Promise<string|null>}
   */
  getRefreshToken: async () => {
    try {
      return await SecureStore.getItemAsync(AuthService.REFRESH_TOKEN_KEY);
    } catch (error) {
      console.error('Error retrieving refresh token:', error);
      return null;
    }
  },

  /**
   * Retrieves the stored user data
   * @returns {Promise<object|null>}
   */
  getUserData: async () => {
    try {
      const userData = await SecureStore.getItemAsync(AuthService.USER_DATA_KEY);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error retrieving user data:', error);
      return null;
    }
  },

  /**
   * Checks if user is currently authenticated
   * @returns {Promise<boolean>}
   */
  isAuthenticated: async () => {
    try {
      const token = await AuthService.getAccessToken();
      const user = await AuthService.getUserData();

      // Treat dummy/test tokens as non-authenticated to avoid persisting test sessions
      if (token && token.startsWith && token.startsWith(DUMMY_TOKEN_PREFIX)) {
        // clear any leftover test data
        await SecureStore.deleteItemAsync(AuthService.ACCESS_TOKEN_KEY);
        await SecureStore.deleteItemAsync(AuthService.REFRESH_TOKEN_KEY);
        await SecureStore.deleteItemAsync(AuthService.USER_DATA_KEY);
        return false;
      }

      if (user && user.id && typeof user.id === 'string' && user.id.startsWith('dummy')) {
        // clear leftover dummy user as well
        await SecureStore.deleteItemAsync(AuthService.ACCESS_TOKEN_KEY);
        await SecureStore.deleteItemAsync(AuthService.REFRESH_TOKEN_KEY);
        await SecureStore.deleteItemAsync(AuthService.USER_DATA_KEY);
        return false;
      }

      return !!(token && user);
    } catch (error) {
      console.error('Error checking authentication:', error);
      return false;
    }
  },

  /**
   * Checks if stored tokens exist (for app startup)
   * @returns {Promise<boolean>}
   */
  hasValidSession: async () => {
    try {
      const accessToken = await AuthService.getAccessToken();
      const refreshToken = await AuthService.getRefreshToken();
      const userData = await AuthService.getUserData();
      // Treat dummy/test tokens as invalid session and clear them
      if (accessToken && accessToken.startsWith && accessToken.startsWith(DUMMY_TOKEN_PREFIX)) {
        console.log('[AuthService] Clearing dummy token from storage');
        await SecureStore.deleteItemAsync(AuthService.ACCESS_TOKEN_KEY);
        await SecureStore.deleteItemAsync(AuthService.REFRESH_TOKEN_KEY);
        await SecureStore.deleteItemAsync(AuthService.USER_DATA_KEY);
        return false;
      }

      if (userData && userData.id && typeof userData.id === 'string' && userData.id.startsWith('dummy')) {
        console.log('[AuthService] Clearing dummy user data from storage');
        await SecureStore.deleteItemAsync(AuthService.ACCESS_TOKEN_KEY);
        await SecureStore.deleteItemAsync(AuthService.REFRESH_TOKEN_KEY);
        await SecureStore.deleteItemAsync(AuthService.USER_DATA_KEY);
        return false;
      }

      // Consider a session valid only when tokens and user data are present.
      return !!(accessToken && refreshToken && userData);
    } catch (error) {
      console.error('Error checking session:', error);
      return false;
    }
  },
};
