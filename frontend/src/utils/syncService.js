import { OfflineStorage } from './offlineStorage';
import { NetworkService } from './networkService';
import { api } from '../services/api';

/**
 * Sync service for syncing offline data when connection is restored
 */
export const SyncService = {
  isSyncing: false,
  syncListeners: [],

  /**
   * Subscribe to sync status changes
   * @param {Function} callback - Called with { isSyncing: boolean, status: string }
   * @returns {Function} Unsubscribe function
   */
  onSyncStatusChange: (callback) => {
    SyncService.syncListeners.push(callback);
    return () => {
      SyncService.syncListeners = SyncService.syncListeners.filter(
        (listener) => listener !== callback
      );
    };
  },

  /**
   * Notify all sync listeners of status change
   */
  _notifyListeners: (status) => {
    SyncService.syncListeners.forEach((listener) => {
      listener({
        isSyncing: SyncService.isSyncing,
        status,
      });
    });
  },

  /**
   * Sync all offline data (check-ins and messages)
   * @returns {Promise<object>} Sync result { success, checkInsSynced, messagesSynced, errors }
   */
  syncAllData: async () => {
    if (SyncService.isSyncing) {
      console.log('Sync already in progress');
      return;
    }

    try {
      SyncService.isSyncing = true;
      SyncService._notifyListeners('Syncing offline data...');

      const checkInsSynced = await SyncService._syncOfflineCheckIns();
      const messagesSynced = await SyncService._syncOfflineChatMessages();

      SyncService.isSyncing = false;
      SyncService._notifyListeners('Sync complete');

      return {
        success: true,
        checkInsSynced,
        messagesSynced,
        errors: [],
      };
    } catch (error) {
      SyncService.isSyncing = false;
      SyncService._notifyListeners('Sync failed');

      console.error('Error syncing data:', error);
      return {
        success: false,
        checkInsSynced: 0,
        messagesSynced: 0,
        errors: [error.message],
      };
    }
  },

  /**
   * Sync offline check-ins
   * @returns {Promise<number>} Number of check-ins synced
   */
  _syncOfflineCheckIns: async () => {
    try {
      const unsyncedCheckIns = await OfflineStorage.getUnsyncedCheckIns();

      if (unsyncedCheckIns.length === 0) {
        return 0;
      }

      SyncService._notifyListeners(
        `Syncing ${unsyncedCheckIns.length} check-in(s)...`
      );

      const syncedIds = [];

      for (const checkIn of unsyncedCheckIns) {
        try {
          // Remove offline ID before sending
          const { id, synced, ...checkInData } = checkIn;

          // Send to backend
          await api.submitCheckIn(checkInData);

          syncedIds.push(id);
        } catch (error) {
          console.error(
            `Error syncing check-in ${checkIn.id}:`,
            error
          );
          // Continue with next check-in if one fails
        }
      }

      // Mark synced items
      if (syncedIds.length > 0) {
        await OfflineStorage.markAsSynced(syncedIds);
      }

      return syncedIds.length;
    } catch (error) {
      console.error('Error syncing check-ins:', error);
      throw error;
    }
  },

  /**
   * Sync offline chat messages
   * @returns {Promise<number>} Number of messages synced
   */
  _syncOfflineChatMessages: async () => {
    try {
      const unsyncedMessages = await OfflineStorage.getUnsyncedChatMessages();

      if (unsyncedMessages.length === 0) {
        return 0;
      }

      SyncService._notifyListeners(
        `Syncing ${unsyncedMessages.length} message(s)...`
      );

      const syncedIds = [];

      for (const message of unsyncedMessages) {
        try {
          // Remove offline ID before sending
          const { id, synced, ...messageData } = message;

          // Send to backend
          await api.sendChatMessage(messageData);

          syncedIds.push(id);
        } catch (error) {
          console.error(
            `Error syncing message ${message.id}:`,
            error
          );
          // Continue with next message if one fails
        }
      }

      // Mark synced items
      if (syncedIds.length > 0) {
        await OfflineStorage.markChatMessagesAsSynced(syncedIds);
      }

      return syncedIds.length;
    } catch (error) {
      console.error('Error syncing chat messages:', error);
      throw error;
    }
  },

  /**
   * Attempt sync when connection is restored
   * Automatically called when device comes online
   */
  attemptSync: async () => {
    const isConnected = await NetworkService.isConnected();

    if (!isConnected) {
      return;
    }

    // Get sync status
    const syncStatus = await OfflineStorage.getSyncStatus();

    if (!syncStatus.hasPendingCheckIns && !syncStatus.hasPendingMessages) {
      return; // Nothing to sync
    }

    // Wait a moment for API to be ready
    setTimeout(() => {
      SyncService.syncAllData();
    }, 1000);
  },

  /**
   * Initialize sync service
   * Set up network listener to attempt sync when online
   */
  initialize: () => {
    NetworkService.subscribe(({ isConnected }) => {
      if (isConnected) {
        SyncService.attemptSync();
      }
    });
  },

  /**
   * Cleanup sync service
   */
  cleanup: () => {
    NetworkService.unsubscribeAll();
    SyncService.syncListeners = [];
  },
};
