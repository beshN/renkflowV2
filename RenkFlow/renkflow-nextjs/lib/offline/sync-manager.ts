/**
 * Offline Sync Manager
 * Handles offline changes queue and conflict resolution
 */

import { Order } from '@/lib/types';
import { useOrdersStore, SyncQueueItem } from '@/lib/stores/orders.store';

// ============================================
// Types
// ============================================

export interface SyncConflict {
  id: string;
  localVersion: Partial<Order>;
  serverVersion: Order;
  localTimestamp: number;
  serverTimestamp: number;
  field: string;
}

export type ConflictResolution = 'local' | 'server' | 'merge';

export interface SyncResult {
  success: boolean;
  processed: number;
  failed: number;
  conflicts: SyncConflict[];
}

// ============================================
// IndexedDB Operations
// ============================================

const DB_NAME = 'renkflow_offline';
const DB_VERSION = 1;
const SYNC_QUEUE_STORE = 'sync_queue';
const ORDERS_CACHE_STORE = 'orders_cache';

let db: IDBDatabase | null = null;

async function openDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Sync queue store
      if (!database.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
        const syncStore = database.createObjectStore(SYNC_QUEUE_STORE, { keyPath: 'id' });
        syncStore.createIndex('timestamp', 'timestamp', { unique: false });
        syncStore.createIndex('type', 'type', { unique: false });
      }

      // Orders cache store
      if (!database.objectStoreNames.contains(ORDERS_CACHE_STORE)) {
        const ordersStore = database.createObjectStore(ORDERS_CACHE_STORE, { keyPath: 'id' });
        ordersStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
  });
}

// ============================================
// Sync Queue Operations
// ============================================

export async function addToQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retries'>): Promise<void> {
  const database = await openDB();
  
  const queueItem: SyncQueueItem = {
    ...item,
    id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    retries: 0,
  };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([SYNC_QUEUE_STORE], 'readwrite');
    const store = transaction.objectStore(SYNC_QUEUE_STORE);
    const request = store.add(queueItem);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getQueueItems(): Promise<SyncQueueItem[]> {
  const database = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([SYNC_QUEUE_STORE], 'readonly');
    const store = transaction.objectStore(SYNC_QUEUE_STORE);
    const index = store.index('timestamp');
    const request = index.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function removeFromQueue(id: string): Promise<void> {
  const database = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([SYNC_QUEUE_STORE], 'readwrite');
    const store = transaction.objectStore(SYNC_QUEUE_STORE);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function incrementRetries(id: string): Promise<void> {
  const database = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([SYNC_QUEUE_STORE], 'readwrite');
    const store = transaction.objectStore(SYNC_QUEUE_STORE);
    const getRequest = store.get(id);

    getRequest.onerror = () => reject(getRequest.error);
    getRequest.onsuccess = () => {
      const item = getRequest.result;
      if (item) {
        item.retries++;
        const putRequest = store.put(item);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      } else {
        resolve();
      }
    };
  });
}

// ============================================
// Orders Cache Operations
// ============================================

