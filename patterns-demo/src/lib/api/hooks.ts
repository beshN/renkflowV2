// ============================================
// API HOOKS - Error Handling Integration
// ============================================

'use client';

import { useCallback, useState, useRef, useEffect } from 'react';
import { ApiException, NetworkError, TimeoutError } from './client';
import { useAppStore } from '../store';

// ============================================
// TYPES
// ============================================

interface UseApiOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  showNotification?: boolean;
}

interface UseApiState<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
}

// ============================================
// USE API HOOK
// ============================================

export function useApi<T, Args extends unknown[]>(
  apiFunction: (...args: Args) => Promise<T>,
  options: UseApiOptions<T> = {}
) {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    error: null,
    isLoading: false,
    isError: false,
    isSuccess: false,
  });

  const addNotification = useAppStore((s) => s.addNotification);
  
  // Stable reference for options callbacks
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const execute = useCallback(async (...args: Args): Promise<T | null> => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      isError: false,
      error: null,
    }));

    try {
      const data = await apiFunction(...args);
      
      setState({
        data,
        error: null,
        isLoading: false,
        isError: false,
        isSuccess: true,
      });

      optionsRef.current.onSuccess?.(data);
      return data;
    } catch (error) {
      const err = error as Error;
      
      setState({
        data: null,
        error: err,
        isLoading: false,
        isError: true,
        isSuccess: false,
      });

      // Show notification based on error type
      if (optionsRef.current.showNotification !== false) {
        if (err instanceof ApiException) {
          addNotification({
            type: 'error',
            message: err.message,
          });
        } else if (err instanceof NetworkError) {
          addNotification({
            type: 'error',
            message: 'Bağlantı hatası. Lütfen internet bağlantınızı kontrol edin.',
          });
        } else if (err instanceof TimeoutError) {
          addNotification({
            type: 'error',
            message: 'İstek zaman aşımına uğradı. Lütfen tekrar deneyin.',
          });
        } else {
          addNotification({
            type: 'error',
            message: 'Beklenmeyen bir hata oluştu.',
          });
        }
      }

      optionsRef.current.onError?.(err);
      return null;
    }
  }, [apiFunction, addNotification]);

  const reset = useCallback(() => {
    setState({
      data: null,
      error: null,
      isLoading: false,
      isError: false,
      isSuccess: false,
    });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
}

// ============================================
// USE MUTATION HOOK
// ============================================

interface UseMutationOptions<T, Args extends unknown[]> extends UseApiOptions<T> {
  invalidateQueries?: string[];
}

export function useMutation<T, Args extends unknown[]>(
  mutationFn: (...args: Args) => Promise<T>,
  options: UseMutationOptions<T, Args> = {}
) {
  const { execute, ...state } = useApi(mutationFn, options);

  const mutate = useCallback(async (...args: Args) => {
    const result = await execute(...args);
    
    if (result && options.invalidateQueries) {
      // Emit event to invalidate queries
      if (typeof window !== 'undefined') {
        options.invalidateQueries.forEach(queryKey => {
          window.dispatchEvent(new CustomEvent('query:invalidate', { 
            detail: { queryKey } 
          }));
        });
      }
    }

    return result;
  }, [execute, options.invalidateQueries]);

  return {
    ...state,
    mutate,
    mutateAsync: mutate,
  };
}

// ============================================
// ERROR BOUNDARY HOOK
// ============================================

export function useErrorHandler() {
  const addNotification = useAppStore((s) => s.addNotification);

  return useCallback((error: unknown) => {
    if (error instanceof ApiException) {
      // Handle specific API errors
      switch (error.code) {
        case 'VALIDATION_ERROR':
          addNotification({
            type: 'warning',
            message: 'Lütfen form alanlarını kontrol edin.',
          });
          break;
        case 'UNAUTHORIZED':
          addNotification({
            type: 'error',
            message: 'Oturum süreniz doldu. Lütfen tekrar giriş yapın.',
          });
          break;
        case 'FORBIDDEN':
          addNotification({
            type: 'error',
            message: 'Bu işlem için yetkiniz bulunmuyor.',
          });
          break;
        case 'NOT_FOUND':
          addNotification({
            type: 'error',
            message: 'Aradığınız kaynak bulunamadı.',
          });
          break;
        default:
          addNotification({
            type: 'error',
            message: error.message,
          });
      }
    } else if (error instanceof NetworkError) {
      addNotification({
        type: 'error',
        message: 'Sunucuya bağlanılamıyor. Lütfen internet bağlantınızı kontrol edin.',
      });
    } else if (error instanceof TimeoutError) {
      addNotification({
        type: 'warning',
        message: 'İstek zaman aşımına uğradı. Lütfen daha sonra tekrar deneyin.',
      });
    } else if (error instanceof Error) {
      addNotification({
        type: 'error',
        message: error.message || 'Beklenmeyen bir hata oluştu.',
      });
    }
  }, [addNotification]);
}

// ============================================
// RETRY HOOK
// ============================================

interface UseRetryOptions {
  maxRetries?: number;
  delay?: number;
  backoff?: boolean;
}

export function useRetry<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>,
  options: UseRetryOptions = {}
) {
  const { maxRetries = 3, delay = 1000, backoff = true } = options;

  return useCallback(async (...args: Args): Promise<T> => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn(...args);
      } catch (error) {
        lastError = error as Error;

        // Don't retry on client errors
        if (error instanceof ApiException && error.statusCode < 500) {
          throw error;
        }

        if (attempt < maxRetries) {
          const waitTime = backoff ? delay * Math.pow(2, attempt) : delay;
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    throw lastError;
  }, [fn, maxRetries, delay, backoff]);
}
