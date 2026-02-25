import { AuthService } from './authService';
import { API_CONFIG } from '../config/api.config';

const API_BASE_URL = API_CONFIG.BASE_URL;

/**
 * Makes an authenticated API request
 * @private
 */
const makeRequest = async (endpoint, options = {}) => {
  const accessToken = await AuthService.getAccessToken();

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    // Handle unauthorized (401) - clear auth and force re-login
    if (response.status === 401 && accessToken) {
      console.log('Token expired, clearing auth...');
      await AuthService.logout();
      throw new Error('Session expired. Please log in again.');
    }

    // Handle non-2xx responses
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `API Error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API Request failed [${endpoint}]:`, error);
    throw error;
  }
};

/**
 * ApiService provides methods for all backend API calls
 * Automatically handles authentication and token refresh
 */
export const ApiService = {
  /**
   * Fetch dashboard data
   */
  fetchDashboard: async () => {
    return makeRequest('/api/dashboard');
  },

  /**
   * Submit a check-in with mood and metrics
   */
  submitCheckIn: async (payload) => {
    return makeRequest('/api/check-in', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Fetch mood/stress/sleep trends
   */
  fetchInsights: async () => {
    return makeRequest('/api/insights');
  },

  /**
   * Fetch wellness trends
   */
  fetchTrends: async (metricType, timeRange = '7d') => {
    return makeRequest(`/api/trends/${metricType}?timeRange=${timeRange}`);
  },

  /**
   * Send a message to counselor chat
   */
  sendChatMessage: async (message) => {
    return makeRequest('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },

  /**
   * Fetch chat history
   */
  fetchChatHistory: async () => {
    return makeRequest('/api/chat/history');
  },

  /**
   * Fetch user profile
   */
  fetchUserProfile: async () => {
    return makeRequest('/api/user/profile');
  },

  /**
   * Update user profile
   */
  updateUserProfile: async (updates) => {
    return makeRequest('/api/user/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  /**
   * Submit multi-modal data (voice, face, etc.)
   */
  submitMultiModalData: async (data) => {
    return makeRequest('/api/multi-modal', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Get support resources
   */
  fetchSupportResources: async () => {
    return makeRequest('/api/support/resources');
  },
};
