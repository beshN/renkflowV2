'use client';

import React from 'react';
import { SearchEngine, SearchOptions, SearchResult, SearchableDocument } from './search-engine';
import { AnalyticsEngine, AnalyticsQuery, AnalyticsResult, TimeSeriesDataPoint, TrendInfo } from './analytics-engine';

/**
 * React Hooks for Search & Analytics
 */

// ============================================
// Search Hook
// ============================================

interface UseSearchOptions<T> extends Omit<SearchOptions, 'query'> {
  debounceMs?: number;
  minQueryLength?: number;
}

interface UseSearchResult<T> {
  results: SearchResult<T> | null;
  isSearching: boolean;
  query: string;
  setQuery: (query: string) => void;
  search: (options?: Partial<SearchOptions>) => void;
  suggestions: string[];
  clearResults: () => void;
}

export function useSearch<T extends SearchableDocument>(
  data: T[],
  options: UseSearchOptions<T> = {}
): UseSearchResult<T> {
  const { debounceMs = 300, minQueryLength = 2, ...searchOptions } = options;

  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<SearchResult<T> | null>(null);
  const [isSearching, setIsSearching] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);

  const searchEngine = React.useMemo(() => new SearchEngine<T>(data), [data]);
  const debounceTimer = React.useRef<NodeJS.Timeout | null>(null);

  const performSearch = React.useCallback(
    (searchQuery: string, additionalOptions?: Partial<SearchOptions>) => {
      if (searchQuery.length < minQueryLength) {
        setResults(null);
        return;
      }

      setIsSearching(true);

      const searchResult = searchEngine.search({
        query: searchQuery,
        ...searchOptions,
        ...additionalOptions,
      });

      setResults(searchResult);
      setIsSearching(false);
    },
    [searchEngine, searchOptions, minQueryLength]
  );

  // Debounced search on query change
  React.useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (query.length >= minQueryLength) {
      debounceTimer.current = setTimeout(() => {
        performSearch(query);
      }, debounceMs);
    } else {
      setResults(null);
    }

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [query, debounceMs, minQueryLength, performSearch]);

  // Update suggestions
  React.useEffect(() => {
    if (query.length >= 2) {
      const newSuggestions = searchEngine.getSuggestions(query);
      setSuggestions(newSuggestions);
    } else {
      setSuggestions([]);
    }
  }, [query, searchEngine]);

  const search = React.useCallback(
    (additionalOptions?: Partial<SearchOptions>) => {
      performSearch(query, additionalOptions);
    },
    [query, performSearch]
  );

  const clearResults = React.useCallback(() => {
    setQuery('');
    setResults(null);
    setSuggestions([]);
  }, []);

  return {
    results,
    isSearching,
    query,
    setQuery,
    search,
    suggestions,
    clearResults,
  };
}

// ============================================
// Faceted Search Hook
// ============================================

interface UseFacetedSearchOptions<T> extends UseSearchOptions<T> {
  initialFilters?: Record<string, unknown>;
}

interface UseFacetedSearchResult<T> extends UseSearchResult<T> {
  filters: Record<string, unknown>;
  setFilter: (field: string, value: unknown) => void;
  removeFilter: (field: string) => void;
  clearFilters: () => void;
  activeFilterCount: number;
}

