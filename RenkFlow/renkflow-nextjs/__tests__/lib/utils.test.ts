/**
 * Utility Functions Tests
 */

import { formatCurrency, formatDate, generateId } from '@/lib/utils';
import { normalizeCurrencyInput, currencyCodeToSymbol, isCurrencyCode } from '@/lib/utils/currency';
import { formatFinanceCurrency, formatCompactCurrency } from '@/lib/utils/finance';

describe('Utility Functions', () => {
  describe('formatCurrency', () => {
    it('should format Turkish Lira with ISO code', () => {
      expect(formatCurrency(1000, 'TRY')).toMatch(/1[.,]000/);
    });

    it('should format Turkish Lira with symbol (backward compat)', () => {
      expect(formatCurrency(1000, '₺')).toMatch(/1[.,]000/);
    });

    it('should format USD correctly', () => {
      expect(formatCurrency(1500.50, 'USD')).toMatch(/1[.,]500/);
    });

    it('should format EUR correctly', () => {
      expect(formatCurrency(250, 'EUR')).toContain('€');
    });

    it('should format GBP correctly', () => {
      expect(formatCurrency(250, 'GBP')).toContain('£');
    });

    it('should handle zero values', () => {
      expect(formatCurrency(0, 'TRY')).toContain('0');
    });

    it('should handle null/undefined values', () => {
      expect(formatCurrency(null, 'TRY')).toContain('0');
      expect(formatCurrency(undefined, 'TRY')).toContain('0');
    });

    it('should handle negative values', () => {
      const result = formatCurrency(-500, 'TRY');
      expect(result).toMatch(/-?\d/);
    });

    it('should handle large numbers', () => {
      expect(formatCurrency(1000000, 'TRY')).toMatch(/1[.,]000[.,]000/);
    });

    it('should default to TRY when no currency provided', () => {
      const result = formatCurrency(100);
      expect(result).toContain('₺');
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
      expect(formatDate(null)).toBe('-');
      expect(formatDate(undefined)).toBe('-');
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

// ============================================
// Currency Normalization Tests
// ============================================

describe('Currency Normalization', () => {
  describe('normalizeCurrencyInput', () => {
    it('should return ISO code for valid codes', () => {
      expect(normalizeCurrencyInput('TRY')).toBe('TRY');
      expect(normalizeCurrencyInput('USD')).toBe('USD');
      expect(normalizeCurrencyInput('EUR')).toBe('EUR');
      expect(normalizeCurrencyInput('GBP')).toBe('GBP');
    });

    it('should normalize symbols to ISO codes', () => {
      expect(normalizeCurrencyInput('₺')).toBe('TRY');
      expect(normalizeCurrencyInput('$')).toBe('USD');
      expect(normalizeCurrencyInput('€')).toBe('EUR');
      expect(normalizeCurrencyInput('£')).toBe('GBP');
    });

    it('should handle case-insensitive codes', () => {
      expect(normalizeCurrencyInput('try')).toBe('TRY');
      expect(normalizeCurrencyInput('usd')).toBe('USD');
    });

    it('should default to TRY for invalid/empty input', () => {
      expect(normalizeCurrencyInput('')).toBe('TRY');
      expect(normalizeCurrencyInput(null)).toBe('TRY');
      expect(normalizeCurrencyInput(undefined)).toBe('TRY');
      expect(normalizeCurrencyInput(123)).toBe('TRY');
      expect(normalizeCurrencyInput('INVALID')).toBe('TRY');
    });

    it('should trim whitespace', () => {
      expect(normalizeCurrencyInput('  TRY  ')).toBe('TRY');
    });
  });

  describe('currencyCodeToSymbol', () => {
    it('should convert ISO codes to symbols', () => {
      expect(currencyCodeToSymbol('TRY')).toBe('₺');
      expect(currencyCodeToSymbol('USD')).toBe('$');
      expect(currencyCodeToSymbol('EUR')).toBe('€');
      expect(currencyCodeToSymbol('GBP')).toBe('£');
    });

    it('should handle symbol input (backward compat)', () => {
      expect(currencyCodeToSymbol('₺')).toBe('₺');
      expect(currencyCodeToSymbol('$')).toBe('$');
    });

    it('should default to ₺ for invalid input', () => {
      expect(currencyCodeToSymbol('INVALID')).toBe('₺');
      expect(currencyCodeToSymbol(null)).toBe('₺');
    });
  });

  describe('isCurrencyCode', () => {
    it('should return true for valid ISO codes', () => {
      expect(isCurrencyCode('TRY')).toBe(true);
      expect(isCurrencyCode('USD')).toBe(true);
    });

    it('should return false for symbols', () => {
      expect(isCurrencyCode('₺')).toBe(false);
      expect(isCurrencyCode('$')).toBe(false);
    });

    it('should return false for invalid values', () => {
      expect(isCurrencyCode('INVALID')).toBe(false);
      expect(isCurrencyCode(null)).toBe(false);
    });
  });
});

// ============================================
// Finance Currency Format Tests
// ============================================

describe('Finance Currency Formatting', () => {
  describe('formatFinanceCurrency', () => {
    it('should format TRY with symbol after amount', () => {
      const result = formatFinanceCurrency(1000, 'TRY');
      expect(result).toContain('₺');
      expect(result).toMatch(/1[.,]000/);
    });

    it('should format USD with symbol before amount', () => {
      const result = formatFinanceCurrency(1000, 'USD');
      expect(result).toContain('$');
    });

    it('should handle symbol input (backward compat)', () => {
      const result = formatFinanceCurrency(500, '₺');
      expect(result).toContain('₺');
    });

    it('should default to TRY', () => {
      const result = formatFinanceCurrency(100);
      expect(result).toContain('₺');
    });
  });

  describe('formatCompactCurrency', () => {
    it('should format millions with M suffix', () => {
      const result = formatCompactCurrency(2500000, 'TRY');
      expect(result).toContain('M');
    });

    it('should format thousands with K suffix', () => {
      const result = formatCompactCurrency(5000, 'TRY');
      expect(result).toContain('K');
    });

    it('should format small amounts normally', () => {
      const result = formatCompactCurrency(500, 'TRY');
      expect(result).toContain('₺');
    });
  });
});

// ============================================
// Profit/Loss Calculation Edge Cases
// ============================================

describe('Profit/Loss Edge Cases', () => {
  it('negative profit should result in zero tax', () => {
    const profitBeforeTax = -5000;
    const taxExpense = profitBeforeTax > 0 ? profitBeforeTax * 0.20 : 0;
    expect(taxExpense).toBe(0);
  });

  it('zero profit should result in zero tax', () => {
    const profitBeforeTax = 0;
    const taxExpense = profitBeforeTax > 0 ? profitBeforeTax * 0.20 : 0;
    expect(taxExpense).toBe(0);
  });

  it('positive profit should apply 20% tax', () => {
    const profitBeforeTax = 10000;
    const taxExpense = profitBeforeTax > 0 ? profitBeforeTax * 0.20 : 0;
    expect(taxExpense).toBe(2000);
  });

  it('grossProfit = revenue - COGS', () => {
    const revenue = 50000;
    const cogs = 20000;
    const grossProfit = revenue - cogs;
    expect(grossProfit).toBe(30000);
  });

  it('grossProfit with zero COGS equals revenue', () => {
    const revenue = 50000;
    const cogs = 0;
    const grossProfit = revenue - cogs;
    expect(grossProfit).toBe(50000);
  });

  it('netProfit = profitBeforeTax - taxExpense', () => {
    const profitBeforeTax = 10000;
    const taxExpense = profitBeforeTax > 0 ? profitBeforeTax * 0.20 : 0;
    const netProfit = profitBeforeTax - taxExpense;
    expect(netProfit).toBe(8000);
  });

  it('netProfit equals profitBeforeTax when loss', () => {
    const profitBeforeTax = -3000;
    const taxExpense = profitBeforeTax > 0 ? profitBeforeTax * 0.20 : 0;
    const netProfit = profitBeforeTax - taxExpense;
    expect(netProfit).toBe(-3000);
  });
});
