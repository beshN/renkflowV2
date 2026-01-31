/**
 * Advanced Search Engine
 * - Fuzzy search with Levenshtein distance
 * - Multi-field search
 * - Faceted filtering
 * - Query optimization
 */

// ============================================
// Types
// ============================================

export interface SearchableDocument {
  id: string;
  [key: string]: unknown;
}

export interface SearchField {
  name: string;
  weight?: number;
  fuzzy?: boolean;
  exact?: boolean;
}

export interface FacetConfig {
  field: string;
  type: 'value' | 'range' | 'date';
  ranges?: { min: number; max: number; label: string }[];
}

export interface FacetResult {
  field: string;
  values: { value: string | number; count: number; label?: string }[];
}

export interface SearchOptions {
  query?: string;
  fields?: SearchField[];
  filters?: Record<string, unknown>;
  facets?: FacetConfig[];
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  fuzzyThreshold?: number;
  highlight?: boolean;
}

export interface SearchResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets: FacetResult[];
  query: string;
  executionTime: number;
}

export interface HighlightedField {
  field: string;
  original: string;
  highlighted: string;
  matches: { start: number; end: number }[];
}

// ============================================
// Fuzzy Search Utilities
// ============================================

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity score (0-1) between two strings
 */
function similarity(a: string, b: string): number {
  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  const maxLength = Math.max(a.length, b.length);
  return maxLength === 0 ? 1 : 1 - distance / maxLength;
}

/**
 * N-gram tokenizer for fuzzy matching
 */
function getNGrams(text: string, n: number = 2): Set<string> {
  const normalized = text.toLowerCase().trim();
  const ngrams = new Set<string>();

  for (let i = 0; i <= normalized.length - n; i++) {
    ngrams.add(normalized.substring(i, i + n));
  }

  return ngrams;
}

/**
 * Calculate Jaccard similarity using n-grams
 */
function jaccardSimilarity(a: string, b: string, n: number = 2): number {
  const ngramsA = getNGrams(a, n);
  const ngramsB = getNGrams(b, n);

  const intersection = new Set([...ngramsA].filter((x) => ngramsB.has(x)));
  const union = new Set([...ngramsA, ...ngramsB]);

  return union.size === 0 ? 0 : intersection.size / union.size;
}

// ============================================
// Search Engine Class
// ============================================

class SearchEngine<T extends SearchableDocument> {
  private documents: T[] = [];
  private index: Map<string, Set<string>> = new Map();
  private fieldIndex: Map<string, Map<string, Set<string>>> = new Map();

  constructor(documents: T[] = []) {
    if (documents.length > 0) {
      this.setDocuments(documents);
    }
  }

  setDocuments(documents: T[]): void {
    this.documents = documents;
    this.buildIndex();
  }

  addDocument(document: T): void {
    this.documents.push(document);
    this.indexDocument(document);
  }

  removeDocument(id: string): void {
    this.documents = this.documents.filter((doc) => doc.id !== id);
    this.buildIndex();
  }

  private buildIndex(): void {
    this.index.clear();
    this.fieldIndex.clear();

    for (const document of this.documents) {
      this.indexDocument(document);
    }
  }

  private indexDocument(document: T): void {
    const tokens = this.tokenize(document);

    for (const token of tokens) {
      if (!this.index.has(token)) {
        this.index.set(token, new Set());
      }
      this.index.get(token)!.add(document.id);
    }

    // Build field-specific index
    for (const [field, value] of Object.entries(document)) {
      if (typeof value === 'string') {
        if (!this.fieldIndex.has(field)) {
          this.fieldIndex.set(field, new Map());
        }
        const fieldTokens = this.tokenizeString(value);
        for (const token of fieldTokens) {
          if (!this.fieldIndex.get(field)!.has(token)) {
            this.fieldIndex.get(field)!.set(token, new Set());
          }
          this.fieldIndex.get(field)!.get(token)!.add(document.id);
        }
      }
    }
  }

  private tokenize(document: T): string[] {
    const tokens: string[] = [];

    for (const [, value] of Object.entries(document)) {
      if (typeof value === 'string') {
        tokens.push(...this.tokenizeString(value));
      }
    }

    return tokens;
  }

