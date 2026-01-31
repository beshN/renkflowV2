/**
 * Offline-First PWA - Main Export
 */

// IndexedDB Storage
export { offlineDB, IndexedDBStorage } from './indexeddb';

// Sync Queue
export { syncQueue, SyncQueue } from './sync-queue';
export type { SyncQueueStatus, SyncQueueEvent } from './sync-queue';

// React Hooks
export {
  useOnlineStatus,
  useSyncStatus,
  useOfflineData,
  useOfflineOrders,
  useSyncEvents,
  useBackgroundSync,
  useStorageQuota,
  useConflictQueue,
} from './hooks';

// Provider
export { OfflineProvider, useOffline } from './provider';
