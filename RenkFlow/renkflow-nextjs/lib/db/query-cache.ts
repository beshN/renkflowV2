/**
 * Database Query Cache
 * 
 * Provides caching layer for expensive database queries
 * Uses Redis when available, falls back to in-memory LRU cache
 */

import { getRedisClient, isRedisAvailable } from '@/lib/redis/client';

// ============================================
// Entity Relationship Configuration
// ============================================
// Defines which entities are related to each other for cache invalidation.
// When entity X changes, all related entities' caches are also invalidated.

export const ENTITY_RELATIONSHIPS: Record<string, string[]> = {
  orders: ['customers', 'stats', 'dashboard', 'reports'],
  customers: ['orders', 'stats'],
  products: ['orders', 'inventory', 'stats'],
  inventory: ['products', 'stats'],
  users: ['audit', 'sessions'],
  tenants: ['users', 'orders', 'customers', 'stats'],
};

/**
 * Get related entities for a given entity
 */
export function getRelatedEntities(entity: string): string[] {
  return ENTITY_RELATIONSHIPS[entity] || [];
}

/**
 * Register custom entity relationship (for plugins/extensions)
 */
export function registerEntityRelationship(entity: string, relatedEntities: string[]): void {
  const existing = ENTITY_RELATIONSHIPS[entity] || [];
  ENTITY_RELATIONSHIPS[entity] = [...new Set([...existing, ...relatedEntities])];
}

// ============================================
// Types
// ============================================

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

// ============================================
// In-Memory LRU Cache (Fallback)
// ============================================

class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    return entry.data;
  }

  set(key: string, data: T, ttlMs: number): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttlMs,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  deleteByPrefix(prefix: string): number {
    let deleted = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        deleted++;
      }
    }
    return deleted;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// ============================================
// Query Cache Manager
// ============================================

const DEFAULT_TTL = 60 * 1000; // 1 minute
const CACHE_PREFIX = 'query:';
const TAG_PREFIX = 'tag:';

const memoryCache = new LRUCache<unknown>(500);

export class QueryCache {
  private useRedis: boolean = true;

  /**
   * Get cached query result
   */
  async get<T>(key: string): Promise<T | null> {
    const cacheKey = `${CACHE_PREFIX}${key}`;

    if (this.useRedis && await isRedisAvailable()) {
      try {
        const redis = getRedisClient(); if (!redis) throw new Error("Redis not available");
        const data = await redis.get(cacheKey);
        return data ? JSON.parse(data) : null;
      } catch (error) {
        console.warn('[QueryCache] Redis get failed, using memory:', error);
        this.useRedis = false;
      }
    }

    return memoryCache.get(cacheKey) as T | null;
  }

  /**
   * Cache query result
   */
  async set<T>(key: string, data: T, options: CacheOptions = {}): Promise<void> {
    const cacheKey = `${CACHE_PREFIX}${key}`;
    const ttl = options.ttl ?? DEFAULT_TTL;

    if (this.useRedis && await isRedisAvailable()) {
      try {
        const redis = getRedisClient(); if (!redis) throw new Error("Redis not available");
        if (!redis) throw new Error('Redis client not available');
        await redis.set(cacheKey, JSON.stringify(data), 'PX', ttl);

        // Store tags for invalidation
        if (options.tags?.length) {
          for (const tag of options.tags) {
            await redis.sadd(`${TAG_PREFIX}${tag}`, cacheKey);
            await redis.expire(`${TAG_PREFIX}${tag}`, Math.ceil(ttl / 1000) + 60);
          }
        }
        return;
      } catch (error) {
        console.warn('[QueryCache] Redis set failed, using memory:', error);
        this.useRedis = false;
      }
    }

    memoryCache.set(cacheKey, data, ttl);
  }

  /**
   * Invalidate specific cache key
   */
  async invalidate(key: string): Promise<void> {
    const cacheKey = `${CACHE_PREFIX}${key}`;

    if (this.useRedis && await isRedisAvailable()) {
      try {
        const redis = getRedisClient(); if (!redis) throw new Error("Redis not available");
        await redis.del(cacheKey);
        return;
      } catch (error) {
        console.warn('[QueryCache] Redis invalidate failed:', error);
      }
    }

    memoryCache.delete(cacheKey);
  }

