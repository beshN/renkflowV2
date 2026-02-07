/**
 * SSR-Safe Storage Layer
 * 
 * Provides a unified storage API that works seamlessly on both
 * server-side and client-side rendering contexts.
 * 
 * Features:
 * - In-memory fallback for SSR
 * - localStorage persistence for CSR
 * - Cross-tab synchronization
 * - Type-safe generic API
 * - Automatic JSON serialization
 */

type StorageEventHandler<T> = (newValue: T | null) => void;

class SSRSafeStorage {
  private inMemoryStore: Map<string, string> = new Map();
  private listeners: Map<string, Set<StorageEventHandler<unknown>>> = new Map();

  /**
   * Check if running on client-side
   */
  private isClient(): boolean {
    return typeof window !== 'undefined';
  }

  /**
   * Initialize cross-tab synchronization
   */
  constructor() {
    if (this.isClient()) {
      window.addEventListener('storage', (event) => {
        if (event.key && this.listeners.has(event.key)) {
          const handlers = this.listeners.get(event.key)!;
          const newValue = event.newValue ? this.parseJSON(event.newValue) : null;
          handlers.forEach(handler => handler(newValue));
        }
      });
    }
  }

  /**
   * Safely parse JSON with error handling
   */
  private parseJSON<T>(value: string): T | null {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  /**
   * Get item from storage with type safety
   */
  getItem<T>(key: string, defaultValue: T): T {
    try {
      // Server-side: use in-memory store
      if (!this.isClient()) {
        const stored = this.inMemoryStore.get(key);
        if (stored) {
          const parsed = this.parseJSON<T>(stored);
          return parsed !== null ? parsed : defaultValue;
        }
        return defaultValue;
      }

      // Client-side: use localStorage
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = this.parseJSON<T>(stored);
        return parsed !== null ? parsed : defaultValue;
      }
      return defaultValue;
    } catch (error) {
      console.error(`[SSRSafeStorage] Error getting item "${key}":`, error);
      return defaultValue;
    }
  }

  /**
   * Set item in storage
   */
  setItem<T>(key: string, value: T): void {
    try {
      const serialized = JSON.stringify(value);

      // Always update in-memory store
      this.inMemoryStore.set(key, serialized);

      // Update localStorage if on client
      if (this.isClient()) {
        localStorage.setItem(key, serialized);
      }

      // Notify local listeners (cross-tab handled by storage event)
      this.notifyListeners(key, value);
    } catch (error) {
      console.error(`[SSRSafeStorage] Error setting item "${key}":`, error);
    }
  }

  /**
   * Remove item from storage
   */
  removeItem(key: string): void {
    try {
      this.inMemoryStore.delete(key);

      if (this.isClient()) {
        localStorage.removeItem(key);
      }

      this.notifyListeners(key, null);
    } catch (error) {
      console.error(`[SSRSafeStorage] Error removing item "${key}":`, error);
    }
  }

  /**
   * Clear all items from storage
   */
  clear(): void {
    try {
      this.inMemoryStore.clear();

      if (this.isClient()) {
        localStorage.clear();
      }
    } catch (error) {
      console.error('[SSRSafeStorage] Error clearing storage:', error);
    }
  }

  /**
   * Subscribe to storage changes for a specific key
   */
  subscribe<T>(key: string, handler: StorageEventHandler<T>): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    
    const handlers = this.listeners.get(key)!;
    handlers.add(handler as StorageEventHandler<unknown>);

    // Return unsubscribe function
    return () => {
      handlers.delete(handler as StorageEventHandler<unknown>);
      if (handlers.size === 0) {
        this.listeners.delete(key);
      }
    };
  }

  /**
   * Notify listeners of value changes
   */
  private notifyListeners<T>(key: string, value: T | null): void {
    const handlers = this.listeners.get(key);
    if (handlers) {
      handlers.forEach(handler => handler(value));
    }
  }

  /**
   * Check if a key exists in storage
   */
  hasItem(key: string): boolean {
    if (!this.isClient()) {
      return this.inMemoryStore.has(key);
    }
    return localStorage.getItem(key) !== null;
  }

  /**
   * Get all keys in storage
   */
  keys(): string[] {
    if (!this.isClient()) {
      return Array.from(this.inMemoryStore.keys());
    }
    return Object.keys(localStorage);
  }
}

// Singleton instance
export const ssrSafeStorage = new SSRSafeStorage();

// Hook for React components
import { useState, useEffect, useCallback } from 'react';

export function useStorage<T>(key: string, defaultValue: T): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    return ssrSafeStorage.getItem(key, defaultValue);
  });

  // Sync with storage changes (including cross-tab)
  useEffect(() => {
    const unsubscribe = ssrSafeStorage.subscribe<T>(key, (newValue) => {
      if (newValue !== null) {
        setStoredValue(newValue);
      }
    });

    return unsubscribe;
  }, [key]);

  const setValue = useCallback((value: T) => {
    setStoredValue(value);
    ssrSafeStorage.setItem(key, value);
  }, [key]);

  return [storedValue, setValue];
}

export default ssrSafeStorage;
