import NetInfo from '@react-native-community/netinfo';

/**
 * Network connectivity monitoring service
 * Tracks online/offline status and provides sync functionality
 */
export const NetworkService = {
  listeners: [],

  /**
   * Subscribe to network state changes
   * @param {Function} callback - Called with { isConnected: boolean }
   * @returns {Function} Unsubscribe function
   */
  subscribe: (callback) => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isConnected = state.isConnected === true;
      callback({ isConnected });
    });

    NetworkService.listeners.push(unsubscribe);
    return unsubscribe;
  },

  /**
   * Check current network status
   * @returns {Promise<boolean>} true if connected, false otherwise
   */
  isConnected: async () => {
    try {
      const state = await NetInfo.fetch();
      return state.isConnected === true;
    } catch (error) {
      console.error('Error checking network status:', error);
      return false;
    }
  },

  /**
   * Unsubscribe all listeners
   * @returns {void}
   */
  unsubscribeAll: () => {
    NetworkService.listeners.forEach((unsubscribe) => unsubscribe());
    NetworkService.listeners = [];
  },

  /**
   * Wait for internet connection
   * @returns {Promise<void>}
   */
  waitForConnection: async () => {
    return new Promise((resolve) => {
      const unsubscribe = NetworkService.subscribe(({ isConnected }) => {
        if (isConnected) {
          unsubscribe();
          resolve();
        }
      });
    });
  },

  /**
   * Get network type
   * @returns {Promise<string>} Type of network (wifi, cellular, none, etc)
   */
  getNetworkType: async () => {
    try {
      const state = await NetInfo.fetch();
      return state.type;
    } catch (error) {
      console.error('Error getting network type:', error);
      return 'unknown';
    }
  },

  /**
   * Check if connection is slow
   * @returns {Promise<boolean>} true if connection is slow/poor
   */
  isSlowConnection: async () => {
    try {
      const state = await NetInfo.fetch();
      // Consider connection slow if:
      // - Not connected
      // - On cellular
      // - Other flags indicating poor connection
      return !state.isConnected || state.type === 'cellular';
    } catch (error) {
      console.error('Error checking connection speed:', error);
      return false;
    }
  },
};
