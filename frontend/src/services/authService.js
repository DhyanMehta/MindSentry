import * as SecureStore from 'expo-secure-store';
import { requestJson } from './httpClient';

/**
 * AuthService handles all authentication-related operations including login, signup, logout,
 * token management, and session persistence.
 */
export const AuthService = {
  // Token storage keys
  ACCESS_TOKEN_KEY: 'mindsentry_access_token',
  USER_DATA_KEY: 'mindsentry_user_data',
  normalizeEmail: (email) => (email || '').trim().toLowerCase(),

  /**
   * Registers a new user account
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {string} confirmPassword - Password confirmation
   * @returns {Promise<{user, accessToken}>}
   */
  signup: async (name, email, password, confirmPassword) => {
    try {
      const normalizedEmail = AuthService.normalizeEmail(email);
      const { data } = await requestJson('/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: normalizedEmail, password, confirmPassword }),
        suppressErrorStatuses: [400],
      });

      // Backend returns: { user: {id, email}, access_token, token_type }
      await AuthService.storeTokens(data.access_token);
      await AuthService.storeUserData(data.user);

      return {
        user: data.user,
        accessToken: data.access_token,
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * Logs in a user with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<{user, accessToken}>}
   */
  login: async (email, password) => {
    try {
      const normalizedEmail = AuthService.normalizeEmail(email);
      const { data } = await requestJson('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password }),
        suppressErrorStatuses: [401],
      });

      // Backend returns: { user: {id, email}, access_token, token_type }
      await AuthService.storeTokens(data.access_token);
      await AuthService.storeUserData(data.user);

      return {
        user: data.user,
        accessToken: data.access_token,
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * Fetches current user profile (protected route)
   * @returns {Promise<object>}
   */
  getCurrentUser: async () => {
    try {
      const accessToken = await AuthService.getAccessToken();

      if (!accessToken) {
        throw new Error('No access token available');
      }

      const { data: userData } = await requestJson('/auth/me', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        suppressErrorStatuses: [401],
      });

      // Backend returns: { id, email }
      await AuthService.storeUserData(userData);

      return userData;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Logs out the current user and clears tokens
   * @returns {Promise<void>}
   */
  logout: async () => {
    try {
      // Clear local auth storage
      await SecureStore.deleteItemAsync(AuthService.ACCESS_TOKEN_KEY);
      await SecureStore.deleteItemAsync(AuthService.USER_DATA_KEY);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  },

  /**
   * Stores access token securely
   * @private
   */
  storeTokens: async (accessToken) => {
    try {
      if (accessToken) {
        await SecureStore.setItemAsync(AuthService.ACCESS_TOKEN_KEY, accessToken);
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
      const userData = await AuthService.getUserData();
      if (!(accessToken && userData)) {
        return false;
      }

      await AuthService.getCurrentUser();
      return true;
    } catch (error) {
      console.error('Error checking session:', error);
      await AuthService.logout();
      return false;
    }
  },
};
