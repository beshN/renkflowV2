/**
 * Advanced Search & Analytics - Main Export
 */

// Search Engine
export {
  SearchEngine,
  similarity,
  levenshteinDistance,
  jaccardSimilarity,
  type SearchableDocument,
  type SearchField,
  type FacetConfig,
  type FacetResult,
  type SearchOptions,
  type SearchResult,
  type HighlightedField,
} from './search-engine';

// Analytics Engine
export {
  AnalyticsEngine,
  type TimeSeriesDataPoint,
  type AggregateResult,
  type AggregationType,
  type AnalyticsQuery,
  type AnalyticsResult,
  type TrendInfo,
} from './analytics-engine';

// React Hooks
export {
  useSearch,
  useFacetedSearch,
  useAnalytics,
  useTimeSeries,
  useDashboardStats,
  useExport,
} from './hooks';
