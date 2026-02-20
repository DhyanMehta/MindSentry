import { AuthService } from './authService';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

/**
 * Makes an authenticated API request with automatic token refresh
 * @private
 */
const makeRequest = async (endpoint, options = {}) => {
  let accessToken = await AuthService.getAccessToken();

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  try {
    let response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    // If token expired (401), try refreshing
    if (response.status === 401 && accessToken) {
      try {
        const refreshResult = await AuthService.refreshAccessToken();
        if (refreshResult.accessToken) {
          accessToken = refreshResult.accessToken;
          headers['Authorization'] = `Bearer ${accessToken}`;
          
          // Retry the original request with new token
          response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers,
          });
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        // Token refresh failed, user needs to re-login
        throw new Error('Session expired. Please log in again.');
      }
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
