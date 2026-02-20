import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Offline storage service for storing data locally and syncing when online
 * Handles all offline data operations
 */
export const OfflineStorage = {
  /**
   * Store a check-in offline
   * @param {object} checkInData - Check-in data { mood, intensity, message, timestamp }
   * @returns {Promise<void>}
   */
  storeOfflineCheckIn: async (checkInData) => {
    try {
      const checkIns = await OfflineStorage.getOfflineCheckIns();
      const newCheckIn = {
        ...checkInData,
        id: `offline_${Date.now()}`,
        timestamp: checkInData.timestamp || new Date().toISOString(),
        synced: false,
      };
      checkIns.push(newCheckIn);
      await AsyncStorage.setItem('offlineCheckIns', JSON.stringify(checkIns));
      return newCheckIn;
    } catch (error) {
      console.error('Error storing offline check-in:', error);
      throw error;
    }
  },

  /**
   * Get all offline check-ins
   * @returns {Promise<Array>} Array of offline check-ins
   */
  getOfflineCheckIns: async () => {
    try {
      const data = await AsyncStorage.getItem('offlineCheckIns');
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error retrieving offline check-ins:', error);
      return [];
    }
  },

  /**
   * Delete an offline check-in
   * @param {string} id - Check-in ID to delete
   * @returns {Promise<void>}
   */
  deleteOfflineCheckIn: async (id) => {
    try {
      const checkIns = await OfflineStorage.getOfflineCheckIns();
      const filtered = checkIns.filter((item) => item.id !== id);
      await AsyncStorage.setItem('offlineCheckIns', JSON.stringify(filtered));
    } catch (error) {
      console.error('Error deleting offline check-in:', error);
      throw error;
    }
  },

  /**
   * Mark check-ins as synced
   * @param {Array<string>} ids - Array of check-in IDs that were synced
   * @returns {Promise<void>}
   */
  markAsSynced: async (ids) => {
    try {
      const checkIns = await OfflineStorage.getOfflineCheckIns();
      const updated = checkIns.map((item) => ({
        ...item,
        synced: ids.includes(item.id) ? true : item.synced,
      }));
      await AsyncStorage.setItem('offlineCheckIns', JSON.stringify(updated));
    } catch (error) {
      console.error('Error marking as synced:', error);
      throw error;
    }
  },

  /**
   * Get unsynced check-ins
   * @returns {Promise<Array>} Array of unsynced check-ins
   */
  getUnsyncedCheckIns: async () => {
    try {
      const checkIns = await OfflineStorage.getOfflineCheckIns();
      return checkIns.filter((item) => !item.synced);
    } catch (error) {
      console.error('Error retrieving unsynced check-ins:', error);
      return [];
    }
  },

  /**
   * Store chat messages offline
   * @param {object} messageData - Message data { text, sender, timestamp }
   * @returns {Promise<void>}
   */
  storeOfflineChatMessage: async (messageData) => {
    try {
      const messages = await OfflineStorage.getOfflineChatMessages();
      const newMessage = {
        ...messageData,
        id: `offline_${Date.now()}`,
        timestamp: messageData.timestamp || new Date().toISOString(),
        synced: false,
      };
      messages.push(newMessage);
      await AsyncStorage.setItem('offlineChatMessages', JSON.stringify(messages));
      return newMessage;
    } catch (error) {
      console.error('Error storing offline chat message:', error);
      throw error;
    }
  },

  /**
   * Get offline chat messages
   * @returns {Promise<Array>} Array of offline chat messages
   */
  getOfflineChatMessages: async () => {
    try {
      const data = await AsyncStorage.getItem('offlineChatMessages');
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error retrieving offline chat messages:', error);
      return [];
    }
  },

  /**
   * Get unsynced chat messages
   * @returns {Promise<Array>} Array of unsynced chat messages
   */
  getUnsyncedChatMessages: async () => {
    try {
      const messages = await OfflineStorage.getOfflineChatMessages();
      return messages.filter((item) => !item.synced);
    } catch (error) {
      console.error('Error retrieving unsynced chat messages:', error);
      return [];
    }
  },

  /**
   * Mark chat messages as synced
   * @param {Array<string>} ids - Array of message IDs that were synced
   * @returns {Promise<void>}
   */
  markChatMessagesAsSynced: async (ids) => {
    try {
      const messages = await OfflineStorage.getOfflineChatMessages();
      const updated = messages.map((item) => ({
        ...item,
        synced: ids.includes(item.id) ? true : item.synced,
      }));
      await AsyncStorage.setItem('offlineChatMessages', JSON.stringify(updated));
    } catch (error) {
      console.error('Error marking chat messages as synced:', error);
      throw error;
    }
  },

  /**
   * Cache API response data
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   * @param {number} ttlMinutes - Time to live in minutes (default: 60)
   * @returns {Promise<void>}
   */
  cacheData: async (key, data, ttlMinutes = 60) => {
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
        ttl: ttlMinutes * 60 * 1000, // Convert to milliseconds
      };
      await AsyncStorage.setItem(`cache_${key}`, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error caching data:', error);
    }
  },

  /**
   * Get cached data if not expired
   * @param {string} key - Cache key
   * @returns {Promise<any|null>} Cached data or null if expired/not found
   */
  getCachedData: async (key) => {
    try {
      const cacheData = await AsyncStorage.getItem(`cache_${key}`);
      if (!cacheData) return null;

      const parsed = JSON.parse(cacheData);
      const isExpired = Date.now() - parsed.timestamp > parsed.ttl;

      if (isExpired) {
        await AsyncStorage.removeItem(`cache_${key}`);
        return null;
      }

      return parsed.data;
    } catch (error) {
      console.error('Error retrieving cached data:', error);
      return null;
    }
  },

  /**
   * Clear specific cache
   * @param {string} key - Cache key to clear
   * @returns {Promise<void>}
   */
  clearCache: async (key) => {
    try {
      await AsyncStorage.removeItem(`cache_${key}`);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  },

  /**
   * Clear all cache
   * @returns {Promise<void>}
   */
  clearAllCache: async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((key) => key.startsWith('cache_'));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.error('Error clearing all cache:', error);
    }
  },

  /**
   * Store offline flag
   * @param {boolean} isOffline - Whether app is offline
   * @returns {Promise<void>}
   */
  setOfflineStatus: async (isOffline) => {
    try {
      await AsyncStorage.setItem('isOffline', JSON.stringify(isOffline));
    } catch (error) {
      console.error('Error setting offline status:', error);
    }
  },

  /**
   * Get offline status
   * @returns {Promise<boolean>} Whether app is offline
   */
  getOfflineStatus: async () => {
    try {
      const data = await AsyncStorage.getItem('isOffline');
      return data ? JSON.parse(data) : false;
    } catch (error) {
      console.error('Error getting offline status:', error);
      return false;
    }
  },

  /**
   * Get sync status for UI
   * @returns {Promise<object>} { hasPendingCheckIns, hasPendingMessages }
   */
  getSyncStatus: async () => {
    try {
      const pendingCheckIns = await OfflineStorage.getUnsyncedCheckIns();
      const pendingMessages = await OfflineStorage.getUnsyncedChatMessages();
      
      return {
        hasPendingCheckIns: pendingCheckIns.length > 0,
        hasPendingMessages: pendingMessages.length > 0,
        pendingCheckInsCount: pendingCheckIns.length,
        pendingMessagesCount: pendingMessages.length,
      };
    } catch (error) {
      console.error('Error getting sync status:', error);
      return {
        hasPendingCheckIns: false,
        hasPendingMessages: false,
        pendingCheckInsCount: 0,
        pendingMessagesCount: 0,
      };
    }
  },

  /**
   * Clear all offline data (when synced)
   * @returns {Promise<void>}
   */
  clearAllOfflineData: async () => {
    try {
      await AsyncStorage.multiRemove(['offlineCheckIns', 'offlineChatMessages']);
    } catch (error) {
      console.error('Error clearing offline data:', error);
    }
  },
};
