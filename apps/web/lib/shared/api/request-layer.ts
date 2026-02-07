'use client';

import React from 'react';

/**
 * Smart Request Layer
 * - Request deduplication
 * - Optimistic updates with rollback
 * - Response caching (configurable TTL)
 * - Automatic retry with exponential backoff
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

interface RequestConfig {
  cacheTTL?: number; // milliseconds, default 5 minutes
  deduplicate?: boolean;
  retry?: number;
  retryDelay?: number;
}

const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const DEFAULT_RETRY_COUNT = 3;
const DEFAULT_RETRY_DELAY = 1000;

class RequestCache {
  private static instance: RequestCache;
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private pendingRequests: Map<string, PendingRequest<unknown>> = new Map();
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();

  private constructor() {
    // Cleanup expired entries every minute
    if (typeof window !== 'undefined') {
      setInterval(() => this.cleanupExpired(), 60 * 1000);
    }
  }

  static getInstance(): RequestCache {
    if (!RequestCache.instance) {
      RequestCache.instance = new RequestCache();
    }
    return RequestCache.instance;
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T, ttl: number = DEFAULT_CACHE_TTL): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl,
    });
    this.notifyListeners(key, data);
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidatePattern(pattern: RegExp): void {
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  getPending<T>(key: string): Promise<T> | null {
    const pending = this.pendingRequests.get(key);
    if (pending) {
      return pending.promise as Promise<T>;
    }
    return null;
  }

  setPending<T>(key: string, promise: Promise<T>): void {
    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now(),
    });

    promise.finally(() => {
      this.pendingRequests.delete(key);
    });
  }

  subscribe(key: string, callback: (data: unknown) => void): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(callback);

    return () => {
      this.listeners.get(key)?.delete(callback);
    };
  }

  private notifyListeners(key: string, data: unknown): void {
    this.listeners.get(key)?.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[RequestCache] Listener error:', error);
        }
      }
    });
  }
}

export const requestCache = RequestCache.getInstance();

/**
 * Create a cached request function
 */
export async function cachedRequest<T>(
  key: string,
  fetcher: () => Promise<T>,
  config: RequestConfig = {}
): Promise<T> {
  const {
    cacheTTL = DEFAULT_CACHE_TTL,
    deduplicate = true,
    retry = DEFAULT_RETRY_COUNT,
    retryDelay = DEFAULT_RETRY_DELAY,
  } = config;

  // Check cache first
  const cached = requestCache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Check for pending request (deduplication)
  if (deduplicate) {
    const pending = requestCache.getPending<T>(key);
    if (pending) {
      return pending;
    }
  }

  // Create new request with retry logic
  const executeWithRetry = async (attempt: number): Promise<T> => {
    try {
      return await fetcher();
    } catch (error) {
      if (attempt < retry) {
        const delay = retryDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return executeWithRetry(attempt + 1);
      }
      throw error;
    }
  };

  const promise = executeWithRetry(0).then((data) => {
    requestCache.set(key, data, cacheTTL);
    return data;
  });

  if (deduplicate) {
    requestCache.setPending(key, promise);
  }

  return promise;
}

/**
 * Optimistic update helper
 */
export interface OptimisticUpdateConfig<T, R> {
  cacheKey: string;
  optimisticData: T;
  mutationFn: () => Promise<R>;
  onSuccess?: (result: R) => void;
  onError?: (error: Error, rollbackData: T | null) => void;
  revalidate?: boolean;
}

export async function optimisticUpdate<T, R>(
  config: OptimisticUpdateConfig<T, R>
): Promise<R> {
  const { cacheKey, optimisticData, mutationFn, onSuccess, onError, revalidate = true } = config;

  // Store previous data for rollback
  const previousData = requestCache.get<T>(cacheKey);

  // Optimistically update cache
  requestCache.set(cacheKey, optimisticData);

  try {
    const result = await mutationFn();
    
    if (revalidate) {
      // Invalidate to force fresh fetch
      requestCache.invalidate(cacheKey);
    }
    
    onSuccess?.(result);
    return result;
  } catch (error) {
    // Rollback on error
    if (previousData !== null) {
      requestCache.set(cacheKey, previousData);
    } else {
      requestCache.invalidate(cacheKey);
    }
    
    onError?.(error as Error, previousData);
    throw error;
  }
}

/**
 * React hook for cached data fetching (SWR-like pattern)
 */
export interface UseCachedQueryOptions<T> {
  enabled?: boolean;
  cacheTTL?: number;
  refetchOnMount?: boolean;
  refetchOnWindowFocus?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

export interface UseCachedQueryResult<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  isValidating: boolean;
  refetch: () => Promise<void>;
  mutate: (data: T) => void;
}

