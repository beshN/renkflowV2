/**
 * Enterprise Cache Layer
 * 
 * Features:
 * - In-memory LRU cache for frequently accessed data
 * - Automatic TTL (Time To Live) management
 * - Cache invalidation strategies
 * - Type-safe cache operations
 * - Production-ready with size limits
 */

import 'server-only';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  size: number;
}

interface CacheOptions {
  maxSize?: number;      // Maximum number of entries
  defaultTTL?: number;   // Default TTL in milliseconds
  maxEntrySize?: number; // Maximum size of a single entry in bytes
}

class EnterpriseCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxSize: number;
  private defaultTTL: number;
  private maxEntrySize: number;
  private currentSize = 0;
  private hits = 0;
  private misses = 0;

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize || 1000;
    this.defaultTTL = options.defaultTTL || 5 * 60 * 1000; // 5 minutes
    this.maxEntrySize = options.maxEntrySize || 1024 * 1024; // 1MB
  }

  /**
   * Get a value from cache
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      this.misses++;
      return undefined;
    }

    this.hits++;
    return entry.value as T;
  }

  /**
   * Set a value in cache
   */
  set<T>(key: string, value: T, ttl?: number): boolean {
    // Calculate entry size (approximate)
    const size = this.calculateSize(value);
    
    if (size > this.maxEntrySize) {
      console.warn(`[Cache] Entry too large: ${key} (${size} bytes)`);
      return false;
    }

    // Evict entries if necessary
    while (this.currentSize + size > this.maxSize * 1000 && this.cache.size > 0) {
      this.evictLRU();
    }

    // Delete old entry if exists
    const oldEntry = this.cache.get(key);
    if (oldEntry) {
      this.currentSize -= oldEntry.size;
    }

    const expiresAt = Date.now() + (ttl || this.defaultTTL);
    
    this.cache.set(key, {
      value,
      expiresAt,
      size
    });
    
    this.currentSize += size;
    return true;
  }

  /**
   * Delete a key from cache
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.currentSize -= entry.size;
      return this.cache.delete(key);
    }
    return false;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      currentSize: this.currentSize,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits + this.misses > 0 ? this.hits / (this.hits + this.misses) : 0
    };
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      this.delete(firstKey);
    }
  }

  /**
   * Calculate approximate size of value in bytes
   */
  private calculateSize(value: unknown): number {
    try {
      return JSON.stringify(value).length * 2; // UTF-16 encoding
    } catch {
      return 100; // Default size if can't calculate
    }
  }
}

// Global cache instance
export const globalCache = new EnterpriseCache({
  maxSize: 2000,
  defaultTTL: 5 * 60 * 1000, // 5 minutes
});

// Cache keys helper for consistent naming
export const cacheKeys = {
  orders: {
    list: (tenantId: string) => `orders:list:${tenantId}`,
    detail: (tenantId: string, id: string) => `orders:detail:${tenantId}:${id}`,
    stats: (tenantId: string) => `orders:stats:${tenantId}`,
  },
  inventory: {
    list: (tenantId: string) => `inventory:list:${tenantId}`,
    summary: (tenantId: string) => `inventory:summary:${tenantId}`,
    alerts: (tenantId: string) => `inventory:alerts:${tenantId}`,
  },
  finance: {
    overview: (tenantId: string) => `finance:overview:${tenantId}`,
    payments: (tenantId: string) => `finance:payments:${tenantId}`,
    documents: (tenantId: string) => `finance:documents:${tenantId}`,
  }
};

// Helper function for cached operations
export async function withCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // Try to get from cache
  const cached = globalCache.get<T>(key);
  if (cached !== undefined) {
    return cached;
  }

  // Execute function
  const result = await fn();
  
  // Store in cache
  globalCache.set(key, result, ttl);
  
  return result;
}

// Invalidate cache by pattern
export function invalidateCache(pattern: string): void {
  const keysToDelete: string[] = [];
  
  for (const key of globalCache['cache'].keys()) {
    if (key.includes(pattern)) {
      keysToDelete.push(key);
    }
  }
  
  keysToDelete.forEach(key => globalCache.delete(key));
}
