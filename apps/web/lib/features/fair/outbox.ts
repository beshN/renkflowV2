'use client';
import { openDB, type IDBPDatabase } from 'idb';
import { createDesign, type DesignPayload } from './client';

/**
 * The kiosk's queue of designs not yet on the server. Kept in IndexedDB so a reset of the kiosk
 * screen, a reload or a power cut never loses a visitor's design; entries leave the queue only
 * after the server has confirmed them.
 */
type Entry = DesignPayload & { queuedAt: number; attempts: number; lastError?: string };
let db: Promise<IDBPDatabase> | null = null;
const open = () => (db ??= openDB('rf-configurator', 1, { upgrade: (d) => d.createObjectStore('outbox', { keyPath: 'token' }) }));

export async function queueDesign(payload: DesignPayload) {
  await (await open()).put('outbox', { ...payload, queuedAt: Date.now(), attempts: 0 } satisfies Entry);
}

export async function pendingCount(): Promise<number> {
  try {
    return await (await open()).count('outbox');
  } catch {
    return 0;
  }
}

let running: Promise<number> | null = null;
/** Sends every queued design; returns how many are still waiting. Safe to call often. */
export function syncOutbox(): Promise<number> {
  running ??= (async () => {
    try {
      const store = await open();
      const entries = (await store.getAll('outbox')) as Entry[];
      for (const entry of entries) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) break;
        const { queuedAt: _q, attempts, lastError: _e, ...payload } = entry;
        const result = await createDesign(payload);
        // Stored now or already there (a phone opened it first): either way the server has it.
        if (result.ok) await store.delete('outbox', entry.token);
        else if (result.status === 400) await store.put('outbox', { ...entry, attempts: attempts + 1, lastError: `rejected: ${result.error}` });
        else {
          await store.put('outbox', { ...entry, attempts: attempts + 1, lastError: result.error });
          break;
        }
      }
      return await store.count('outbox');
    } catch {
      return pendingCount();
    } finally {
      running = null;
    }
  })();
  return running;
}
