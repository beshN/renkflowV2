'use client';

import React from 'react';

/**
 * SSR-Safe Storage Layer
 * Provides localStorage-like API that works on both server and client
 * with automatic sync between in-memory and localStorage
 */

type StorageListener = (key: string, value: unknown) => void;

class SSRSafeStorage {
  private static instance: SSRSafeStorage;
  private inMemoryStore: Map<string, string> = new Map();
  private listeners: Set<StorageListener> = new Set();
  private isHydrated: boolean = false;

  private constructor() {
    if (this.isClient()) {
      this.hydrateFromLocalStorage();
      this.setupStorageListener();
    }
  }

  static getInstance(): SSRSafeStorage {
    if (!SSRSafeStorage.instance) {
      SSRSafeStorage.instance = new SSRSafeStorage();
    }
    return SSRSafeStorage.instance;
  }

  private isClient(): boolean {
    return typeof window !== 'undefined';
  }

  private hydrateFromLocalStorage(): void {
    if (!this.isClient() || this.isHydrated) return;

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key);
          if (value) {
            this.inMemoryStore.set(key, value);
          }
        }
      }
      this.isHydrated = true;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[SSRSafeStorage] Failed to hydrate from localStorage:', error);
      }
    }
  }

  private setupStorageListener(): void {
    if (!this.isClient()) return;

    window.addEventListener('storage', (event) => {
      if (event.key && event.newValue !== null) {
        this.inMemoryStore.set(event.key, event.newValue);
        this.notifyListeners(event.key, JSON.parse(event.newValue));
      } else if (event.key && event.newValue === null) {
        this.inMemoryStore.delete(event.key);
        this.notifyListeners(event.key, null);
      }
    });
  }

  private notifyListeners(key: string, value: unknown): void {
    this.listeners.forEach((listener) => {
      try {
        listener(key, value);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[SSRSafeStorage] Listener error:', error);
        }
      }
    });
  }

  getItem<T>(key: string, defaultValue: T): T {
    try {
      // Try in-memory first
      const inMemory = this.inMemoryStore.get(key);
      if (inMemory) {
        return JSON.parse(inMemory) as T;
      }

      // Try localStorage on client
      if (this.isClient()) {
        const stored = localStorage.getItem(key);
        if (stored) {
          const parsed = JSON.parse(stored) as T;
          this.inMemoryStore.set(key, stored);
          return parsed;
        }
      }

      return defaultValue;
    } catch {
      return defaultValue;
    }
  }

  setItem<T>(key: string, value: T): void {
    try {
      const serialized = JSON.stringify(value);
      this.inMemoryStore.set(key, serialized);

      if (this.isClient()) {
        localStorage.setItem(key, serialized);
      }

      this.notifyListeners(key, value);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[SSRSafeStorage] Failed to set item:', error);
      }
    }
  }

  removeItem(key: string): void {
    try {
      this.inMemoryStore.delete(key);

      if (this.isClient()) {
        localStorage.removeItem(key);
      }

      this.notifyListeners(key, null);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[SSRSafeStorage] Failed to remove item:', error);
      }
    }
  }

  subscribe(listener: StorageListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  clear(): void {
    try {
      this.inMemoryStore.clear();

      if (this.isClient()) {
        localStorage.clear();
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[SSRSafeStorage] Failed to clear storage:', error);
      }
    }
  }
}

export const storage = SSRSafeStorage.getInstance();

/**
 * React hook for SSR-safe storage with automatic re-render on changes
 */
export function useSSRStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = React.useState<T>(() => {
    return storage.getItem(key, initialValue);
  });

  React.useEffect(() => {
    // Hydrate on client
    const value = storage.getItem(key, initialValue);
    setStoredValue(value);

    // Subscribe to changes
    const unsubscribe = storage.subscribe((changedKey, newValue) => {
      if (changedKey === key) {
        setStoredValue(newValue as T ?? initialValue);
      }
    });

    return unsubscribe;
  }, [key, initialValue]);

  const setValue = React.useCallback((value: T | ((prev: T) => T)) => {
    setStoredValue((prev) => {
      const newValue = value instanceof Function ? value(prev) : value;
      storage.setItem(key, newValue);
      return newValue;
    });
  }, [key]);

  return [storedValue, setValue];
}
