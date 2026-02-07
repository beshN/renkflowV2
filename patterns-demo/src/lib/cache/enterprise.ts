// ============================================
// ENTERPRISE CACHE SYSTEM
// Tenant-scoped, type-safe cache with invalidation
// ============================================

/**
 * @module cache/enterprise
 * @description Enterprise-grade caching system with:
 * - Tenant-scoped keys (prevents cross-tenant data leakage)
 * - Type-safe cache key builders
 * - Automatic cache invalidation on mutations
 * - TTL support with stale-while-revalidate pattern
 * 
 * @example
 * ```typescript
 * import { enterpriseCache, cacheKeys } from '@/lib/cache/enterprise';
 * 
 * // Get cached data with tenant isolation
 * const orders = await enterpriseCache.get(
 *   cacheKeys.orders.list(tenantId),
 *   () => fetchOrders(tenantId),
 *   { ttl: 60000 }
 * );
 * 
 * // Invalidate after mutation
 * await createOrder(data);
 * enterpriseCache.invalidate(cacheKeys.orders.list(tenantId));
 * ```
 */

// ============================================
// TYPES
// ============================================

/**
 * Cache entry with metadata
 */
interface CacheEntry<T> {
  /** Cached data */
  data: T;
  /** Timestamp when entry was cached */
  cachedAt: number;
  /** Time to live in milliseconds */
  ttl: number;
  /** Tags for group invalidation */
  tags: string[];
  /** Tenant ID for isolation */
  tenantId?: string;
}

/**
 * Cache options
 */
interface CacheOptions {
  /** Time to live in milliseconds (default: 5 minutes) */
  ttl?: number;
  /** Tags for group invalidation */
  tags?: string[];
  /** Force refresh even if cached */
  forceRefresh?: boolean;
  /** Stale-while-revalidate: return stale data while fetching fresh */
  staleWhileRevalidate?: boolean;
}

/**
 * Cache statistics for monitoring
 */
interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  oldestEntry: number | null;
}

// ============================================
// CACHE KEY BUILDERS (Tenant-Scoped)
// ============================================

/**
 * Type-safe cache key builders with tenant isolation.
 * All keys include tenantId to prevent cross-tenant data leakage.
 * 
 * @example
 * ```typescript
 * // List key with tenant
 * cacheKeys.orders.list('tenant-123') // 'orders:tenant-123:list'
 * 
 * // Detail key with tenant and id
 * cacheKeys.orders.detail('tenant-123', 'order-456') // 'orders:tenant-123:detail:order-456'
 * ```
 */
