/**
 * Global Search Hook
 * React hook for unified search across orders
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { Order } from '@/lib/types';

// ============================================
// Types
// ============================================

export interface GlobalSearchFilters {
  status?: string[];
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;
  amountMax?: number;
}

export interface GlobalSearchResult {
  items: Order[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  suggestions: string[];
  executionTime: number;
  engine: 'elasticsearch' | 'in-memory';
}

export interface UseGlobalSearchOptions {
  debounceMs?: number;
  pageSize?: number;
  initialFilters?: GlobalSearchFilters;
}

export interface UseGlobalSearchReturn {
  query: string;
  setQuery: (query: string) => void;
  results: GlobalSearchResult | null;
  isLoading: boolean;
  error: string | null;
  filters: GlobalSearchFilters;
  setFilters: (filters: GlobalSearchFilters) => void;
  page: number;
  setPage: (page: number) => void;
  sortBy: string;
  setSortBy: (sortBy: string) => void;
  sortOrder: 'asc' | 'desc';
  setSortOrder: (order: 'asc' | 'desc') => void;
  suggestions: string[];
  fetchSuggestions: (query: string) => Promise<void>;
  search: () => Promise<void>;
  reset: () => void;
}

// ============================================
// Hook Implementation
// ============================================

export function useGlobalSearch(options: UseGlobalSearchOptions = {}): UseGlobalSearchReturn {
  const {
    debounceMs = 300,
    pageSize = 20,
    initialFilters = {},
  } = options;

  // State
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<GlobalSearchFilters>(initialFilters);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Debounced query
  const debouncedQuery = useDebounce(query, debounceMs);

  // Abort controller for cancelling requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Build search URL
  const buildSearchUrl = useCallback((suggestionsOnly = false) => {
    const params = new URLSearchParams();
    
    if (debouncedQuery) params.set('q', debouncedQuery);
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    params.set('sortBy', sortBy);
    params.set('sortOrder', sortOrder);
    
    if (filters.status && filters.status.length > 0) {
      params.set('status', filters.status.join(','));
    }
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    if (filters.amountMin !== undefined) params.set('amountMin', String(filters.amountMin));
    if (filters.amountMax !== undefined) params.set('amountMax', String(filters.amountMax));
    
    if (suggestionsOnly) params.set('suggestionsOnly', 'true');

    return `/api/v1/search?${params.toString()}`;
  }, [debouncedQuery, page, pageSize, sortBy, sortOrder, filters]);

  // Search function
  const search = useCallback(async () => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(buildSearchUrl(), {
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Arama başarısız');
      }

      const data = await response.json();
      setResults(data.data);
      setSuggestions(data.data.suggestions || []);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Request was cancelled
      }
      setError(err instanceof Error ? err.message : 'Bir hata oluştu');
      setResults(null);
    } finally {
      setIsLoading(false);
    }
  }, [buildSearchUrl]);

  // Fetch suggestions only
  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSuggestions([]);
      return;
    }

    try {
      const params = new URLSearchParams({ q, suggestionsOnly: 'true' });
      const response = await fetch(`/api/v1/search?${params.toString()}`);
      
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.data.suggestions || []);
      }
    } catch {
      // Ignore suggestion errors
    }
  }, []);

  // Reset function
  const reset = useCallback(() => {
    setQuery('');
    setResults(null);
    setError(null);
    setFilters(initialFilters);
    setPage(1);
    setSortBy('createdAt');
    setSortOrder('desc');
    setSuggestions([]);
  }, [initialFilters]);

  // Auto-search when debounced query or filters change
  useEffect(() => {
    if (debouncedQuery || Object.keys(filters).length > 0) {
      search();
    }
  }, [debouncedQuery, filters, page, sortBy, sortOrder, search]);

  // Reset page when query or filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, filters]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    query,
    setQuery,
    results,
    isLoading,
    error,
    filters,
    setFilters,
    page,
    setPage,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    suggestions,
    fetchSuggestions,
    search,
    reset,
  };
}

// ============================================
// Command Palette Search Hook
// ============================================

export interface CommandSearchResult {
  type: 'order' | 'customer' | 'action';
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  action?: () => void;
}

export function useCommandSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CommandSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const debouncedQuery = useDebounce(query, 150);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }

    const searchCommands = async () => {
      setIsLoading(true);

      try {
        // Search orders
        const params = new URLSearchParams({ q: debouncedQuery, pageSize: '5' });
        const response = await fetch(`/api/v1/search?${params.toString()}`);
        
        if (response.ok) {
          const data = await response.json();
          const orderResults: CommandSearchResult[] = (data.data.items || []).map((order: Order) => ({
            type: 'order' as const,
            id: String(order.id),
            title: order.orderNumber,
            subtitle: `${order.customerName} - ${order.productName || 'Ürün yok'}`,
            icon: 'package',
          }));

          // Add action shortcuts
          const actionResults: CommandSearchResult[] = [];
          const queryLower = debouncedQuery.toLowerCase();

          if ('yeni sipariş'.includes(queryLower) || 'new order'.includes(queryLower)) {
            actionResults.push({
              type: 'action',
              id: 'new-order',
              title: 'Yeni Sipariş Oluştur',
              subtitle: 'Yeni bir sipariş ekle',
              icon: 'plus',
            });
          }

          if ('ayarlar'.includes(queryLower) || 'settings'.includes(queryLower)) {
            actionResults.push({
              type: 'action',
              id: 'settings',
              title: 'Ayarlar',
              subtitle: 'Uygulama ayarlarını aç',
              icon: 'settings',
            });
          }

          setResults([...actionResults, ...orderResults]);
        }
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    searchCommands();
  }, [debouncedQuery]);

  return {
    query,
    setQuery,
    results,
    isLoading,
    clear: () => {
      setQuery('');
      setResults([]);
    },
  };
}
