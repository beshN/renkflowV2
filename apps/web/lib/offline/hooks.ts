'use client';

import React from 'react';
import { offlineDB } from './indexeddb';
import type { WithSyncMetadata } from './indexeddb';
import { syncQueue, SyncQueueStatus, SyncQueueEvent } from './sync-queue';
import type { SyncOperation, SyncOperationType } from '../realtime/types';

/**
 * React Hooks for Offline-First Functionality
 */

// ============================================
// Online Status Hook
// ============================================

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = React.useState(() => {
    if (typeof window === 'undefined') return true;
    return navigator.onLine;
  });

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

// ============================================
// Sync Status Hook
// ============================================

interface UseSyncStatusResult {
  status: SyncQueueStatus;
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  hasConflicts: boolean;
  sync: () => Promise<void>;
  retryFailed: () => Promise<void>;
}

export function useSyncStatus(): UseSyncStatusResult {
  const [status, setStatus] = React.useState<SyncQueueStatus>({
    isOnline: true,
    isProcessing: false,
    pendingCount: 0,
    failedCount: 0,
    conflictCount: 0,
  });

  React.useEffect(() => {
    // Initial status. Without browser storage (private mode, quota) the default status stays.
    syncQueue.getStatus().then(setStatus).catch(() => {});

    // Subscribe to events
    const unsubscribe = syncQueue.onEvent((event) => {
      syncQueue.getStatus().then(setStatus).catch(() => {});
    });

    return unsubscribe;
  }, []);

  const sync = React.useCallback(async () => {
    await syncQueue.processQueue();
  }, []);

  const retryFailed = React.useCallback(async () => {
    await syncQueue.retryFailed();
  }, []);

  return {
    status,
    isOnline: status.isOnline,
    isSyncing: status.isProcessing,
    pendingCount: status.pendingCount,
    hasConflicts: status.conflictCount > 0,
    sync,
    retryFailed,
  };
}

// ============================================
// Offline Data Hook
// ============================================

interface UseOfflineDataOptions<T> {
  storeName: string;
  serverFetcher: () => Promise<T[]>;
  syncOnMount?: boolean;
}

interface UseOfflineDataResult<T> {
  data: T[];
  isLoading: boolean;
  error: Error | null;
  isStale: boolean;
  refresh: () => Promise<void>;
  add: (item: T) => Promise<void>;
  update: (id: string, updates: Partial<T>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useOfflineData<T extends { id: string } & WithSyncMetadata>(
  options: UseOfflineDataOptions<T>
): UseOfflineDataResult<T> {
  const { storeName, serverFetcher, syncOnMount = true } = options;
  const isOnline = useOnlineStatus();

  const [data, setData] = React.useState<T[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [isStale, setIsStale] = React.useState(false);

  // Load from IndexedDB
  const loadFromDB = React.useCallback(async () => {
    try {
      const localData = await offlineDB.getAll<T>(storeName);
      setData(localData);
      return localData;
    } catch (err) {
      console.error('[useOfflineData] Failed to load from DB:', err);
      return [];
    }
  }, [storeName]);

  // Sync with server
  const syncWithServer = React.useCallback(async () => {
    if (!isOnline) {
      setIsStale(true);
      return;
    }

    try {
      const serverData = await serverFetcher();
      
      // Update IndexedDB with server data
      await offlineDB.bulkPut(storeName, serverData, false);
      
      // Reload from DB to get merged data
      const merged = await loadFromDB();
      setData(merged);
      setIsStale(false);
      setError(null);

      // Update last sync time
      await offlineDB.setMetadata(`${storeName}_lastSync`, Date.now());
    } catch (err) {
      console.error('[useOfflineData] Server sync failed:', err);
      setError(err as Error);
      setIsStale(true);
    }
  }, [isOnline, serverFetcher, storeName, loadFromDB]);

  // Initial load
  React.useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await offlineDB.init();
      await loadFromDB();
      
      if (syncOnMount && isOnline) {
        await syncWithServer();
      }
      
      setIsLoading(false);
    };

    init();
  }, [loadFromDB, syncOnMount, isOnline, syncWithServer]);

  // Auto-sync when coming online
  React.useEffect(() => {
    if (isOnline && isStale) {
      syncWithServer();
    }
  }, [isOnline, isStale, syncWithServer]);

  // CRUD operations with sync queue
  const add = React.useCallback(async (item: T) => {
    // Save locally
    await offlineDB.put(storeName, item);
    
    // Update state
    setData((prev) => [...prev, item]);
    
    // Queue for sync
    await syncQueue.enqueue('create', storeName as 'order' | 'document', item.id, item);
  }, [storeName]);

  const update = React.useCallback(async (id: string, updates: Partial<T>) => {
    // Get existing item
    const existing = await offlineDB.get<T>(storeName, id);
    if (!existing) return;

    const updated = { ...existing, ...updates };
    
    // Save locally
    await offlineDB.put(storeName, updated);
    
    // Update state
    setData((prev) => prev.map((item) => (item.id === id ? updated : item)));
    
    // Queue for sync
    await syncQueue.enqueue('update', storeName as 'order' | 'document', id, updated);
  }, [storeName]);

  const remove = React.useCallback(async (id: string) => {
    // Delete locally
    await offlineDB.delete(storeName, id);
    
    // Update state
    setData((prev) => prev.filter((item) => item.id !== id));
    
    // Queue for sync
    await syncQueue.enqueue('delete', storeName as 'order' | 'document', id, { id });
  }, [storeName]);