export const cacheKeys = {
  /**
   * Order cache keys
   */
  orders: {
    /** All orders for tenant */
    list: (tenantId: string, filters?: Record<string, unknown>) => 
      `orders:${tenantId}:list${filters ? `:${hashFilters(filters)}` : ''}`,
    /** Single order detail */
    detail: (tenantId: string, orderId: string) => 
      `orders:${tenantId}:detail:${orderId}`,
    /** Order statistics */
    stats: (tenantId: string) => 
      `orders:${tenantId}:stats`,
    /** All order keys for tenant (for bulk invalidation) */
    all: (tenantId: string) => 
      `orders:${tenantId}`,
  },

  /**
   * User cache keys
   */
  users: {
    list: (tenantId: string, filters?: Record<string, unknown>) => 
      `users:${tenantId}:list${filters ? `:${hashFilters(filters)}` : ''}`,
    detail: (tenantId: string, userId: string) => 
      `users:${tenantId}:detail:${userId}`,
    profile: (tenantId: string, userId: string) => 
      `users:${tenantId}:profile:${userId}`,
    permissions: (tenantId: string, userId: string) => 
      `users:${tenantId}:permissions:${userId}`,
    all: (tenantId: string) => 
      `users:${tenantId}`,
  },

  /**
   * Product cache keys
   */
  products: {
    list: (tenantId: string, filters?: Record<string, unknown>) => 
      `products:${tenantId}:list${filters ? `:${hashFilters(filters)}` : ''}`,
    detail: (tenantId: string, productId: string) => 
      `products:${tenantId}:detail:${productId}`,
    inventory: (tenantId: string, productId: string) => 
      `products:${tenantId}:inventory:${productId}`,
    all: (tenantId: string) => 
      `products:${tenantId}`,
  },

  /**
   * Customer cache keys
   */
  customers: {
    list: (tenantId: string, filters?: Record<string, unknown>) => 
      `customers:${tenantId}:list${filters ? `:${hashFilters(filters)}` : ''}`,
    detail: (tenantId: string, customerId: string) => 
      `customers:${tenantId}:detail:${customerId}`,
    orders: (tenantId: string, customerId: string) => 
      `customers:${tenantId}:orders:${customerId}`,
    all: (tenantId: string) => 
      `customers:${tenantId}`,
  },

  /**
   * Analytics cache keys
   */
  analytics: {
    dashboard: (tenantId: string, period?: string) => 
      `analytics:${tenantId}:dashboard${period ? `:${period}` : ''}`,
    reports: (tenantId: string, reportType: string) => 
      `analytics:${tenantId}:reports:${reportType}`,
    all: (tenantId: string) => 
      `analytics:${tenantId}`,
  },

  /**
   * Settings cache keys (tenant-level config)
   */
  settings: {
    tenant: (tenantId: string) => 
      `settings:${tenantId}:config`,
    features: (tenantId: string) => 
      `settings:${tenantId}:features`,
    all: (tenantId: string) => 
      `settings:${tenantId}`,
  },
} as const;

/**
 * Hash filters object to create unique cache key suffix
 */
