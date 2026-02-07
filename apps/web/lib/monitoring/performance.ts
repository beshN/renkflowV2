/**
 * Performance Monitoring Utilities
 * Track query execution, component render times, and Core Web Vitals
 */

import 'server-only';

// ============================================
// Types
// ============================================

interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count';
  timestamp: number;
  metadata?: Record<string, unknown>;
}

interface QueryMetric {
  query: string;
  duration: number;
  rowCount?: number;
  cached?: boolean;
}

interface PerformanceReport {
  period: string;
  metrics: {
    avgQueryTime: number;
    maxQueryTime: number;
    totalQueries: number;
    slowQueries: number;
    cacheHitRate: number;
  };
  slowestQueries: QueryMetric[];
}

// ============================================
// Storage
// ============================================

const metricsBuffer: PerformanceMetric[] = [];
const queryMetrics: QueryMetric[] = [];
const MAX_BUFFER_SIZE = 1000;
const SLOW_QUERY_THRESHOLD = 100; // ms

// ============================================
// Performance Monitor Class
// ============================================

export class PerformanceMonitor {
  /**
   * Track a generic performance metric
   */
  static track(
    name: string,
    value: number,
    unit: 'ms' | 'bytes' | 'count' = 'ms',
    metadata?: Record<string, unknown>
  ): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      metadata,
    };

    metricsBuffer.push(metric);

    // Keep buffer size manageable
    if (metricsBuffer.length > MAX_BUFFER_SIZE) {
      metricsBuffer.shift();
    }

    // Log slow operations
    if (unit === 'ms' && value > SLOW_QUERY_THRESHOLD) {
      console.warn(`[Performance] Slow operation: ${name} took ${value}ms`, metadata);
    }
  }

  /**
   * Track database query execution
   */
  static trackQuery(query: string, duration: number, rowCount?: number, cached = false): void {
    const metric: QueryMetric = {
      query: query.slice(0, 100), // Truncate long queries
      duration,
      rowCount,
      cached,
    };

    queryMetrics.push(metric);

    // Keep buffer size manageable
    if (queryMetrics.length > MAX_BUFFER_SIZE) {
      queryMetrics.shift();
    }

    // Track as general metric too
    this.track('database.query', duration, 'ms', { 
      queryPrefix: query.slice(0, 50),
      rowCount,
      cached,
    });
  }

  /**
   * Measure async function execution time
   */
  static async measure<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.track(name, duration, 'ms', { ...metadata, success: true });
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.track(name, duration, 'ms', { ...metadata, success: false, error: String(error) });
      throw error;
    }
  }

  /**
   * Create a timer for manual tracking
   */
  static startTimer(name: string): () => number {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.track(name, duration, 'ms');
      return duration;
    };
  }

  /**
   * Get performance report for the last N minutes
   */
  static getReport(minutes: number = 5): PerformanceReport {
    const cutoff = Date.now() - minutes * 60 * 1000;
    
    // Filter recent queries
    const recentQueries = queryMetrics.filter(q => {
      const metric = metricsBuffer.find(m => 
        m.name === 'database.query' && 
        m.metadata?.queryPrefix === q.query.slice(0, 50)
      );
      return !metric || metric.timestamp >= cutoff;
    });

    const totalQueries = recentQueries.length;
    const slowQueries = recentQueries.filter(q => q.duration > SLOW_QUERY_THRESHOLD).length;
    const cachedQueries = recentQueries.filter(q => q.cached).length;

    const queryDurations = recentQueries.map(q => q.duration);
    const avgQueryTime = totalQueries > 0 
      ? queryDurations.reduce((a, b) => a + b, 0) / totalQueries 
      : 0;
    const maxQueryTime = totalQueries > 0 
      ? Math.max(...queryDurations) 
      : 0;

    // Get slowest queries
    const slowestQueries = [...recentQueries]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    return {
      period: `Last ${minutes} minutes`,
      metrics: {
        avgQueryTime: Math.round(avgQueryTime * 100) / 100,
        maxQueryTime: Math.round(maxQueryTime * 100) / 100,
        totalQueries,
        slowQueries,
        cacheHitRate: totalQueries > 0 
          ? Math.round((cachedQueries / totalQueries) * 100) 
          : 0,
      },
      slowestQueries,
    };
  }

  /**
   * Get metrics by name
   */
  static getMetrics(name?: string, minutes: number = 5): PerformanceMetric[] {
    const cutoff = Date.now() - minutes * 60 * 1000;
    return metricsBuffer.filter(m => 
      m.timestamp >= cutoff && 
      (!name || m.name === name)
    );
  }

  /**
   * Clear all metrics (for testing)
   */
  static clear(): void {
    metricsBuffer.length = 0;
    queryMetrics.length = 0;
  }

  /**
   * Get average for a metric
   */
  static getAverage(name: string, minutes: number = 5): number {
    const metrics = this.getMetrics(name, minutes);
    if (metrics.length === 0) return 0;
    return metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;
  }

  /**
   * Get percentile for a metric
   */
  static getPercentile(name: string, percentile: number, minutes: number = 5): number {
    const metrics = this.getMetrics(name, minutes);
    if (metrics.length === 0) return 0;

    const sorted = [...metrics].sort((a, b) => a.value - b.value);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)].value;
  }
}

// ============================================
// Database Query Wrapper
// ============================================

/**
 * Wrap a database query function with performance tracking
 */
export function withQueryTracking<T extends (...args: any[]) => Promise<any>>(
  queryFn: T,
  queryName: string
): T {
  return (async (...args: Parameters<T>) => {
    const start = performance.now();
    try {
      const result = await queryFn(...args);
      const duration = performance.now() - start;
      PerformanceMonitor.trackQuery(
        queryName,
        duration,
        Array.isArray(result) ? result.length : undefined
      );
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      PerformanceMonitor.track('database.error', duration, 'ms', {
        query: queryName,
        error: String(error),
      });
      throw error;
    }
  }) as T;
}

// ============================================
// Export Helper
// ============================================

/**
 * Track large export operations
 */
export function trackExport(
  exportType: string,
  recordCount: number,
  durationMs: number
): void {
  PerformanceMonitor.track('export.operation', durationMs, 'ms', {
    type: exportType,
    recordCount,
    recordsPerSecond: Math.round((recordCount / durationMs) * 1000),
  });
}

// ============================================
// Health Check
// ============================================

export function getHealthMetrics(): {
  status: 'healthy' | 'degraded' | 'unhealthy';
  avgQueryTime: number;
  slowQueryRatio: number;
  totalRequests: number;
} {
  const report = PerformanceMonitor.getReport(5);
  
  const slowQueryRatio = report.metrics.totalQueries > 0
    ? report.metrics.slowQueries / report.metrics.totalQueries
    : 0;

  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (report.metrics.avgQueryTime > 200 || slowQueryRatio > 0.3) {
    status = 'degraded';
  }
  if (report.metrics.avgQueryTime > 500 || slowQueryRatio > 0.5) {
    status = 'unhealthy';
  }

  return {
    status,
    avgQueryTime: report.metrics.avgQueryTime,
    slowQueryRatio: Math.round(slowQueryRatio * 100) / 100,
    totalRequests: report.metrics.totalQueries,
  };
}
