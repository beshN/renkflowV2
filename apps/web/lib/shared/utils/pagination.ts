/**
 * Enterprise Pagination & Filtering System
 * Type-safe pagination with dynamic SQL filter builder
 */

import { z } from 'zod';

// ============================================
// Types & Schemas
// ============================================

export const PaginationParamsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationParams = z.infer<typeof PaginationParamsSchema>;

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  nextPage: number | null;
  prevPage: number | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface FilterCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in' | 'between' | 'isNull' | 'isNotNull';
  value: unknown;
  secondValue?: unknown; // For 'between' operator
}

export interface SortCondition {
  field: string;
  order: 'asc' | 'desc';
}

// ============================================
// Pagination Helper Class
// ============================================

export class PaginationHelper {
  private page: number;
  private limit: number;
  private sortBy?: string;
  private sortOrder: 'asc' | 'desc';
  private allowedSortFields: string[];

  constructor(
    params: Partial<PaginationParams> = {},
    allowedSortFields: string[] = []
  ) {
    const validated = PaginationParamsSchema.parse(params);
    this.page = validated.page;
    this.limit = validated.limit;
    this.sortBy = validated.sortBy;
    this.sortOrder = validated.sortOrder;
    this.allowedSortFields = allowedSortFields;
  }

  get offset(): number {
    return (this.page - 1) * this.limit;
  }

  get pageLimit(): number {
    return this.limit;
  }

  /**
   * Get SQL ORDER BY clause
   */
  getOrderByClause(defaultField: string = 'created_at'): string {
    const field = this.sortBy && this.allowedSortFields.includes(this.sortBy)
      ? this.sortBy
      : defaultField;
    
    return `ORDER BY ${field} ${this.sortOrder.toUpperCase()}`;
  }

  /**
   * Get SQL LIMIT OFFSET clause
   */
  getLimitOffsetClause(): string {
    return `LIMIT ${this.limit} OFFSET ${this.offset}`;
  }

  /**
   * Create pagination metadata from total count
   */
  createMeta(total: number): PaginationMeta {
    const totalPages = Math.ceil(total / this.limit);
    
    return {
      page: this.page,
      limit: this.limit,
      total,
      totalPages,
      hasNextPage: this.page < totalPages,
      hasPrevPage: this.page > 1,
      nextPage: this.page < totalPages ? this.page + 1 : null,
      prevPage: this.page > 1 ? this.page - 1 : null,
    };
  }

  /**
   * Create paginated response
   */
  createResponse<T>(data: T[], total: number): PaginatedResponse<T> {
    return {
      data,
      meta: this.createMeta(total),
    };
  }

  /**
   * Parse pagination params from URL search params
   */
  static fromSearchParams(
    searchParams: URLSearchParams,
    allowedSortFields: string[] = []
  ): PaginationHelper {
    return new PaginationHelper(
      {
        page: parseInt(searchParams.get('page') || '1', 10),
        limit: parseInt(searchParams.get('limit') || '20', 10),
        sortBy: searchParams.get('sortBy') || undefined,
        sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
      },
      allowedSortFields
    );
  }
}

// ============================================
// Dynamic Filter Builder
// ============================================

export class FilterBuilder {
  private conditions: string[] = [];
  private params: unknown[] = [];
  private paramIndex: number;
  private baseParamIndex: number;

  constructor(startParamIndex: number = 1) {
    this.paramIndex = startParamIndex;
    this.baseParamIndex = startParamIndex;
  }

  /**
   * Add a filter condition
   */
  add(condition: FilterCondition): this {
    const sql = this.buildCondition(condition);
    if (sql) {
      this.conditions.push(sql);
    }
    return this;
  }

  /**
   * Add condition only if value is truthy
   */
  addIf(condition: FilterCondition | null | undefined): this {
    if (condition && condition.value !== undefined && condition.value !== null && condition.value !== '') {
      return this.add(condition);
    }
    return this;
  }

  /**
   * Add equality condition
   */
  eq(field: string, value: unknown): this {
    return this.add({ field, operator: 'eq', value });
  }

  /**
   * Add equality condition if value exists
   */
  eqIf(field: string, value: unknown): this {
    if (value !== undefined && value !== null && value !== '') {
      return this.eq(field, value);
    }
    return this;
  }

  /**
   * Add LIKE condition (case-sensitive)
   */
  like(field: string, value: string): this {
    return this.add({ field, operator: 'like', value: `%${value}%` });
  }

  /**
   * Add ILIKE condition (case-insensitive)
   */
  ilike(field: string, value: string): this {
    return this.add({ field, operator: 'ilike', value: `%${value}%` });
  }