  /**
   * Invalidate all caches with a specific tag
   */
  async invalidateByTag(tag: string): Promise<number> {
    if (this.useRedis && await isRedisAvailable()) {
      try {
        const redis = getRedisClient(); if (!redis) throw new Error("Redis not available");
        const tagKey = `${TAG_PREFIX}${tag}`;
        const keys = await redis.smembers(tagKey);
        
        if (keys.length > 0) {
          await redis.del(...keys);
          await redis.del(tagKey);
        }
        
        return keys.length;
      } catch (error) {
        console.warn('[QueryCache] Redis invalidateByTag failed:', error);
      }
    }

    return memoryCache.deleteByPrefix(`${CACHE_PREFIX}${tag}`);
  }

  /**
   * Invalidate all caches for a tenant
   */
  async invalidateTenant(tenantId: string): Promise<number> {
    return this.invalidateByTag(`tenant:${tenantId}`);
  }

  /**
   * Invalidate on data mutation
   * Call this after CREATE, UPDATE, DELETE operations
   * 
   * Uses ENTITY_RELATIONSHIPS config to automatically determine related entities.
   * Additional relatedEntities can be passed for edge cases.
   */
  async invalidateOnMutation(options: {
    entity: string;
    entityId?: string;
    tenantId?: string;
    relatedEntities?: string[];
  }): Promise<void> {
    const { entity, entityId, tenantId, relatedEntities = [] } = options;

    // Invalidate entity-specific cache
    if (entityId) {
      await this.invalidate(`${entity}:${entityId}`);
    }

    // Invalidate entity list caches
    await this.invalidateByTag(entity);

    // Invalidate tenant-specific caches
    if (tenantId) {
      await this.invalidateByTag(`tenant:${tenantId}:${entity}`);
    }

    // Get related entities from config + any additional ones passed
    const configRelated = getRelatedEntities(entity);
    const allRelated = [...new Set([...configRelated, ...relatedEntities])];

    // Invalidate all related entity caches
    for (const related of allRelated) {
      await this.invalidateByTag(related);
      if (tenantId) {
        await this.invalidateByTag(`tenant:${tenantId}:${related}`);
      }
    }

    // Also invalidate memory cache for consistency
    memoryCache.deleteByPrefix(`${CACHE_PREFIX}${entity}`);
  }

  /**
   * Batch invalidation for multiple keys
   */
  async invalidateMany(keys: string[]): Promise<void> {
    if (this.useRedis && await isRedisAvailable()) {
      try {
        const redis = getRedisClient(); if (!redis) throw new Error("Redis not available");
        const cacheKeys = keys.map(k => `${CACHE_PREFIX}${k}`);
        if (cacheKeys.length > 0) {
          await redis.del(...cacheKeys);
        }
        return;
      } catch (error) {
        console.warn('[QueryCache] Redis invalidateMany failed:', error);
      }
    }

    // Fallback to memory
    for (const key of keys) {
      memoryCache.delete(`${CACHE_PREFIX}${key}`);
    }
  }

  /**
   * Invalidate with pattern matching
   */
  async invalidatePattern(pattern: string): Promise<number> {
    if (this.useRedis && await isRedisAvailable()) {
      try {
        const redis = getRedisClient(); if (!redis) throw new Error("Redis not available");
        const keys = await redis.keys(`${CACHE_PREFIX}${pattern}`);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
        return keys.length;
      } catch (error) {
        console.warn('[QueryCache] Redis invalidatePattern failed:', error);
      }
    }

    return memoryCache.deleteByPrefix(`${CACHE_PREFIX}${pattern.replace('*', '')}`);
  }

  /**
   * Get or compute cached value
   */
  async getOrSet<T>(
    key: string,
    compute: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = await this.get<T>(key);
    
    if (cached !== null) {
      return cached;
    }

    const data = await compute();
    await this.set(key, data, options);
    
    return data;
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    if (this.useRedis && await isRedisAvailable()) {
      try {
        const redis = getRedisClient(); if (!redis) throw new Error("Redis not available");
        const keys = await redis.keys(`${CACHE_PREFIX}*`);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
        return;
      } catch (error) {
        console.warn('[QueryCache] Redis clear failed:', error);
      }
    }

    memoryCache.clear();
  }
}

// ============================================
// Singleton Export
// ============================================

export const queryCache = new QueryCache();

// ============================================
// Decorator for cached queries
// ============================================

export function cached(options: CacheOptions = {}) {
  return function <T extends (...args: unknown[]) => Promise<unknown>>(
    _target: unknown,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const originalMethod = descriptor.value!;

    descriptor.value = async function (this: unknown, ...args: unknown[]) {
      const cacheKey = `${propertyKey}:${JSON.stringify(args)}`;
      
      return queryCache.getOrSet(
        cacheKey,
        () => originalMethod.apply(this, args),
        options
      );
    } as T;

    return descriptor;
  };
}
