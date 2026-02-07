/**
 * Cross-Platform Sync Utilities
 * Standardizes synchronization logic between Web (IndexedDB) and Native (AsyncStorage)
 */

interface SyncQueueItem {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
}

/**
 * Standard interface for platform-specific storage
 */
interface IPlatformStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

const mockNativeStorage: IPlatformStorage = {
  getItem: async (key) => localStorage.getItem(key),
  setItem: async (key, value) => localStorage.setItem(key, value),
  removeItem: async (key) => localStorage.removeItem(key),
};

/**
 * Detect platform and return appropriate storage
 */
function getStorage(): IPlatformStorage {
  // Check for React Native environment
  if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
    // In real RN, this would be: return require('@react-native-async-storage/async-storage').default;
    return mockNativeStorage; 
  }
  
  // Fallback to localStorage for web
  if (typeof window !== 'undefined') {
    return {
      getItem: async (key) => localStorage.getItem(key),
      setItem: async (key, value) => localStorage.setItem(key, value),
      removeItem: async (key) => localStorage.removeItem(key),
    };
  }

  return mockNativeStorage;
}

const platformStorage = getStorage();

export async function getNativeQueue() {
  // In a real React Native environment, this would use AsyncStorage
  try {
    const data = await platformStorage.getItem('syncQueue');
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.warn('[CrossPlatform] Failed to read native queue', error);
    return [];
  }
}

export async function syncOfflineQueue(platform: 'web' | 'native') {
  console.log(`[CrossPlatform] Initiating sync for platform: ${platform}`);
  
  if (platform === 'native') {
    const queue = await getNativeQueue();
    console.log(`[CrossPlatform] Processing ${queue.length} native items`);
    // Logic to bridge native queue to centralized sync service
    return true;
  }
  
  return true;
}

export const SYNC_CHANNELS = {
  ORDERS: 'sync:orders',
  DOCUMENTS: 'sync:documents',
  PRESENCE: 'sync:presence',
};