export function useCachedQuery<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options: UseCachedQueryOptions<T> = {}
): UseCachedQueryResult<T> {
  const {
    enabled = true,
    cacheTTL = DEFAULT_CACHE_TTL,
    refetchOnMount = true,
    refetchOnWindowFocus = false,
    onSuccess,
    onError,
  } = options;

  const [data, setData] = React.useState<T | null>(() => {
    if (key) {
      return requestCache.get<T>(key);
    }
    return null;
  });
  const [error, setError] = React.useState<Error | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isValidating, setIsValidating] = React.useState(false);

  const fetchData = React.useCallback(async () => {
    if (!key || !enabled) return;

    const cached = requestCache.get<T>(key);
    if (cached !== null) {
      setData(cached);
      setIsValidating(true);
    } else {
      setIsLoading(true);
    }

    try {
      const result = await cachedRequest(key, fetcher, { cacheTTL });
      setData(result);
      setError(null);
      onSuccess?.(result);
    } catch (err) {
      const error = err as Error;
      setError(error);
      onError?.(error);
    } finally {
      setIsLoading(false);
      setIsValidating(false);
    }
  }, [key, enabled, fetcher, cacheTTL, onSuccess, onError]);

  const refetch = React.useCallback(async () => {
    if (key) {
      requestCache.invalidate(key);
    }
    await fetchData();
  }, [key, fetchData]);

  const mutate = React.useCallback((newData: T) => {
    if (key) {
      requestCache.set(key, newData, cacheTTL);
    }
    setData(newData);
  }, [key, cacheTTL]);

  // Initial fetch
  React.useEffect(() => {
    if (refetchOnMount) {
      fetchData();
    }
  }, [fetchData, refetchOnMount]);

  // Subscribe to cache updates
  React.useEffect(() => {
    if (!key) return;

    const unsubscribe = requestCache.subscribe(key, (newData) => {
      setData(newData as T);
    });

    return unsubscribe;
  }, [key]);

  // Refetch on window focus
  React.useEffect(() => {
    if (!refetchOnWindowFocus || typeof window === 'undefined') return;

    const handleFocus = () => {
      fetchData();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetchOnWindowFocus, fetchData]);

  return {
    data,
    error,
    isLoading,
    isValidating,
    refetch,
    mutate,
  };
}

/**
 * React hook for mutations with optimistic updates
 */
export interface UseMutationOptions<TData, TVariables, TContext> {
  onMutate?: (variables: TVariables) => TContext | Promise<TContext>;
  onSuccess?: (data: TData, variables: TVariables, context: TContext | undefined) => void;
  onError?: (error: Error, variables: TVariables, context: TContext | undefined) => void;
  onSettled?: (data: TData | undefined, error: Error | null, variables: TVariables, context: TContext | undefined) => void;
}

export interface UseMutationResult<TData, TVariables> {
  mutate: (variables: TVariables) => void;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  data: TData | null;
  error: Error | null;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  reset: () => void;
}

export function useMutation<TData, TVariables, TContext = unknown>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: UseMutationOptions<TData, TVariables, TContext> = {}
): UseMutationResult<TData, TVariables> {
  const { onMutate, onSuccess, onError, onSettled } = options;

  const [data, setData] = React.useState<TData | null>(null);
  const [error, setError] = React.useState<Error | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [isError, setIsError] = React.useState(false);

  const reset = React.useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
    setIsSuccess(false);
    setIsError(false);
  }, []);

  const mutateAsync = React.useCallback(async (variables: TVariables): Promise<TData> => {
    setIsLoading(true);
    setIsSuccess(false);
    setIsError(false);
    setError(null);

    let context: TContext | undefined;

    try {
      context = await onMutate?.(variables);
      const result = await mutationFn(variables);
      
      setData(result);
      setIsSuccess(true);
      onSuccess?.(result, variables, context);
      onSettled?.(result, null, variables, context);
      
      return result;
    } catch (err) {
      const error = err as Error;
      setError(error);
      setIsError(true);
      onError?.(error, variables, context);
      onSettled?.(undefined, error, variables, context);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [mutationFn, onMutate, onSuccess, onError, onSettled]);

  const mutate = React.useCallback((variables: TVariables) => {
    mutateAsync(variables).catch(() => {
      // Error already handled in mutateAsync
    });
  }, [mutateAsync]);

  return {
    mutate,
    mutateAsync,
    data,
    error,
    isLoading,
    isSuccess,
    isError,
    reset,
  };
}
