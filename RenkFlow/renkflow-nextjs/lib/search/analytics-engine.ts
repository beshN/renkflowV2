/**
 * Analytics Engine
 * - Real-time aggregate calculations
 * - Time series analysis
 * - Trend detection
 * - Export capabilities
 */

// ============================================
// Types
// ============================================

export interface TimeSeriesDataPoint {
  date: string;
  value: number;
  label?: string;
}

export interface AggregateResult {
  field: string;
  aggregation: AggregationType;
  value: number;
  breakdown?: { label: string; value: number; percentage: number }[];
}

export type AggregationType = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'median';

export interface AnalyticsQuery {
  dateRange?: { start: string; end: string };
  groupBy?: string;
  aggregations: { field: string; type: AggregationType }[];
  filters?: Record<string, unknown>;
  timeSeries?: {
    field: string;
    interval: 'day' | 'week' | 'month' | 'quarter' | 'year';
    aggregation: AggregationType;
  };
}

export interface AnalyticsResult {
  aggregates: AggregateResult[];
  timeSeries?: TimeSeriesDataPoint[];
  breakdown?: Record<string, { label: string; value: number; percentage: number }[]>;
  metadata: {
    totalRecords: number;
    filteredRecords: number;
    executionTime: number;
    dateRange?: { start: string; end: string };
  };
}

export interface TrendInfo {
  direction: 'up' | 'down' | 'stable';
  percentage: number;
  isSignificant: boolean;
}

// ============================================
// Analytics Engine
// ============================================

interface AnalyzableDocument {
  id: string;
  date?: string;
  createdAt?: string;
  [key: string]: unknown;
}

class AnalyticsEngine<T extends AnalyzableDocument> {
  private data: T[] = [];

  constructor(data: T[] = []) {
    this.data = data;
  }

  setData(data: T[]): void {
    this.data = data;
  }

  analyze(query: AnalyticsQuery): AnalyticsResult {
    const startTime = performance.now();

    let filteredData = [...this.data];

    // Apply date range filter
    if (query.dateRange) {
      filteredData = this.filterByDateRange(filteredData, query.dateRange);
    }

    // Apply custom filters
    if (query.filters) {
      filteredData = this.applyFilters(filteredData, query.filters);
    }

    // Calculate aggregates
    const aggregates = query.aggregations.map((agg) =>
      this.calculateAggregate(filteredData, agg.field, agg.type, query.groupBy)
    );

    // Calculate time series
    let timeSeries: TimeSeriesDataPoint[] | undefined;
    if (query.timeSeries) {
      timeSeries = this.calculateTimeSeries(
        filteredData,
        query.timeSeries.field,
        query.timeSeries.interval,
        query.timeSeries.aggregation
      );
    }

    // Calculate breakdown if groupBy is specified
    let breakdown: Record<string, { label: string; value: number; percentage: number }[]> | undefined;
    if (query.groupBy) {
      breakdown = {};
      for (const agg of query.aggregations) {
        breakdown[agg.field] = this.calculateBreakdown(filteredData, agg.field, query.groupBy, agg.type);
      }
    }

    const executionTime = performance.now() - startTime;

    return {
      aggregates,
      timeSeries,
      breakdown,
      metadata: {
        totalRecords: this.data.length,
        filteredRecords: filteredData.length,
        executionTime,
        dateRange: query.dateRange,
      },
    };
  }

  // ============================================
  // Filtering
  // ============================================

  private filterByDateRange(data: T[], range: { start: string; end: string }): T[] {
    const startDate = new Date(range.start);
    const endDate = new Date(range.end);

    return data.filter((item) => {
      const dateStr = item.date || item.createdAt;
      if (!dateStr) return true;

      const itemDate = new Date(dateStr);
      return itemDate >= startDate && itemDate <= endDate;
    });
  }

  private applyFilters(data: T[], filters: Record<string, unknown>): T[] {
    return data.filter((item) => {
      for (const [field, value] of Object.entries(filters)) {
        const itemValue = this.getFieldValue(item, field);

        if (Array.isArray(value)) {
          if (!value.includes(itemValue)) return false;
        } else if (value !== undefined && value !== null && itemValue !== value) {
          return false;
        }
      }
      return true;
    });
  }

  // ============================================
  // Aggregations
  // ============================================

