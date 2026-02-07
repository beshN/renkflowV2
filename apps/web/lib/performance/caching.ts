// Caching utilities for performance optimization
// Includes memory cache, localStorage, and SWR patterns

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number;
}

/**
 * LRU (Least Recently Used) Memory Cache
 * O(1) get and set operations
 */
export class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) return undefined;
    
    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return undefined;
    }
    
    // Move to front (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    return entry.value;
  }

  set(key: string, value: T, ttl: number = 5 * 60 * 1000): void {
    // Delete if exists to move to front
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const keys = Array.from(this.cache.keys());
      const firstKey = keys[0];
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl,
    });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  size(): number {
    return this.cache.size;
  }
}

// Global cache instance
export const globalCache = new LRUCache<any>(200);

/**
 * LocalStorage cache with expiration
 */
export const localStorageCache = {
  get<T>(key: string): T | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const item = localStorage.getItem(key);
      if (!item) return null;
      
      const entry: CacheEntry<T> = JSON.parse(item);
      
      if (Date.now() - entry.timestamp > entry.ttl) {
        localStorage.removeItem(key);
        return null;
      }
      
      return entry.value;
    } catch (e) {
      console.warn('localStorage get error:', e);
      return null;
    }
  },

  set<T>(key: string, value: T, ttl: number = 24 * 60 * 60 * 1000): void {
    if (typeof window === 'undefined') return;
    
    try {
      const entry: CacheEntry<T> = {
        value,
        timestamp: Date.now(),
        ttl,
      };
      localStorage.setItem(key, JSON.stringify(entry));
    } catch (e) {
      console.warn('localStorage set error:', e);
    }
  },

  remove(key: string): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
  },

  clear(): void {
    if (typeof window === 'undefined') return;
    localStorage.clear();
  },
};

/**
 * SWR (Stale-While-Revalidate) pattern implementation
 * Returns cached data immediately, then fetches fresh data
 */
export async function swrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const { ttl = 5 * 60 * 1000 } = options;
  
  // Check memory cache first
  const cached = globalCache.get(key) as T | undefined;
  if (cached !== undefined) {
    // Revalidate in background
    fetcher().then((fresh) => {
      globalCache.set(key, fresh, ttl);
    }).catch(console.error);
    
    return cached;
  }
  
  // Check localStorage
  const localCached = localStorageCache.get<T>(key);
  if (localCached !== null) {
    // Revalidate in background
    fetcher().then((fresh) => {
      globalCache.set(key, fresh, ttl);
      localStorageCache.set(key, fresh, ttl);
    }).catch(console.error);
    
    return localCached;
  }
  
  // Fetch fresh data
  const fresh = await fetcher();
  globalCache.set(key, fresh, ttl);
  localStorageCache.set(key, fresh, ttl);
  return fresh;
}

/**
 * Request deduplication
 * Prevents multiple identical requests from being made simultaneously
 */
const pendingRequests = new Map<string, Promise<any>>();

export async function dedupeRequest<T>(
  key: string,
  request: () => Promise<T>
): Promise<T> {
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key) as Promise<T>;
  }
  
  const promise = request().finally(() => {
    pendingRequests.delete(key);
  });
  
  pendingRequests.set(key, promise);
  return promise;
}

/**
 * Memoize function with TTL
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  ttl: number = 5 * 60 * 1000
): T {
  const cache = new Map<string, CacheEntry<ReturnType<T>>>();
  
  return ((...args: any[]) => {
    const key = JSON.stringify(args);
    const cached = cache.get(key);
    
    if (cached && Date.now() - cached.timestamp <= cached.ttl) {
      return cached.value;
    }
    
    const result = fn(...args);
    cache.set(key, {
      value: result,
      timestamp: Date.now(),
      ttl,
    });
    
    return result;
  }) as T;
}

/**
 * Preload data for anticipated routes
 */
export function preloadData<T>(fetcher: () => Promise<T>): void {
  if (typeof window === 'undefined') return;
  
  // Use requestIdleCallback for non-critical preloading
  const schedule = (window as any).requestIdleCallback || setTimeout;
  
  schedule(() => {
    fetcher().catch(() => {
      // Silently fail for preloads
    });
  });
}

export default {
  LRUCache,
  globalCache,
  localStorageCache,
  swrFetch,
  dedupeRequest,
  memoize,
  preloadData,
};
