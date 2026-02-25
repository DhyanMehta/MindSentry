import * as SecureStore from 'expo-secure-store';
import { API_CONFIG } from '../config/api.config';

// Backend API URL - Automatically configured for Expo Go and emulators
const API_BASE_URL = API_CONFIG.BASE_URL;

/**
 * AuthService handles all authentication-related operations including login, signup, logout,
 * token management, and session persistence.
 */
export const AuthService = {
  // Token storage keys
  ACCESS_TOKEN_KEY: 'mindsentry_access_token',
  USER_DATA_KEY: 'mindsentry_user_data',

  /**
   * Registers a new user account
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {string} confirmPassword - Password confirmation
   * @returns {Promise<{user, accessToken}>}
   */
  signup: async (email, password, confirmPassword) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, confirmPassword }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const errorDetail = errBody.detail;
        
        // Handle validation errors
        if (Array.isArray(errorDetail)) {
          const errorMsg = errorDetail[0]?.msg || 'Validation error';
          throw new Error(errorMsg);
        }
        
        throw new Error(errorDetail || 'Signup failed');
      }

      const data = await response.json();
      // Backend returns: { user: {id, email}, access_token, token_type }
      await AuthService.storeTokens(data.access_token);
      await AuthService.storeUserData(data.user);
      
      return {
        user: data.user,
        accessToken: data.access_token,
      };
    } catch (error) {
      console.error('Signup error:', error);
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
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const errorDetail = errBody.detail;
        
        // Handle validation errors
        if (Array.isArray(errorDetail)) {
          const errorMsg = errorDetail[0]?.msg || 'Validation error';
          throw new Error(errorMsg);
        }
        
        throw new Error(errorDetail || 'Login failed');
      }

      const data = await response.json();
      // Backend returns: { user: {id, email}, access_token, token_type }
      await AuthService.storeTokens(data.access_token);
      await AuthService.storeUserData(data.user);
      
      return {
        user: data.user,
        accessToken: data.access_token,
      };
    } catch (error) {
      console.error('Login error:', error);
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

      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user profile');
      }

      const userData = await response.json();
      // Backend returns: { id, email }
      await AuthService.storeUserData(userData);
      
      return userData;
    } catch (error) {
      console.error('Get current user error:', error);
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
      return !!(accessToken && userData);
    } catch (error) {
      console.error('Error checking session:', error);
      return false;
    }
  },
};