export function useFacetedSearch<T extends SearchableDocument>(
  data: T[],
  options: UseFacetedSearchOptions<T> = {}
): UseFacetedSearchResult<T> {
  const { initialFilters = {}, ...searchOptions } = options;

  const [filters, setFilters] = React.useState<Record<string, unknown>>(initialFilters);

  const searchResult = useSearch<T>(data, {
    ...searchOptions,
    filters,
  });

  const setFilter = React.useCallback((field: string, value: unknown) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }, []);

  const removeFilter = React.useCallback((field: string) => {
    setFilters((prev) => {
      const { [field]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const clearFilters = React.useCallback(() => {
    setFilters({});
  }, []);

  const activeFilterCount = React.useMemo(() => {
    return Object.values(filters).filter((v) => v !== null && v !== undefined).length;
  }, [filters]);

  return {
    ...searchResult,
    filters,
    setFilter,
    removeFilter,
    clearFilters,
    activeFilterCount,
  };
}

// ============================================
// Analytics Hook
// ============================================

interface UseAnalyticsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseAnalyticsResult {
  result: AnalyticsResult | null;
  isLoading: boolean;
  error: Error | null;
  analyze: (query: AnalyticsQuery) => void;
  refresh: () => void;
  exportCSV: (fields?: string[]) => string;
  exportJSON: () => string;
}

export function useAnalytics<T extends { id: string; [key: string]: unknown }>(
  data: T[],
  initialQuery?: AnalyticsQuery,
  options: UseAnalyticsOptions = {}
): UseAnalyticsResult {
  const { autoRefresh = false, refreshInterval = 60000 } = options;

  const [result, setResult] = React.useState<AnalyticsResult | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [currentQuery, setCurrentQuery] = React.useState<AnalyticsQuery | null>(initialQuery || null);

  const analyticsEngine = React.useMemo(() => new AnalyticsEngine<T>(data), [data]);

  const analyze = React.useCallback(
    (query: AnalyticsQuery) => {
      setIsLoading(true);
      setError(null);

      try {
        const analysisResult = analyticsEngine.analyze(query);
        setResult(analysisResult);
        setCurrentQuery(query);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    },
    [analyticsEngine]
  );

  const refresh = React.useCallback(() => {
    if (currentQuery) {
      analyze(currentQuery);
    }
  }, [currentQuery, analyze]);

  // Initial analysis
  React.useEffect(() => {
    if (initialQuery) {
      analyze(initialQuery);
    }
  }, [initialQuery, analyze]);

  // Auto refresh
  React.useEffect(() => {
    if (!autoRefresh || !currentQuery) return;

    const interval = setInterval(refresh, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, refresh, currentQuery]);

  const exportCSV = React.useCallback(
    (fields?: string[]) => {
      return analyticsEngine.exportToCSV(data, fields);
    },
    [analyticsEngine, data]
  );

  const exportJSON = React.useCallback(() => {
    return analyticsEngine.exportToJSON(data);
  }, [analyticsEngine, data]);

  return {
    result,
    isLoading,
    error,
    analyze,
    refresh,
    exportCSV,
    exportJSON,
  };
}

// ============================================
// Time Series Hook
// ============================================

interface UseTimeSeriesOptions {
  field: string;
  interval: 'day' | 'week' | 'month' | 'quarter' | 'year';
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'median';
  dateRange?: { start: string; end: string };
}

interface UseTimeSeriesResult {
  data: TimeSeriesDataPoint[];
  trend: TrendInfo;
  isLoading: boolean;
  refresh: () => void;
}

export function useTimeSeries<T extends { id: string; date?: string; createdAt?: string; [key: string]: unknown }>(
  data: T[],
  options: UseTimeSeriesOptions
): UseTimeSeriesResult {
  const { field, interval, aggregation, dateRange } = options;

  const [timeSeriesData, setTimeSeriesData] = React.useState<TimeSeriesDataPoint[]>([]);
  const [trend, setTrend] = React.useState<TrendInfo>({ direction: 'stable', percentage: 0, isSignificant: false });
  const [isLoading, setIsLoading] = React.useState(false);

  const analyticsEngine = React.useMemo(() => new AnalyticsEngine<T>(data), [data]);

  const calculate = React.useCallback(() => {
    setIsLoading(true);

    const result = analyticsEngine.analyze({
      dateRange,
      aggregations: [{ field, type: aggregation }],
      timeSeries: { field, interval, aggregation },
    });

    if (result.timeSeries) {
      setTimeSeriesData(result.timeSeries);
      setTrend(analyticsEngine.calculateTrend(result.timeSeries));
    }

    setIsLoading(false);
  }, [analyticsEngine, field, interval, aggregation, dateRange]);

  React.useEffect(() => {
    calculate();
  }, [calculate]);

  return {
    data: timeSeriesData,
    trend,
    isLoading,
    refresh: calculate,
  };
}

// ============================================
// Dashboard Stats Hook
// ============================================

interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  pendingOrders: number;
  completedOrders: number;
  revenueByStatus: { label: string; value: number; percentage: number }[];
  ordersByMonth: TimeSeriesDataPoint[];
  revenueByMonth: TimeSeriesDataPoint[];
  revenueTrend: TrendInfo;
  orderTrend: TrendInfo;
}

interface Order {
  id: string;
  status: string;
  totalAmount?: number;
  date?: string;
  createdAt?: string;
}

export function useDashboardStats(orders: Order[]): DashboardStats {
  const analyticsEngine = React.useMemo(() => new AnalyticsEngine<Order>(orders), [orders]);

  return React.useMemo(() => {
    // Basic aggregates
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const pendingOrders = orders.filter((o) => o.status === 'pending').length;
    const completedOrders = orders.filter((o) => o.status === 'delivered').length;

    // Revenue by status
    const statusGroups = new Map<string, number>();
    orders.forEach((order) => {
      const current = statusGroups.get(order.status) || 0;
      statusGroups.set(order.status, current + (order.totalAmount || 0));
    });

    const revenueByStatus = Array.from(statusGroups.entries())
      .map(([label, value]) => ({
        label,
        value,
        percentage: totalRevenue > 0 ? (value / totalRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);

    // Time series
    const ordersResult = analyticsEngine.analyze({
      aggregations: [{ field: 'id', type: 'count' }],
      timeSeries: { field: 'id', interval: 'month', aggregation: 'count' },
    });

    const revenueResult = analyticsEngine.analyze({
      aggregations: [{ field: 'totalAmount', type: 'sum' }],
      timeSeries: { field: 'totalAmount', interval: 'month', aggregation: 'sum' },
    });

    const ordersByMonth = ordersResult.timeSeries || [];
    const revenueByMonth = revenueResult.timeSeries || [];

    // Trends
    const orderTrend = analyticsEngine.calculateTrend(ordersByMonth);
    const revenueTrend = analyticsEngine.calculateTrend(revenueByMonth);

    return {
      totalOrders,
      totalRevenue,
      avgOrderValue,
      pendingOrders,
      completedOrders,
      revenueByStatus,
      ordersByMonth,
      revenueByMonth,
      revenueTrend,
      orderTrend,
    };
  }, [orders, analyticsEngine]);
}

// ============================================
// Export Hook
// ============================================

interface UseExportOptions {
  filename?: string;
  fields?: string[];
}

export function useExport<T extends Record<string, unknown>>(
  data: T[],
  options: UseExportOptions = {}
): {
  exportAsCSV: () => void;
  exportAsJSON: () => void;
  exportAsPDF: () => Promise<void>;
} {
  const { filename = 'export', fields } = options;

  const analyticsEngine = React.useMemo(() => {
    return new AnalyticsEngine<T & { id: string }>(data as (T & { id: string })[]);
  }, [data]);

  const exportAsCSV = React.useCallback(() => {
    const csv = analyticsEngine.exportToCSV(data as (T & { id: string })[], fields);
    downloadFile(csv, `${filename}.csv`, 'text/csv');
  }, [analyticsEngine, data, filename, fields]);

  const exportAsJSON = React.useCallback(() => {
    const json = analyticsEngine.exportToJSON(data as (T & { id: string })[]);
    downloadFile(json, `${filename}.json`, 'application/json');
  }, [analyticsEngine, data, filename]);

  const exportAsPDF = React.useCallback(async () => {
    // PDF export would require a library like jsPDF
    console.warn('PDF export requires jsPDF library');
  }, []);

  return { exportAsCSV, exportAsJSON, exportAsPDF };
}

// ============================================
// Utility Functions
// ============================================

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