function hashFilters(filters: Record<string, unknown>): string {
  const sorted = Object.keys(filters)
    .sort()
    .map(k => `${k}=${String(filters[k])}`)
    .join('&');
  
  // Simple hash for shorter keys
  let hash = 0;
  for (let i = 0; i < sorted.length; i++) {
    const char = sorted.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

// ============================================
// ENTERPRISE CACHE CLASS
// ============================================

/**
 * Enterprise-grade cache with tenant isolation and type-safe operations.
 * Implements singleton pattern for global access.
 */
class EnterpriseCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private revalidating: Set<string> = new Set();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    oldestEntry: null,
  };

  private static instance: EnterpriseCache | null = null;

  private constructor() {
    // Start cleanup interval (every 5 minutes)
    if (typeof window !== 'undefined') {
      setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(): EnterpriseCache {
    if (!EnterpriseCache.instance) {
      EnterpriseCache.instance = new EnterpriseCache();
    }
    return EnterpriseCache.instance;
  }

  /**
   * Get all cache keys (for type-safe iteration)
   * Used for invalidation without private field access
   */
  keys(): IterableIterator<string> {
    return this.cache.keys();
  }

  /**
   * Get cached value or fetch and cache it
   * 
   * @param key - Cache key (use cacheKeys builders)
   * @param fetcher - Function to fetch data if not cached
   * @param options - Cache options
   * @returns Cached or freshly fetched data
   */
  async get<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const { ttl = 5 * 60 * 1000, forceRefresh = false, staleWhileRevalidate = true } = options;

    // Check cache
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    const now = Date.now();

    // Return cached if valid and not forcing refresh
    if (entry && !forceRefresh) {
      const isStale = now - entry.cachedAt > entry.ttl;

      if (!isStale) {
        this.stats.hits++;
        return entry.data;
      }

      // Stale-while-revalidate: return stale data and revalidate in background
      if (staleWhileRevalidate && !this.revalidating.has(key)) {
        this.stats.hits++;
        void this.revalidate(key, fetcher, options);
        return entry.data;
      }
    }

    // Cache miss - fetch fresh data
    this.stats.misses++;
    return this.fetchAndCache(key, fetcher, options);
  }

  /**
   * Set cached value directly
   */
  set<T>(key: string, data: T, options: CacheOptions = {}): void {
    const { ttl = 5 * 60 * 1000, tags = [] } = options;

    // Extract tenantId from key if present
    const tenantId = this.extractTenantId(key);

    this.cache.set(key, {
      data,
      cachedAt: Date.now(),
      ttl,
      tags,
      tenantId,
    });

    this.stats.size = this.cache.size;
    this.updateOldestEntry();
  }

  /**
   * Check if key exists and is not stale
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    const isStale = Date.now() - entry.cachedAt > entry.ttl;
    return !isStale;
  }

  /**
   * Invalidate single cache key
   */
  invalidate(key: string): void {
    this.cache.delete(key);
    this.stats.size = this.cache.size;
  }

  /**
   * Invalidate all keys matching prefix (tenant-scoped bulk invalidation)
   * 
   * @example
   * ```typescript
   * // Invalidate all orders for tenant
   * cache.invalidatePrefix(cacheKeys.orders.all('tenant-123'));
   * ```
   */
  invalidatePrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
    this.stats.size = this.cache.size;
  }

  /**
   * Invalidate all keys with specific tag
   */
  invalidateByTag(tag: string): void {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.includes(tag)) {
        this.cache.delete(key);
      }
    }
    this.stats.size = this.cache.size;
  }

  /**
   * Invalidate all cache entries for a specific tenant
   * Use when user switches tenant or for tenant-wide operations
   */
  invalidateTenant(tenantId: string): void {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tenantId === tenantId || key.includes(`:${tenantId}:`)) {
        this.cache.delete(key);
      }
    }
    this.stats.size = this.cache.size;
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      size: 0,
      oldestEntry: null,
    };
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private async fetchAndCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions
  ): Promise<T> {
    const data = await fetcher();
    this.set(key, data, options);
    return data;
  }

  private async revalidate<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions
  ): Promise<void> {
    this.revalidating.add(key);
    try {
      const data = await fetcher();
      this.set(key, data, options);
    } catch (error) {
      console.error(`Cache revalidation failed for key: ${key}`, error);
    } finally {
      this.revalidating.delete(key);
    }
  }

  private extractTenantId(key: string): string | undefined {
    // Keys are in format: resource:tenantId:...
    const parts = key.split(':');
    return parts.length >= 2 ? parts[1] : undefined;
  }

  private updateOldestEntry(): void {
    let oldest: number | null = null;
    for (const entry of this.cache.values()) {
      if (oldest === null || entry.cachedAt < oldest) {
        oldest = entry.cachedAt;
      }
    }
    this.stats.oldestEntry = oldest;
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      // Remove entries that are 2x past their TTL
      if (now - entry.cachedAt > entry.ttl * 2) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.stats.size = this.cache.size;
      this.updateOldestEntry();
    }
  }
}

// ============================================
// EXPORTS
// ============================================

/**
 * Global enterprise cache instance
 */
export const enterpriseCache = EnterpriseCache.getInstance();

/**
 * Helper function for cache-wrapped operations
 * 
 * @example
 * ```typescript
 * const orders = await withCache(
 *   cacheKeys.orders.list(tenantId),
 *   () => fetchOrders(tenantId),
 *   { ttl: 60000 }
 * );
 * ```
 */
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: CacheOptions
): Promise<T> {
  return enterpriseCache.get(key, fetcher, options);
}

/**
 * Invalidate cache key(s)
 * Type-safe wrapper for common invalidation patterns
 */
export function invalidateCache(key: string): void;
export function invalidateCache(keys: string[]): void;
export function invalidateCache(keyOrKeys: string | string[]): void {
  if (Array.isArray(keyOrKeys)) {
    keyOrKeys.forEach(key => enterpriseCache.invalidate(key));
  } else {
    enterpriseCache.invalidate(keyOrKeys);
  }
}

/**
 * Invalidate all cache entries matching prefix
 */
export function invalidateCachePrefix(prefix: string): void {
  enterpriseCache.invalidatePrefix(prefix);
}

/**
 * Invalidate all cache for a tenant (on tenant switch or logout)
 */
export function invalidateTenantCache(tenantId: string): void {
  enterpriseCache.invalidateTenant(tenantId);
}
