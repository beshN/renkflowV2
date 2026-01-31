'use client';

/**
 * IndexedDB Storage Layer for Offline-First PWA
 * Provides persistent storage that works offline
 */

const DB_NAME = 'renkflow-offline';
const DB_VERSION = 1;

interface StoreConfig {
  name: string;
  keyPath: string;
  indexes?: { name: string; keyPath: string | string[]; unique?: boolean }[];
}

const STORES: StoreConfig[] = [
  {
    name: 'orders',
    keyPath: 'id',
    indexes: [
      { name: 'by-status', keyPath: 'status' },
      { name: 'by-customer', keyPath: 'customer' },
      { name: 'by-date', keyPath: 'date' },
      { name: 'by-tenantId', keyPath: 'tenantId' },
      { name: 'by-syncStatus', keyPath: '_syncStatus' },
    ],
  },
  {
    name: 'documents',
    keyPath: 'id',
    indexes: [
      { name: 'by-orderId', keyPath: 'orderId' },
      { name: 'by-syncStatus', keyPath: '_syncStatus' },
    ],
  },
  {
    name: 'syncQueue',
    keyPath: 'id',
    indexes: [
      { name: 'by-status', keyPath: 'status' },
      { name: 'by-timestamp', keyPath: 'timestamp' },
      { name: 'by-resourceType', keyPath: 'resourceType' },
    ],
  },
  {
    name: 'metadata',
    keyPath: 'key',
  },
];

type SyncStatus = 'synced' | 'pending' | 'conflict' | 'error';

interface WithSyncMetadata {
  _syncStatus?: SyncStatus;
  _localVersion?: number;
  _serverVersion?: number;
  _lastSyncedAt?: number;
  _modifiedAt?: number;
}

class IndexedDBStorage {
  private static instance: IndexedDBStorage;
  private db: IDBDatabase | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): IndexedDBStorage {
    if (!IndexedDBStorage.instance) {
      IndexedDBStorage.instance = new IndexedDBStorage();
    }
    return IndexedDBStorage.instance;
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        console.warn('[IndexedDB] Not available in this environment');
        resolve();
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[IndexedDB] Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        console.log('[IndexedDB] Database opened successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        STORES.forEach((storeConfig) => {
          if (!db.objectStoreNames.contains(storeConfig.name)) {
            const store = db.createObjectStore(storeConfig.name, {
              keyPath: storeConfig.keyPath,
            });

            storeConfig.indexes?.forEach((index) => {
              store.createIndex(index.name, index.keyPath, {
                unique: index.unique || false,
              });
            });

            console.log(`[IndexedDB] Created store: ${storeConfig.name}`);
          }
        });
      };
    });

    return this.initPromise;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.init();
    }
    if (!this.db) {
      throw new Error('IndexedDB not available');
    }
  }

  private getStore(storeName: string, mode: IDBTransactionMode): IDBObjectStore {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    const transaction = this.db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  // ============================================
  // CRUD Operations
  // ============================================

  async get<T>(storeName: string, key: string): Promise<T | null> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const store = this.getStore(storeName, 'readonly');
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const store = this.getStore(storeName, 'readonly');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async put<T extends WithSyncMetadata>(
    storeName: string,
    data: T,
    markAsPending = true
  ): Promise<T> {
    await this.ensureInitialized();

    const dataWithMeta: T = {
      ...data,
      _modifiedAt: Date.now(),
      _syncStatus: markAsPending ? 'pending' : (data._syncStatus || 'synced'),
      _localVersion: (data._localVersion || 0) + 1,
    };

    return new Promise((resolve, reject) => {
      const store = this.getStore(storeName, 'readwrite');
      const request = store.put(dataWithMeta);

      request.onsuccess = () => resolve(dataWithMeta);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName: string, key: string): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const store = this.getStore(storeName, 'readwrite');
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName: string): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const store = this.getStore(storeName, 'readwrite');
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ============================================
  // Index Queries
  // ============================================

  async getByIndex<T>(
    storeName: string,
    indexName: string,
    value: IDBValidKey
  ): Promise<T[]> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const store = this.getStore(storeName, 'readonly');
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingSync<T>(storeName: string): Promise<T[]> {
    return this.getByIndex<T>(storeName, 'by-syncStatus', 'pending');
  }

  async getConflicts<T>(storeName: string): Promise<T[]> {
    return this.getByIndex<T>(storeName, 'by-syncStatus', 'conflict');
  }

  // ============================================
  // Bulk Operations
  // ============================================

  async bulkPut<T extends WithSyncMetadata>(
    storeName: string,
    items: T[],
    markAsPending = true
  ): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      items.forEach((item) => {
        const dataWithMeta: T = {
          ...item,
          _modifiedAt: Date.now(),
          _syncStatus: markAsPending ? 'pending' : (item._syncStatus || 'synced'),
          _localVersion: (item._localVersion || 0) + 1,
        };
        store.put(dataWithMeta);
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async bulkDelete(storeName: string, keys: string[]): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      keys.forEach((key) => store.delete(key));

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // ============================================
  // Sync Metadata
  // ============================================

  async markAsSynced<T extends WithSyncMetadata>(
    storeName: string,
    key: string,
    serverVersion?: number
  ): Promise<void> {
    const item = await this.get<T>(storeName, key);
    if (item) {
      await this.put(
        storeName,
        {
          ...item,
          _syncStatus: 'synced' as SyncStatus,
          _serverVersion: serverVersion || item._localVersion,
          _lastSyncedAt: Date.now(),
        },
        false
      );
    }
  }

  async markAsConflict<T extends WithSyncMetadata>(
    storeName: string,
    key: string
  ): Promise<void> {
    const item = await this.get<T>(storeName, key);
    if (item) {
      await this.put(
        storeName,
        {
          ...item,
          _syncStatus: 'conflict' as SyncStatus,
        },
        false
      );
    }
  }

  // ============================================
  // Metadata Store
  // ============================================

  async getMetadata<T>(key: string): Promise<T | null> {
    const result = await this.get<{ key: string; value: T }>('metadata', key);
    return result?.value || null;
  }

  async setMetadata<T>(key: string, value: T): Promise<void> {
    await this.put('metadata', { key, value }, false);
  }

  // ============================================
  // Database Info
  // ============================================

  async getStorageEstimate(): Promise<{ used: number; quota: number } | null> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage || 0,
        quota: estimate.quota || 0,
      };
    }
    return null;
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isInitialized = false;
    }
  }
}

export const offlineDB = IndexedDBStorage.getInstance();
export { IndexedDBStorage };