  return {
    data,
    isLoading,
    error,
    isStale,
    refresh: syncWithServer,
    add,
    update,
    remove,
  };
}

// ============================================
// Offline Orders Hook
// ============================================

interface Order {
  id: string;
  customer: string;
  status: string;
  [key: string]: unknown;
}

interface UseOfflineOrdersResult extends Omit<UseOfflineDataResult<Order>, 'add' | 'update' | 'remove'> {
  addOrder: (order: Order) => Promise<void>;
  updateOrder: (id: string, updates: Partial<Order>) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
  updateStatus: (id: string, status: string) => Promise<void>;
}

export function useOfflineOrders(
  serverFetcher: () => Promise<Order[]>
): UseOfflineOrdersResult {
  const {
    data,
    isLoading,
    error,
    isStale,
    refresh,
    add,
    update,
    remove,
  } = useOfflineData<Order>({
    storeName: 'orders',
    serverFetcher,
  });

  const updateStatus = React.useCallback(async (id: string, status: string) => {
    await update(id, { status });
  }, [update]);

  return {
    data,
    isLoading,
    error,
    isStale,
    refresh,
    addOrder: add,
    updateOrder: update,
    deleteOrder: remove,
    updateStatus,
  };
}

// ============================================
// Sync Queue Event Hook
// ============================================

export function useSyncEvents(
  onEvent?: (event: SyncQueueEvent) => void
): void {
  React.useEffect(() => {
    if (!onEvent) return;
    
    const unsubscribe = syncQueue.onEvent(onEvent);
    return unsubscribe;
  }, [onEvent]);
}

// ============================================
// Background Sync Registration
// ============================================

export function useBackgroundSync(): {
  register: () => Promise<boolean>;
  isSupported: boolean;
} {
  const [isSupported, setIsSupported] = React.useState(false);

  React.useEffect(() => {
    setIsSupported('serviceWorker' in navigator && 'SyncManager' in window);
  }, []);

  const register = React.useCallback(async () => {
    if (!isSupported) return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      await (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register('sync-orders');
      return true;
    } catch (error) {
      console.error('[BackgroundSync] Registration failed:', error);
      return false;
    }
  }, [isSupported]);

  return { register, isSupported };
}

// ============================================
// Storage Quota Hook
// ============================================

interface StorageQuota {
  used: number;
  quota: number;
  percentage: number;
}

export function useStorageQuota(): StorageQuota | null {
  const [quota, setQuota] = React.useState<StorageQuota | null>(null);

  React.useEffect(() => {
    const checkQuota = async () => {
      const estimate = await offlineDB.getStorageEstimate();
      if (estimate) {
        setQuota({
          used: estimate.used,
          quota: estimate.quota,
          percentage: (estimate.used / estimate.quota) * 100,
        });
      }
    };

    checkQuota();

    // Check periodically
    const interval = setInterval(checkQuota, 60000);
    return () => clearInterval(interval);
  }, []);

  return quota;
}

// ============================================
// Conflict Resolution Hook
// ============================================

interface UseConflictQueueResult {
  conflicts: Array<{
    id: string;
    resourceType: string;
    resourceId: string;
    localData: unknown;
    timestamp: number;
  }>;
  resolveWithLocal: (operationId: string) => Promise<void>;
  resolveWithServer: (operationId: string) => Promise<void>;
  resolveWithMerged: (operationId: string, mergedData: unknown) => Promise<void>;
}

export function useConflictQueue(): UseConflictQueueResult {
  const [conflicts, setConflicts] = React.useState<UseConflictQueueResult['conflicts']>([]);

  React.useEffect(() => {
    const loadConflicts = async () => {
      const ops = await syncQueue.getConflictedOperations();
      setConflicts(
        ops.map((op) => ({
          id: op.id,
          resourceType: op.resourceType,
          resourceId: op.resourceId,
          localData: op.data,
          timestamp: op.timestamp,
        }))
      );
    };

    loadConflicts();

    const unsubscribe = syncQueue.onEvent((event) => {
      if (event.type === 'conflict_pending' || event.type === 'conflict_resolved') {
        loadConflicts();
      }
    });

    return unsubscribe;
  }, []);

  const resolveWithLocal = React.useCallback(async (operationId: string) => {
    const operation = conflicts.find((c) => c.id === operationId);
    if (!operation) return;

    await offlineDB.put('syncQueue', {
      id: operationId,
      type: 'update' as SyncOperationType,
      resourceType: operation.resourceType,
      resourceId: operation.resourceId,
      data: operation.localData,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3,
      status: 'pending',
    } as any);

    syncQueue.processQueue();
  }, [conflicts]);

  const resolveWithServer = React.useCallback(async (operationId: string) => {
    // Remove from queue - server version wins
    await offlineDB.delete('syncQueue', operationId);
    
    // Refresh local data from server would happen on next sync
    syncQueue.processQueue();
  }, []);

  const resolveWithMerged = React.useCallback(async (operationId: string, mergedData: unknown) => {
    const operation = conflicts.find((c) => c.id === operationId);
    if (!operation) return;

    await offlineDB.put('syncQueue', {
      id: operationId,
      type: 'update' as SyncOperationType,
      resourceType: operation.resourceType,
      resourceId: operation.resourceId,
      data: mergedData,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3,
      status: 'pending',
    } as any);

    syncQueue.processQueue();
  }, [conflicts]);

  return {
    conflicts,
    resolveWithLocal,
    resolveWithServer,
    resolveWithMerged,
  };
}
