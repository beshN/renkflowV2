// ============================================
// REQUEST LAYER CACHE
// Client-side request caching with state management
// ============================================

/**
 * @module cache/request-layer
 * @description Client-side request caching with:
 * - Key change state reset (prevents stale UI bugs)
 * - Tenant-scoped cache isolation
 * - SWR-like revalidation pattern
 * - Automatic cleanup on unmount
 * 
 * @example
 * ```typescript
 * const { data, isLoading, error, revalidate } = useCachedQuery(
 *   `orders:${tenantId}`,
 *   () => fetchOrders(tenantId),
 *   { ttl: 30000 }
 * );
 * ```
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================
// TYPES
// ============================================

/**
 * Cache entry for request layer
 */
interface RequestCacheEntry<T> {
  data: T;
  timestamp: number;
  error: Error | null;
}

/**
 * Query state
 */
interface QueryState<T> {
  /** Cached/fetched data */
  data: T | null;
  /** Error if request failed */
  error: Error | null;
  /** Initial loading state */
  isLoading: boolean;
  /** Background revalidation state */
  isValidating: boolean;
  /** Whether data is from cache */
  isFromCache: boolean;
}

/**
 * Cache query options
 */
interface CachedQueryOptions {
  /** Time to live in milliseconds (default: 30000) */
  ttl?: number;
  /** Enable/disable the query */
  enabled?: boolean;
  /** Revalidate on mount */
  revalidateOnMount?: boolean;
  /** Revalidate on window focus */
  revalidateOnFocus?: boolean;
  /** Polling interval in ms (0 = disabled) */
  refetchInterval?: number;
  /** Keep previous data when key changes */
  keepPreviousData?: boolean;
  /** On success callback */
  onSuccess?: <T>(data: T) => void;
  /** On error callback */
  onError?: (error: Error) => void;
}

// ============================================
// REQUEST CACHE STORE
// ============================================

/**
 * In-memory request cache with tenant isolation
 */
class RequestCache {
  private cache = new Map<string, RequestCacheEntry<unknown>>();
  private subscribers = new Map<string, Set<() => void>>();
  private static instance: RequestCache | null = null;

  static getInstance(): RequestCache {
    if (!RequestCache.instance) {
      RequestCache.instance = new RequestCache();
    }
    return RequestCache.instance;
  }

  /**
   * Get cached entry
   */
  get<T>(key: string): RequestCacheEntry<T> | null {
    return (this.cache.get(key) as RequestCacheEntry<T>) ?? null;
  }

  /**
   * Set cache entry and notify subscribers
   */
  set<T>(key: string, data: T, error: Error | null = null): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      error,
    });
    this.notify(key);
  }

  /**
   * Check if cache entry is stale
   */
  isStale(key: string, ttl: number): boolean {
    const entry = this.cache.get(key);
    if (!entry) return true;
    return Date.now() - entry.timestamp > ttl;
  }

  /**
   * Invalidate cache key and notify subscribers
   */
  invalidate(key: string): void {
    this.cache.delete(key);
    this.notify(key);
  }

  /**
   * Invalidate all keys matching prefix
   */
  invalidatePrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        this.notify(key);
      }
    }
  }

  /**
   * Subscribe to cache changes
   */
  subscribe(key: string, callback: () => void): () => void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(callback);

    return () => {
      this.subscribers.get(key)?.delete(callback);
    };
  }

  /**
   * Notify subscribers of cache change
   */
  private notify(key: string): void {
    this.subscribers.get(key)?.forEach(cb => cb());
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get all keys (for debugging/testing)
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }
}

export const requestCache = RequestCache.getInstance();

// ============================================
// USE CACHED QUERY HOOK
// ============================================

/**
 * React hook for cached data fetching with key change state reset.
 * 
 * Key features:
 * - **Key change reset**: When key changes, state is reset to prevent stale UI
 * - **Tenant isolation**: Use tenant-scoped keys to prevent cross-tenant leaks
 * - **SWR pattern**: Returns cached data while revalidating in background
 * 
 * @example
 * ```typescript
 * function OrderList({ tenantId }: { tenantId: string }) {
 *   // Key changes when tenantId changes - state automatically resets
 *   const { data, isLoading } = useCachedQuery(
 *     tenantId ? `orders:${tenantId}` : null, // null disables query
 *     () => fetchOrders(tenantId),
 *     { ttl: 30000 }
 *   );
 * 
 *   if (isLoading) return <Skeleton />;
 *   return <OrderTable orders={data} />;
 * }
 * ```
 */
