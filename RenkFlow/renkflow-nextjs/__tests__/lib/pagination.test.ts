/**
 * Pagination Utilities Tests
 */

import {
  parsePaginationParams,
  createPaginatedResult,
  encodeCursor,
  decodeCursor,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '@/lib/db/pagination';

describe('Pagination Utilities', () => {
  describe('parsePaginationParams', () => {
    it('should use defaults when no params provided', () => {
      const result = parsePaginationParams({});

      expect(result.page).toBe(DEFAULT_PAGE);
      expect(result.limit).toBe(DEFAULT_LIMIT);
      expect(result.offset).toBe(0);
    });

    it('should parse valid page and limit', () => {
      const result = parsePaginationParams({ page: 3, limit: 50 });

      expect(result.page).toBe(3);
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(100);
    });

    it('should enforce minimum page of 1', () => {
      const result = parsePaginationParams({ page: -5 });
      expect(result.page).toBe(1);
    });

    it('should enforce maximum limit', () => {
      const result = parsePaginationParams({ limit: 500 });
      expect(result.limit).toBe(MAX_LIMIT);
    });

    it('should calculate correct offset', () => {
      const result = parsePaginationParams({ page: 5, limit: 20 });
      expect(result.offset).toBe(80);
    });
  });

  describe('createPaginatedResult', () => {
    const mockData = [{ id: '1' }, { id: '2' }, { id: '3' }];

    it('should create paginated result with correct structure', () => {
      const result = createPaginatedResult(mockData, 100, { page: 1, limit: 20 });

      expect(result.data).toEqual(mockData);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.total).toBe(100);
      expect(result.pagination.totalPages).toBe(5);
    });

    it('should calculate hasNextPage correctly', () => {
      const result1 = createPaginatedResult(mockData, 100, { page: 1, limit: 20 });
      expect(result1.pagination.hasNextPage).toBe(true);

      const result2 = createPaginatedResult(mockData, 100, { page: 5, limit: 20 });
      expect(result2.pagination.hasNextPage).toBe(false);
    });

    it('should calculate hasPrevPage correctly', () => {
      const result1 = createPaginatedResult(mockData, 100, { page: 1, limit: 20 });
      expect(result1.pagination.hasPrevPage).toBe(false);

      const result2 = createPaginatedResult(mockData, 100, { page: 2, limit: 20 });
      expect(result2.pagination.hasPrevPage).toBe(true);
    });
  });

  describe('Cursor Encoding/Decoding', () => {
    it('should encode and decode cursor correctly', () => {
      const original = {
        id: 'test-id-123',
        sortValue: '2024-01-15',
        direction: 'next' as const,
      };

      const encoded = encodeCursor(original);
      const decoded = decodeCursor(encoded);

      expect(decoded).toEqual(original);
    });

    it('should return null for invalid cursor', () => {
      const result = decodeCursor('invalid-cursor');
      expect(result).toBeNull();
    });

    it('should handle numeric sort values', () => {
      const original = {
        id: 'test-id',
        sortValue: 12345,
        direction: 'prev' as const,
      };

      const encoded = encodeCursor(original);
      const decoded = decodeCursor(encoded);

      expect(decoded?.sortValue).toBe(12345);
    });
  });
});
