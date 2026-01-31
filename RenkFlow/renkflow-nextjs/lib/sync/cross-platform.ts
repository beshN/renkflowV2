// @/lib/sync/cross-platform.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { openDB } from 'idb';

export const SYNC_CHANNEL = 'renkflow-sync-v1';

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
  const data = await AsyncStorage.getItem('syncQueue');
  return data ? JSON.parse(data) : [];
}