export async function cacheOrders(orders: Order[]): Promise<void> {
  const database = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([ORDERS_CACHE_STORE], 'readwrite');
    const store = transaction.objectStore(ORDERS_CACHE_STORE);

    // Clear existing cache
    store.clear();

    // Add all orders
    orders.forEach((order) => {
      store.add({ ...order, cachedAt: Date.now() });
    });

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getCachedOrders(): Promise<Order[]> {
  const database = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([ORDERS_CACHE_STORE], 'readonly');
    const store = transaction.objectStore(ORDERS_CACHE_STORE);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function updateCachedOrder(order: Order): Promise<void> {
  const database = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([ORDERS_CACHE_STORE], 'readwrite');
    const store = transaction.objectStore(ORDERS_CACHE_STORE);
    const request = store.put({ ...order, cachedAt: Date.now() });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// ============================================
// Sync Manager
// ============================================

const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // 1 second

export class SyncManager {
  private isOnline: boolean = navigator.onLine;
  private isSyncing: boolean = false;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }
  }

  private handleOnline = () => {
    this.isOnline = true;
    useOrdersStore.getState().setOffline(false);
    this.startSync();
  };

  private handleOffline = () => {
    this.isOnline = false;
    useOrdersStore.getState().setOffline(true);
    this.stopSync();
  };

  public startSync(intervalMs: number = 30000): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Immediate sync
    this.processQueue();

    // Start interval
    this.syncInterval = setInterval(() => {
      this.processQueue();
    }, intervalMs);
  }

  public stopSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  public async processQueue(): Promise<SyncResult> {
    if (!this.isOnline || this.isSyncing) {
      return { success: false, processed: 0, failed: 0, conflicts: [] };
    }

    this.isSyncing = true;
    const result: SyncResult = {
      success: true,
      processed: 0,
      failed: 0,
      conflicts: [],
    };

    try {
      const items = await getQueueItems();

      for (const item of items) {
        try {
          await this.processItem(item);
          await removeFromQueue(item.id);
          result.processed++;
        } catch (error: any) {
          // Check if it's a conflict
          if (error.type === 'conflict') {
            result.conflicts.push(error.conflict);
          }

          // Increment retries
          await incrementRetries(item.id);

          // Remove if max retries exceeded
          if (item.retries >= MAX_RETRIES) {
            await removeFromQueue(item.id);
            result.failed++;
          }
        }
      }

      // Update last sync time
      useOrdersStore.getState().setLastSyncAt(new Date());
    } finally {
      this.isSyncing = false;
    }

    return result;
  }

  private async processItem(item: SyncQueueItem): Promise<void> {
    const baseUrl = '/api/v1/orders';

    switch (item.type) {
      case 'create':
        await fetch(baseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.data),
        }).then((res) => {
          if (!res.ok) throw new Error('Failed to create order');
        });
        break;

      case 'update':
        if (!item.data.id) throw new Error('Order ID required for update');
        
        // Check for conflicts first
        const serverOrder = await fetch(`${baseUrl}/${item.data.id}`).then((res) => res.json());
        
        if (serverOrder.updatedAt > item.timestamp) {
          throw {
            type: 'conflict',
            conflict: {
              id: item.data.id,
              localVersion: item.data,
              serverVersion: serverOrder,
              localTimestamp: item.timestamp,
              serverTimestamp: serverOrder.updatedAt,
              field: 'multiple',
            },
          };
        }

        await fetch(`${baseUrl}/${item.data.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.data),
        }).then((res) => {
          if (!res.ok) throw new Error('Failed to update order');
        });
        break;

      case 'delete':
        if (!item.data.id) throw new Error('Order ID required for delete');
        await fetch(`${baseUrl}/${item.data.id}`, {
          method: 'DELETE',
        }).then((res) => {
          if (!res.ok) throw new Error('Failed to delete order');
        });
        break;
    }
  }

  public async resolveConflict(
    conflict: SyncConflict,
    resolution: ConflictResolution
  ): Promise<void> {
    switch (resolution) {
      case 'local':
        // Apply local version to server
        await fetch(`/api/v1/orders/${conflict.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...conflict.localVersion,
            _forceUpdate: true,
          }),
        });
        break;

      case 'server':
        // Update local with server version
        useOrdersStore.getState().updateOrder(conflict.id, conflict.serverVersion);
        break;

      case 'merge':
        // Merge both versions (local takes precedence for changed fields)
        const merged = { ...conflict.serverVersion, ...conflict.localVersion };
        await fetch(`/api/v1/orders/${conflict.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(merged),
        });
        useOrdersStore.getState().updateOrder(conflict.id, merged);
        break;
    }
  }

  public destroy(): void {
    this.stopSync();
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }
  }
}

// Singleton instance
let syncManagerInstance: SyncManager | null = null;

export function getSyncManager(): SyncManager {
  if (!syncManagerInstance) {
    syncManagerInstance = new SyncManager();
  }
  return syncManagerInstance;
}

// ============================================
// React Hook
// ============================================

import { useEffect, useState } from 'react';

export function useSyncManager() {
  const [syncManager] = useState(() => getSyncManager());
  const { isOffline, syncQueue } = useOrdersStore();

  useEffect(() => {
    if (!isOffline) {
      syncManager.startSync();
    }

    return () => {
      syncManager.stopSync();
    };
  }, [isOffline, syncManager]);

  return {
    isOffline,
    pendingChanges: syncQueue.length,
    forceSync: () => syncManager.processQueue(),
  };
}
