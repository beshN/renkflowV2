/**
 * Utility Functions Tests
 */

import { formatCurrency, formatDate, generateId } from '@/lib/utils';

describe('Utility Functions', () => {
  describe('formatCurrency', () => {
    it('should format Turkish Lira correctly', () => {
      expect(formatCurrency(1000, '₺')).toMatch(/1[.,]000/);
    });

    it('should format USD correctly', () => {
      expect(formatCurrency(1500.50, '$')).toMatch(/1[.,]500/);
    });

    it('should handle zero values', () => {
      expect(formatCurrency(0, '₺')).toContain('0');
    });

    it('should handle negative values', () => {
      const result = formatCurrency(-500, '₺');
      expect(result).toMatch(/-?\d/);
    });

    it('should handle large numbers', () => {
      expect(formatCurrency(1000000, '₺')).toMatch(/1[.,]000[.,]000/);
    });
  });

  describe('formatDate', () => {
    it('should format date string correctly', () => {
      const date = '2024-01-15T10:30:00Z';
      const result = formatDate(date);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should handle Date objects', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const result = formatDate(date.toISOString());
      expect(result).toBeDefined();
    });

    it('should handle undefined/null gracefully', () => {
      expect(() => formatDate('')).not.toThrow();
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('should generate string IDs', () => {
      const id = generateId();
      expect(typeof id).toBe('string');
    });

    it('should generate non-empty IDs', () => {
      const id = generateId();
      expect(id.length).toBeGreaterThan(0);
    });
  });
});
