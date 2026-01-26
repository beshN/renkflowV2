import { formatCurrency, formatDate, getOrderStatusInfo } from './utils';

describe('Utility Functions', () => {
  describe('formatCurrency', () => {
    it('formats number correctly with default currency', () => {
      // Note: This assumes the environment supports tr-TR locale correctly
      // expected: "₺1.234,56"
      const result = formatCurrency(1234.56);
      // Replace non-breaking spaces if any, just in case
      expect(result.replace(/\u00A0/g, ' ')).toBe('₺1.234,56');
    });

    it('handles null or undefined', () => {
      expect(formatCurrency(null)).toBe('₺0,00');
      expect(formatCurrency(undefined)).toBe('₺0,00');
    });

    it('uses custom currency symbol', () => {
      expect(formatCurrency(100, '$').replace(/\u00A0/g, ' ')).toBe('$100,00');
    });
  });

  describe('formatDate', () => {
    it('formats valid date string', () => {
      // 2023-01-01T00:00:00 might be shifted by timezone.
      // Use a safe mid-day time or just verify it contains the month.
      const result = formatDate('2023-01-01T12:00:00');
      expect(result).toBe('1 Ocak 2023');
    });

    it('returns hyphen for empty input', () => {
      expect(formatDate(null)).toBe('-');
      expect(formatDate(undefined)).toBe('-');
      expect(formatDate('')).toBe('-');
    });

    it('returns hyphen for invalid date', () => {
        expect(formatDate('invalid-date')).toBe('-');
    });
  });

  describe('getOrderStatusInfo', () => {
    it('returns correct info for pending', () => {
      const info = getOrderStatusInfo('pending');
      expect(info.label).toBe('Beklemede');
      expect(info.color).toContain('text-yellow');
    });

    it('returns correct info for in_production', () => {
      const info = getOrderStatusInfo('in_production');
      expect(info.label).toBe('Üretimde');
    });

    it('returns correct info for delivered', () => {
      const info = getOrderStatusInfo('delivered');
      expect(info.label).toBe('Teslim Edildi');
    });

    it('defaults to pending for unknown status', () => {
      const info = getOrderStatusInfo('unknown_status');
      expect(info.label).toBe('Beklemede');
    });
  });
});
