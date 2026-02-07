/**
 * Smart Request Layer
 * 
 * Provides intelligent request handling with:
 * - Request deduplication (same request = single fetch)
 * - Response caching with TTL
 * - Optimistic updates support
 * - Automatic retry with exponential backoff
 */

type CacheEntry<T> = {
  data: T;
  timestamp: number;
  ttl: number;
};

type PendingRequest<T> = Promise<T>;

class RequestCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private pending: Map<string, PendingRequest<unknown>> = new Map();

  /**
   * Get cached data if still valid
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > entry.ttl;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set cache with TTL (default 5 minutes)
   */
  set<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Invalidate specific cache key
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all cache entries matching a pattern
   */
  invalidatePattern(pattern: string | RegExp): void {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get pending request for deduplication
   */
  getPending<T>(key: string): PendingRequest<T> | null {
    return (this.pending.get(key) as PendingRequest<T>) || null;
  }

  /**
   * Set pending request
   */
  setPending<T>(key: string, promise: PendingRequest<T>): void {
    this.pending.set(key, promise);
  }

  /**
   * Clear pending request
   */
  clearPending(key: string): void {
    this.pending.delete(key);
  }
}

// Singleton cache instance
export const requestCache = new RequestCache();

// ============================================
// Request Options
// ============================================

interface RequestOptions<T> {
  /** Cache key - if not provided, URL is used */
  cacheKey?: string;
  /** Time-to-live for cache in milliseconds (default: 5 min) */
  ttl?: number;
  /** Whether to deduplicate concurrent requests (default: true) */
  deduplicate?: boolean;
  /** Whether to use cache (default: true) */
  useCache?: boolean;
  /** Number of retries on failure (default: 3) */
  retries?: number;
  /** Transform response before caching */
  transform?: (data: unknown) => T;
}

// ============================================
// Smart Request Function
// ============================================

/**
 * Make a smart request with caching and deduplication
 */
export async function smartRequest<T>(
  url: string,
  options: RequestInit & RequestOptions<T> = {}
): Promise<T> {
  const {
    cacheKey = url,
    ttl = 5 * 60 * 1000,
    deduplicate = true,
    useCache = true,
    retries = 3,
    transform,
    ...fetchOptions
  } = options;

  // 1. Check for pending request (deduplication)
  if (deduplicate) {
    const pending = requestCache.getPending<T>(cacheKey);
    if (pending) {
      return pending;
    }
  }

  // 2. Check cache
  if (useCache && fetchOptions.method === undefined || fetchOptions.method === 'GET') {
    const cached = requestCache.get<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }
  }

  // 3. Make request with retry logic
  const fetchWithRetry = async (attempt: number): Promise<T> => {
    try {
      const response = await fetch(url, fetchOptions);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const result = transform ? transform(data) : data;

      // Cache successful GET requests
      if (useCache && (fetchOptions.method === undefined || fetchOptions.method === 'GET')) {
        requestCache.set(cacheKey, result, ttl);
      }

      return result;
    } catch (error) {
      if (attempt < retries) {
        // Exponential backoff: 100ms, 200ms, 400ms...
        const delay = Math.pow(2, attempt) * 100;
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithRetry(attempt + 1);
      }
      throw error;
    }
  };

  // Create and track the request promise
  const requestPromise = fetchWithRetry(0).finally(() => {
    requestCache.clearPending(cacheKey);
  });

  if (deduplicate) {
    requestCache.setPending(cacheKey, requestPromise);
  }

  return requestPromise;
}

// ============================================
// Optimistic Update Support
// ============================================

interface OptimisticUpdateOptions<T> {
  /** Cache key to update */
  cacheKey: string;
  /** Optimistic data to show immediately */
  optimisticData: T;
  /** The actual mutation function */
  mutationFn: () => Promise<T>;
  /** Callback on success */
  onSuccess?: (data: T) => void;
  /** Callback on error with rollback data */
  onError?: (error: Error, previousData: T | null) => void;
}

/**
 * Perform an optimistic update with automatic rollback on failure
 */
export async function optimisticUpdate<T>({
  cacheKey,
  optimisticData,
  mutationFn,
  onSuccess,
  onError,
}: OptimisticUpdateOptions<T>): Promise<T> {
  // Save previous data for rollback
  const previousData = requestCache.get<T>(cacheKey);

  // Immediately update cache with optimistic data
  requestCache.set(cacheKey, optimisticData);

  try {
    // Perform the actual mutation
    const result = await mutationFn();
    
    // Update cache with real data
    requestCache.set(cacheKey, result);
    
    onSuccess?.(result);
    return result;
  } catch (error) {
    // Rollback to previous data
    if (previousData !== null) {
      requestCache.set(cacheKey, previousData);
    } else {
      requestCache.invalidate(cacheKey);
    }
    
    onError?.(error as Error, previousData);
    throw error;
  }
}

// ============================================
// React Hooks
// ============================================

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseQueryResult<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * React hook for data fetching with smart request layer
 */
export function useQuery<T>(
  url: string | null,
  options: RequestOptions<T> = {}
): UseQueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);
  
  // Store options in ref to avoid dependency issues
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const fetchData = useCallback(async () => {
    if (!url) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await smartRequest<T>(url, optionsRef.current);
      if (mountedRef.current) {
        setData(result);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err as Error);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [url]);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();

    return () => {
      mountedRef.current = false;
    };
  }, [fetchData]);

  const refetch = useCallback(async () => {
    if (url) {
      requestCache.invalidate(options.cacheKey || url);
      await fetchData();
    }
  }, [url, options.cacheKey, fetchData]);

  return { data, isLoading, error, refetch };
}

interface UseMutationResult<T, V> {
  mutate: (variables: V) => Promise<T>;
  isLoading: boolean;
  error: Error | null;
  reset: () => void;
}

/**
 * React hook for mutations with optimistic updates
 */
export function useMutation<T, V = void>(
  mutationFn: (variables: V) => Promise<T>
): UseMutationResult<T, V> {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (variables: V): Promise<T> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await mutationFn(variables);
      return result;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [mutationFn]);

  const reset = useCallback(() => {
    setError(null);
    setIsLoading(false);
  }, []);

  return { mutate, isLoading, error, reset };
}

// Named export for ESM compatibility
export const RequestLayer = {
  smartRequest,
  optimisticUpdate,
  requestCache,
  useQuery,
  useMutation,
};

export default RequestLayer;