  private tokenizeString(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 1);
  }

  search(options: SearchOptions): SearchResult<T> {
    const startTime = performance.now();

    const {
      query = '',
      fields = [],
      filters = {},
      facets = [],
      page = 1,
      pageSize = 20,
      sortBy,
      sortOrder = 'desc',
      fuzzyThreshold = 0.6,
    } = options;

    let results = [...this.documents];

    // Apply filters
    results = this.applyFilters(results, filters);

    // Apply text search
    if (query.trim()) {
      results = this.searchText(results, query, fields, fuzzyThreshold);
    }

    // Calculate facets before pagination
    const facetResults = this.calculateFacets(results, facets);

    // Sort results
    if (sortBy) {
      results = this.sortResults(results, sortBy, sortOrder);
    }

    // Paginate
    const total = results.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (page - 1) * pageSize;
    const paginatedResults = results.slice(startIndex, startIndex + pageSize);

    const executionTime = performance.now() - startTime;

    return {
      items: paginatedResults,
      total,
      page,
      pageSize,
      totalPages,
      facets: facetResults,
      query,
      executionTime,
    };
  }

  private searchText(
    documents: T[],
    query: string,
    fields: SearchField[],
    fuzzyThreshold: number
  ): T[] {
    const queryTokens = this.tokenizeString(query);
    const searchFields = fields.length > 0 ? fields : this.getDefaultFields();

    const scored = documents.map((doc) => {
      let totalScore = 0;

      for (const field of searchFields) {
        const fieldValue = this.getFieldValue(doc, field.name);
        if (!fieldValue) continue;

        const weight = field.weight || 1;
        let fieldScore = 0;

        if (field.exact) {
          // Exact match
          if (fieldValue.toLowerCase().includes(query.toLowerCase())) {
            fieldScore = 1;
          }
        } else if (field.fuzzy !== false) {
          // Fuzzy match
          const docTokens = this.tokenizeString(fieldValue);
          for (const queryToken of queryTokens) {
            for (const docToken of docTokens) {
              const sim = similarity(queryToken, docToken);
              if (sim >= fuzzyThreshold) {
                fieldScore += sim;
              }
            }
          }

          // Also check Jaccard similarity for the whole field
          const jaccardScore = jaccardSimilarity(query, fieldValue);
          fieldScore += jaccardScore;
        }

        totalScore += fieldScore * weight;
      }

      return { doc, score: totalScore };
    });

    return scored
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.doc);
  }

  private applyFilters(documents: T[], filters: Record<string, unknown>): T[] {
    return documents.filter((doc) => {
      for (const [field, filterValue] of Object.entries(filters)) {
        const docValue = this.getFieldValue(doc, field);

        if (filterValue === null || filterValue === undefined) continue;

        // Array filter (OR logic)
        if (Array.isArray(filterValue)) {
          if (filterValue.length > 0 && !filterValue.includes(docValue)) {
            return false;
          }
          continue;
        }

        // Range filter
        if (typeof filterValue === 'object' && filterValue !== null) {
          const range = filterValue as { min?: number; max?: number };
          const numValue = typeof docValue === 'number' ? docValue : parseFloat(docValue as string);

          if (range.min !== undefined && numValue < range.min) return false;
          if (range.max !== undefined && numValue > range.max) return false;
          continue;
        }

        // Exact match
        if (docValue !== filterValue) {
          return false;
        }
      }

      return true;
    });
  }

  private calculateFacets(documents: T[], facetConfigs: FacetConfig[]): FacetResult[] {
    return facetConfigs.map((config) => {
      const counts = new Map<string, number>();

      for (const doc of documents) {
        const value = this.getFieldValue(doc, config.field);

        if (config.type === 'range' && config.ranges) {
          // Range facets
          const numValue = typeof value === 'number' ? value : parseFloat(value as string);
          for (const range of config.ranges) {
            if (numValue >= range.min && numValue < range.max) {
              const key = `${range.min}-${range.max}`;
              counts.set(key, (counts.get(key) || 0) + 1);
            }
          }
        } else if (config.type === 'date') {
          // Date facets (by month)
          const date = new Date(value as string);
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          counts.set(key, (counts.get(key) || 0) + 1);
        } else {
          // Value facets
          const key = String(value || 'Unknown');
          counts.set(key, (counts.get(key) || 0) + 1);
        }
      }

      const values = Array.from(counts.entries())
        .map(([value, count]) => {
          const label = config.type === 'range'
            ? config.ranges?.find((r) => `${r.min}-${r.max}` === value)?.label
            : undefined;
          return { value, count, label };
        })
        .sort((a, b) => b.count - a.count);

      return { field: config.field, values };
    });
  }

  private sortResults(documents: T[], sortBy: string, sortOrder: 'asc' | 'desc'): T[] {
    return [...documents].sort((a, b) => {
      const valueA = this.getFieldValue(a, sortBy);
      const valueB = this.getFieldValue(b, sortBy);

      let comparison = 0;

      if (typeof valueA === 'string' && typeof valueB === 'string') {
        comparison = valueA.localeCompare(valueB);
      } else if (typeof valueA === 'number' && typeof valueB === 'number') {
        comparison = valueA - valueB;
      } else if (valueA instanceof Date && valueB instanceof Date) {
        comparison = valueA.getTime() - valueB.getTime();
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }

  private getFieldValue(doc: T, field: string): unknown {
    const parts = field.split('.');
    let value: unknown = doc;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  private getDefaultFields(): SearchField[] {
    if (this.documents.length === 0) return [];

    const sample = this.documents[0];
    return Object.keys(sample)
      .filter((key) => typeof sample[key] === 'string')
      .map((name) => ({ name, weight: 1, fuzzy: true }));
  }

  /**
   * Highlight search matches in text
   */
  highlight(text: string, query: string): HighlightedField {
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();
    const matches: { start: number; end: number }[] = [];

    let index = 0;
    while ((index = textLower.indexOf(queryLower, index)) !== -1) {
      matches.push({ start: index, end: index + query.length });
      index += 1;
    }

    let highlighted = text;
    for (let i = matches.length - 1; i >= 0; i--) {
      const { start, end } = matches[i];
      highlighted =
        highlighted.slice(0, start) +
        `<mark>${highlighted.slice(start, end)}</mark>` +
        highlighted.slice(end);
    }

    return {
      field: '',
      original: text,
      highlighted,
      matches,
    };
  }

  /**
   * Get search suggestions based on partial query
   */
  getSuggestions(partialQuery: string, maxSuggestions: number = 5): string[] {
    if (!partialQuery.trim()) return [];

    const queryLower = partialQuery.toLowerCase();
    const suggestions = new Set<string>();

    for (const token of this.index.keys()) {
      if (token.startsWith(queryLower) || similarity(token, queryLower) > 0.7) {
        suggestions.add(token);
        if (suggestions.size >= maxSuggestions) break;
      }
    }

    return Array.from(suggestions);
  }
}

export { SearchEngine, similarity, levenshteinDistance, jaccardSimilarity };