  private calculateAggregate(
    data: T[],
    field: string,
    type: AggregationType,
    groupBy?: string
  ): AggregateResult {
    const values = data
      .map((item) => this.getNumericValue(item, field))
      .filter((v) => v !== null) as number[];

    let value: number;

    switch (type) {
      case 'sum':
        value = values.reduce((a, b) => a + b, 0);
        break;
      case 'avg':
        value = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        break;
      case 'count':
        value = data.length;
        break;
      case 'min':
        value = values.length > 0 ? Math.min(...values) : 0;
        break;
      case 'max':
        value = values.length > 0 ? Math.max(...values) : 0;
        break;
      case 'median':
        value = this.calculateMedian(values);
        break;
      default:
        value = 0;
    }

    const result: AggregateResult = { field, aggregation: type, value };

    if (groupBy) {
      result.breakdown = this.calculateBreakdown(data, field, groupBy, type);
    }

    return result;
  }

  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  private calculateBreakdown(
    data: T[],
    field: string,
    groupBy: string,
    aggregationType: AggregationType
  ): { label: string; value: number; percentage: number }[] {
    const groups = new Map<string, T[]>();

    for (const item of data) {
      const groupValue = String(this.getFieldValue(item, groupBy) || 'Unknown');
      if (!groups.has(groupValue)) {
        groups.set(groupValue, []);
      }
      groups.get(groupValue)!.push(item);
    }

    const results: { label: string; value: number }[] = [];
    let total = 0;

    for (const [label, groupData] of groups) {
      const values = groupData
        .map((item) => this.getNumericValue(item, field))
        .filter((v) => v !== null) as number[];

      let value: number;

      switch (aggregationType) {
        case 'sum':
          value = values.reduce((a, b) => a + b, 0);
          break;
        case 'avg':
          value = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
          break;
        case 'count':
          value = groupData.length;
          break;
        case 'min':
          value = values.length > 0 ? Math.min(...values) : 0;
          break;
        case 'max':
          value = values.length > 0 ? Math.max(...values) : 0;
          break;
        case 'median':
          value = this.calculateMedian(values);
          break;
        default:
          value = 0;
      }

      results.push({ label, value });
      total += value;
    }

    return results
      .map((r) => ({
        ...r,
        percentage: total > 0 ? (r.value / total) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }

  // ============================================
  // Time Series
  // ============================================

  private calculateTimeSeries(
    data: T[],
    field: string,
    interval: 'day' | 'week' | 'month' | 'quarter' | 'year',
    aggregation: AggregationType
  ): TimeSeriesDataPoint[] {
    const buckets = new Map<string, T[]>();

    for (const item of data) {
      const dateStr = item.date || item.createdAt;
      if (!dateStr) continue;

      const bucketKey = this.getDateBucketKey(new Date(dateStr), interval);
      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, []);
      }
      buckets.get(bucketKey)!.push(item);
    }

    const results: TimeSeriesDataPoint[] = [];

    for (const [date, bucketData] of buckets) {
      const values = bucketData
        .map((item) => this.getNumericValue(item, field))
        .filter((v) => v !== null) as number[];

      let value: number;

      switch (aggregation) {
        case 'sum':
          value = values.reduce((a, b) => a + b, 0);
          break;
        case 'avg':
          value = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
          break;
        case 'count':
          value = bucketData.length;
          break;
        case 'min':
          value = values.length > 0 ? Math.min(...values) : 0;
          break;
        case 'max':
          value = values.length > 0 ? Math.max(...values) : 0;
          break;
        case 'median':
          value = this.calculateMedian(values);
          break;
        default:
          value = 0;
      }

      results.push({ date, value });
    }

    return results.sort((a, b) => a.date.localeCompare(b.date));
  }

  private getDateBucketKey(date: Date, interval: 'day' | 'week' | 'month' | 'quarter' | 'year'): string {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();

    switch (interval) {
      case 'day':
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(day - date.getDay());
        return `${weekStart.getFullYear()}-W${String(Math.ceil((weekStart.getDate() + 1) / 7)).padStart(2, '0')}`;
      case 'month':
        return `${year}-${String(month + 1).padStart(2, '0')}`;
      case 'quarter':
        return `${year}-Q${Math.floor(month / 3) + 1}`;
      case 'year':
        return String(year);
      default:
        return `${year}-${String(month + 1).padStart(2, '0')}`;
    }
  }

  // ============================================
  // Trend Analysis
  // ============================================

  calculateTrend(timeSeries: TimeSeriesDataPoint[], threshold: number = 5): TrendInfo {
    if (timeSeries.length < 2) {
      return { direction: 'stable', percentage: 0, isSignificant: false };
    }

    const recent = timeSeries.slice(-Math.ceil(timeSeries.length / 2));
    const previous = timeSeries.slice(0, Math.floor(timeSeries.length / 2));

    const recentAvg = recent.reduce((sum, p) => sum + p.value, 0) / recent.length;
    const previousAvg = previous.reduce((sum, p) => sum + p.value, 0) / previous.length;

    if (previousAvg === 0) {
      return { direction: 'stable', percentage: 0, isSignificant: false };
    }

    const percentageChange = ((recentAvg - previousAvg) / previousAvg) * 100;
    const direction = percentageChange > threshold ? 'up' : percentageChange < -threshold ? 'down' : 'stable';
    const isSignificant = Math.abs(percentageChange) > threshold;

    return {
      direction,
      percentage: Math.abs(percentageChange),
      isSignificant,
    };
  }

  // ============================================
  // Export
  // ============================================

  exportToCSV(data: T[], fields?: string[]): string {
    if (data.length === 0) return '';

    const exportFields = fields || Object.keys(data[0]);

    const header = exportFields.join(',');
    const rows = data.map((item) =>
      exportFields
        .map((field) => {
          const value = this.getFieldValue(item, field);
          const strValue = value === null || value === undefined ? '' : String(value);
          return strValue.includes(',') || strValue.includes('"')
            ? `"${strValue.replace(/"/g, '""')}"`
            : strValue;
        })
        .join(',')
    );

    return [header, ...rows].join('\n');
  }

  exportToJSON(data: T[], pretty: boolean = true): string {
    return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  }

  // ============================================
  // Utilities
  // ============================================

  private getFieldValue(item: T, field: string): unknown {
    const parts = field.split('.');
    let value: unknown = item;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  private getNumericValue(item: T, field: string): number | null {
    const value = this.getFieldValue(item, field);

    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? null : parsed;
    }

    return null;
  }
}

export { AnalyticsEngine };
