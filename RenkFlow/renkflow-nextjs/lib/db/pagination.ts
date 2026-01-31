/**
 * Database Pagination Utilities
 * 
 * Provides efficient pagination for large datasets
 * Supports both offset-based and cursor-based pagination
 */

// ============================================
// Types
// ============================================

export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    nextCursor?: string;
    prevCursor?: string;
  };
}

export interface CursorPaginatedResult<T> {
  data: T[];
  pagination: {
    limit: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    nextCursor: string | null;
    prevCursor: string | null;
    total?: number;
  };
}

// ============================================
// Constants
// ============================================

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

// ============================================
// Offset-based Pagination
// ============================================

export function parsePaginationParams(params: PaginationParams): {
  page: number;
  limit: number;
  offset: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
} {
  const page = Math.max(1, params.page || DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit || DEFAULT_LIMIT));
  const offset = (page - 1) * limit;
  const sortBy = params.sortBy || 'created_at';
  const sortOrder = params.sortOrder || 'desc';

  return { page, limit, offset, sortBy, sortOrder };
}

export function createPaginatedResult<T>(
  data: T[],
  total: number,
  params: { page: number; limit: number }
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / params.limit);

  return {
    data,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages,
      hasNextPage: params.page < totalPages,
      hasPrevPage: params.page > 1,
    },
  };
}

// ============================================
// Cursor-based Pagination
// ============================================

export interface CursorData {
  id: string;
  sortValue: string | number | Date;
  direction: 'next' | 'prev';
}

export function encodeCursor(data: CursorData): string {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

export function decodeCursor(cursor: string): CursorData | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    return JSON.parse(decoded) as CursorData;
  } catch {
    return null;
  }
}

export function createCursorPaginatedResult<T extends { id: string }>(
  data: T[],
  params: { limit: number; cursor?: string },
  getSortValue: (item: T) => string | number | Date,
  total?: number
): CursorPaginatedResult<T> {
  const hasNextPage = data.length > params.limit;
  const items = hasNextPage ? data.slice(0, params.limit) : data;

  let nextCursor: string | null = null;
  let prevCursor: string | null = null;

  if (items.length > 0) {
    const lastItem = items[items.length - 1];
    const firstItem = items[0];

    if (hasNextPage) {
      nextCursor = encodeCursor({
        id: lastItem.id,
        sortValue: getSortValue(lastItem),
        direction: 'next',
      });
    }

    if (params.cursor) {
      prevCursor = encodeCursor({
        id: firstItem.id,
        sortValue: getSortValue(firstItem),
        direction: 'prev',
      });
    }
  }

  return {
    data: items,
    pagination: {
      limit: params.limit,
      hasNextPage,
      hasPrevPage: !!params.cursor,
      nextCursor,
      prevCursor,
      total,
    },
  };
}

// ============================================
// SQL Builders
// ============================================

export function buildPaginationSQL(params: {
  limit: number;
  offset: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}): string {
  const { limit, offset, sortBy, sortOrder } = params;
  const safeColumn = sanitizeColumnName(sortBy);
  
  return `ORDER BY ${safeColumn} ${sortOrder.toUpperCase()} LIMIT ${limit} OFFSET ${offset}`;
}

export function buildCursorSQL(
  cursor: CursorData | null,
  sortColumn: string,
  sortOrder: 'asc' | 'desc'
): { whereClause: string; params: unknown[] } {
  if (!cursor) {
    return { whereClause: '', params: [] };
  }

  const safeColumn = sanitizeColumnName(sortColumn);
  const operator = cursor.direction === 'next'
    ? (sortOrder === 'desc' ? '<' : '>')
    : (sortOrder === 'desc' ? '>' : '<');

  return {
    whereClause: `AND (${safeColumn}, id) ${operator} ($1, $2)`,
    params: [cursor.sortValue, cursor.id],
  };
}

function sanitizeColumnName(column: string): string {
  // Only allow alphanumeric and underscore
  return column.replace(/[^a-zA-Z0-9_]/g, '');
}

// ============================================
// React Query Key Helpers
// ============================================

export function getPaginationQueryKey(
  base: string,
  params: PaginationParams
): (string | number | undefined)[] {
  return [
    base,
    params.page,
    params.limit,
    params.cursor,
    params.sortBy,
    params.sortOrder,
  ];
}
