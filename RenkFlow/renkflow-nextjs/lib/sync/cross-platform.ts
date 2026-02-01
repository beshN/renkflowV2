// @/lib/sync/cross-platform.ts
import { openDB } from 'idb';

export const SYNC_CHANNEL = 'renkflow-sync-v1';

type AsyncStorageLike = {
  getItem(key: string): Promise<string | null>;
};

let AsyncStorage: AsyncStorageLike | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  AsyncStorage = require('@react-native-async-storage/async-storage').default as AsyncStorageLike;
} catch {
  AsyncStorage = null;
}

export async function syncOfflineQueue(platform: 'web' | 'native') {
  const queue = platform === 'web' 
    ? await getWebQueue()
    : await getNativeQueue();
    
  // Cross-platform sync via API
  for (const item of queue) {
    await fetch('/api/sync', {
      method: 'POST',
      body: JSON.stringify({ ...item, source: platform })
    });
  }
}

export async function getWebQueue() {
  const db = await openDB('renkflow', 1);
  return db.getAll('syncQueue');
}

export async function getNativeQueue() {
  if (!AsyncStorage) return [];
  const data = await AsyncStorage.getItem('syncQueue');
  return data ? JSON.parse(data) : [];
}