  /**
   * Add ILIKE condition if value exists
   */
  ilikeIf(field: string, value: string | undefined | null): this {
    if (value && value.trim()) {
      return this.ilike(field, value.trim());
    }
    return this;
  }

  /**
   * Add IN condition
   */
  in(field: string, values: unknown[]): this {
    if (values.length > 0) {
      return this.add({ field, operator: 'in', value: values });
    }
    return this;
  }

  /**
   * Add date range condition
   */
  dateRange(field: string, startDate?: string, endDate?: string): this {
    if (startDate) {
      this.add({ field, operator: 'gte', value: startDate });
    }
    if (endDate) {
      this.add({ field, operator: 'lte', value: endDate });
    }
    return this;
  }

  /**
   * Add BETWEEN condition
   */
  between(field: string, min: unknown, max: unknown): this {
    return this.add({ field, operator: 'between', value: min, secondValue: max });
  }

  /**
   * Add IS NULL condition
   */
  isNull(field: string): this {
    return this.add({ field, operator: 'isNull', value: null });
  }

  /**
   * Add IS NOT NULL condition
   */
  isNotNull(field: string): this {
    return this.add({ field, operator: 'isNotNull', value: null });
  }

  /**
   * Build SQL condition string
   */
  private buildCondition(condition: FilterCondition): string | null {
    const { field, operator, value, secondValue } = condition;

    // Sanitize field name (prevent SQL injection)
    const safeField = field.replace(/[^a-zA-Z0-9_]/g, '');

    switch (operator) {
      case 'eq':
        this.params.push(value);
        return `${safeField} = $${this.paramIndex++}`;

      case 'neq':
        this.params.push(value);
        return `${safeField} != $${this.paramIndex++}`;

      case 'gt':
        this.params.push(value);
        return `${safeField} > $${this.paramIndex++}`;

      case 'gte':
        this.params.push(value);
        return `${safeField} >= $${this.paramIndex++}`;

      case 'lt':
        this.params.push(value);
        return `${safeField} < $${this.paramIndex++}`;

      case 'lte':
        this.params.push(value);
        return `${safeField} <= $${this.paramIndex++}`;

      case 'like':
        this.params.push(value);
        return `${safeField} LIKE $${this.paramIndex++}`;

      case 'ilike':
        this.params.push(value);
        return `${safeField} ILIKE $${this.paramIndex++}`;

      case 'in':
        if (Array.isArray(value) && value.length > 0) {
          const placeholders = value.map(() => `$${this.paramIndex++}`).join(', ');
          this.params.push(...value);
          return `${safeField} IN (${placeholders})`;
        }
        return null;

      case 'between':
        this.params.push(value, secondValue);
        return `${safeField} BETWEEN $${this.paramIndex++} AND $${this.paramIndex++}`;

      case 'isNull':
        return `${safeField} IS NULL`;

      case 'isNotNull':
        return `${safeField} IS NOT NULL`;

      default:
        return null;
    }
  }

  /**
   * Get WHERE clause (without 'WHERE' keyword)
   */
  getWhereClause(): string {
    if (this.conditions.length === 0) {
      return '1=1';
    }
    return this.conditions.join(' AND ');
  }

  /**
   * Get full WHERE clause (with 'WHERE' keyword)
   */
  getFullWhereClause(): string {
    return `WHERE ${this.getWhereClause()}`;
  }

  /**
   * Get parameters array
   */
  getParams(): unknown[] {
    return this.params;
  }

  /**
   * Get current parameter index
   */
  getCurrentParamIndex(): number {
    return this.paramIndex;
  }

  /**
   * Check if any conditions were added
   */
  hasConditions(): boolean {
    return this.conditions.length > 0;
  }

  /**
   * Reset builder
   */
  reset(): this {
    this.conditions = [];
    this.params = [];
    this.paramIndex = this.baseParamIndex;
    return this;
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Create URL search params from pagination
 */
export function createPaginationSearchParams(
  params: Partial<PaginationParams>
): URLSearchParams {
  const searchParams = new URLSearchParams();
  
  if (params.page) searchParams.set('page', params.page.toString());
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);
  
  return searchParams;
}

/**
 * Calculate offset from page number
 */
export function calculateOffset(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

/**
 * Calculate total pages from total items
 */
export function calculateTotalPages(total: number, limit: number): number {
  return Math.ceil(total / limit);
}

/**
 * Validate page number
 */
export function validatePage(page: number, totalPages: number): number {
  return Math.max(1, Math.min(page, totalPages || 1));
}