export function useCachedQuery<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options: CachedQueryOptions = {}
): QueryState<T> & {
  revalidate: () => Promise<void>;
  mutate: (data: T | ((prev: T | null) => T)) => void;
} {
  const {
    ttl = 30000,
    enabled = true,
    revalidateOnMount = true,
    revalidateOnFocus = true,
    refetchInterval = 0,
    keepPreviousData = false,
    onSuccess,
    onError,
  } = options;

  // Track previous key for reset detection
  const prevKeyRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  // Initial state - reset when key changes
  const getInitialState = useCallback((): QueryState<T> => {
    if (!key) {
      return {
        data: null,
        error: null,
        isLoading: false,
        isValidating: false,
        isFromCache: false,
      };
    }

    const cached = requestCache.get<T>(key);
    const isStale = requestCache.isStale(key, ttl);

    return {
      data: cached?.data ?? null,
      error: cached?.error ?? null,
      isLoading: !cached?.data,
      isValidating: isStale,
      isFromCache: !!cached?.data && !isStale,
    };
  }, [key, ttl]);

  const [state, setState] = useState<QueryState<T>>(getInitialState);

  // Reset state when key changes (CRITICAL: prevents stale UI bug)
  useEffect(() => {
    if (prevKeyRef.current !== key) {
      prevKeyRef.current = key;

      // Reset state for new key
      if (!keepPreviousData) {
        setState(getInitialState());
      } else {
        // Keep previous data but mark as loading
        setState(prev => ({
          ...prev,
          isLoading: !requestCache.get(key ?? '')?.data,
          isValidating: true,
          isFromCache: false,
        }));
      }
    }
  }, [key, getInitialState, keepPreviousData]);

  // Fetch function
  const fetchData = useCallback(async (isBackground = false): Promise<void> => {
    if (!key || !enabled) return;

    if (!isBackground) {
      setState(prev => ({ ...prev, isLoading: !prev.data, isValidating: true }));
    } else {
      setState(prev => ({ ...prev, isValidating: true }));
    }

    try {
      const data = await fetcher();
      
      if (!mountedRef.current) return;

      requestCache.set(key, data);
      
      setState({
        data,
        error: null,
        isLoading: false,
        isValidating: false,
        isFromCache: false,
      });

      onSuccess?.(data);
    } catch (error) {
      if (!mountedRef.current) return;

      const err = error instanceof Error ? error : new Error(String(error));
      
      setState(prev => ({
        ...prev,
        error: err,
        isLoading: false,
        isValidating: false,
      }));

      onError?.(err);
    }
  }, [key, enabled, fetcher, onSuccess, onError]);

  // Revalidate function (exposed to consumer)
  const revalidate = useCallback(async (): Promise<void> => {
    await fetchData(false);
  }, [fetchData]);

  // Mutate function (optimistic updates)
  const mutate = useCallback((data: T | ((prev: T | null) => T)): void => {
    if (!key) return;

    const newData = typeof data === 'function' 
      ? (data as (prev: T | null) => T)(state.data)
      : data;

    requestCache.set(key, newData);
    setState(prev => ({
      ...prev,
      data: newData,
      isFromCache: false,
    }));
  }, [key, state.data]);

  // Initial fetch and cache subscription
  useEffect(() => {
    mountedRef.current = true;

    if (!key || !enabled) return;

    // Subscribe to cache changes (for cross-component sync)
    const unsubscribe = requestCache.subscribe(key, () => {
      const cached = requestCache.get<T>(key);
      if (cached) {
        setState(prev => ({
          ...prev,
          data: cached.data,
          error: cached.error,
          isFromCache: true,
        }));
      }
    });

    // Fetch on mount if needed
    const cached = requestCache.get<T>(key);
    const isStale = requestCache.isStale(key, ttl);

    if (revalidateOnMount && (!cached || isStale)) {
      void fetchData(!!cached);
    }

    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, [key, enabled, ttl, revalidateOnMount, fetchData]);

  // Revalidate on window focus
  useEffect(() => {
    if (!revalidateOnFocus || !key || !enabled) return;

    const handleFocus = () => {
      if (requestCache.isStale(key, ttl)) {
        void fetchData(true);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [key, enabled, ttl, revalidateOnFocus, fetchData]);

  // Polling
  useEffect(() => {
    if (!refetchInterval || refetchInterval <= 0 || !key || !enabled) return;

    const interval = setInterval(() => {
      void fetchData(true);
    }, refetchInterval);

    return () => clearInterval(interval);
  }, [key, enabled, refetchInterval, fetchData]);

  return {
    ...state,
    revalidate,
    mutate,
  };
}

// ============================================
// USE CACHED MUTATION HOOK
// ============================================

/**
 * Mutation hook with automatic cache invalidation
 */
export function useCachedMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: {
    /** Cache keys to invalidate on success */
    invalidateKeys?: string[];
    /** Cache key prefixes to invalidate on success */
    invalidatePrefixes?: string[];
    /** Optimistic update function */
    optimisticUpdate?: (variables: TVariables) => void;
    /** On success callback */
    onSuccess?: (data: TData, variables: TVariables) => void;
    /** On error callback */
    onError?: (error: Error, variables: TVariables) => void;
  } = {}
): {
  mutate: (variables: TVariables) => Promise<TData>;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  isLoading: boolean;
  error: Error | null;
  reset: () => void;
} {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (variables: TVariables): Promise<TData> => {
    setIsLoading(true);
    setError(null);

    // Apply optimistic update if provided
    options.optimisticUpdate?.(variables);

    try {
      const data = await mutationFn(variables);

      // Invalidate specified cache keys
      options.invalidateKeys?.forEach(key => {
        requestCache.invalidate(key);
      });

      // Invalidate by prefix
      options.invalidatePrefixes?.forEach(prefix => {
        requestCache.invalidatePrefix(prefix);
      });

      options.onSuccess?.(data, variables);
      setIsLoading(false);
      return data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setIsLoading(false);
      options.onError?.(error, variables);
      throw error;
    }
  }, [mutationFn, options]);

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
  }, []);

  return {
    mutate,
    mutateAsync: mutate,
    isLoading,
    error,
    reset,
  };
}

// ============================================
// TENANT CONTEXT HOOK
// ============================================

/**
 * Hook to get current tenant ID for cache key scoping
 * This should be implemented based on your auth/tenant context
 */
export function useTenantId(): string | null {
  // TODO: Implement based on your auth context
  // Example:
  // const { tenant } = useAuth();
  // return tenant?.id ?? null;
  
  // Placeholder - replace with actual implementation
  if (typeof window !== 'undefined') {
    return localStorage.getItem('tenantId');
  }
  return null;
}

/**
 * Create tenant-scoped cache key
 */
export function createTenantKey(tenantId: string | null, baseKey: string): string | null {
  if (!tenantId) return null;
  return `${baseKey}:${tenantId}`;
}
