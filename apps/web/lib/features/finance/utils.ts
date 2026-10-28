/**
 * Finance Utility Functions
 * Professional-grade helpers for finance module
 */

import { Payment, OrderWithPayments, EmployeeLedgerEntry, LedgerEntryKind } from '@/lib/types/finance';
import { normalizeCurrencyInput } from '@/lib/utils/currency';
import { spreadsheetText } from '@/lib/security/spreadsheet-safe';

// ============================================
// Currency Formatting
// ============================================

export const CURRENCY_CONFIG: Record<string, { symbol: string; locale: string; position: 'before' | 'after' }> = {
  TRY: { symbol: '₺', locale: 'tr-TR', position: 'after' },
  USD: { symbol: '$', locale: 'en-US', position: 'before' },
  EUR: { symbol: '€', locale: 'de-DE', position: 'before' },
  GBP: { symbol: '£', locale: 'en-GB', position: 'before' },
};

export function formatFinanceCurrency(amount: number, currency: string = 'TRY'): string {
  const normalized = normalizeCurrencyInput(currency);
  const config = CURRENCY_CONFIG[normalized] || CURRENCY_CONFIG.TRY;
  
  const formatted = new Intl.NumberFormat(config.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return config.position === 'before' 
    ? `${config.symbol}${formatted}` 
    : `${formatted} ${config.symbol}`;
}

export function formatCompactCurrency(amount: number, currency: string = 'TRY'): string {
  const normalized = normalizeCurrencyInput(currency);
  const config = CURRENCY_CONFIG[normalized] || CURRENCY_CONFIG.TRY;
  
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M ${config.symbol}`;
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}K ${config.symbol}`;
  }
  return formatFinanceCurrency(amount, currency);
}

// ============================================
// Date Utilities
// ============================================

export function getMonthRange(date: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export function getQuarterRange(date: Date = new Date()): { start: Date; end: Date } {
  const quarter = Math.floor(date.getMonth() / 3);
  const start = new Date(date.getFullYear(), quarter * 3, 1);
  const end = new Date(date.getFullYear(), quarter * 3 + 3, 0, 23, 59, 59, 999);
  return { start, end };
}

export function getYearRange(date: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), 0, 1);
  const end = new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
  return { start, end };
}

export function formatDateRange(start: Date, end: Date): string {
  const startStr = start.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  const endStr = end.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${startStr} - ${endStr}`;
}

export function getRelativeTimeString(date: Date | string): string {
  const now = new Date();
  const target = typeof date === 'string' ? new Date(date) : date;
  const diffMs = now.getTime() - target.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Bugün';
  if (diffDays === 1) return 'Dün';
  if (diffDays < 7) return `${diffDays} gün önce`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} hafta önce`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} ay önce`;
  return `${Math.floor(diffDays / 365)} yıl önce`;
}

// ============================================
// Analytics & Calculations
// ============================================

export interface FinanceStats {
  totalRevenue: number;
  totalPayments: number;
  outstandingAmount: number;
  collectionRate: number;
  averageOrderValue: number;
  paymentCount: number;
}

export function calculateFinanceStats(orders: OrderWithPayments[]): FinanceStats {
  const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalPayments = orders.reduce((sum, o) => sum + o.paidAmount, 0);
  const outstandingAmount = orders.reduce((sum, o) => sum + Math.max(0, o.remainingAmount), 0);
  const collectionRate = totalRevenue > 0 ? (totalPayments / totalRevenue) * 100 : 0;
  const averageOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;
  const paymentCount = orders.filter(o => o.paidAmount > 0).length;

  return {
    totalRevenue,
    totalPayments,
    outstandingAmount,
    collectionRate,
    averageOrderValue,
    paymentCount,
  };
}

export interface PayrollStats {
  totalSalary: number;
  totalAdvance: number;
  totalDeductions: number;
  totalPayments: number;
  netCost: number;
  employeeCount: number;
}

export function calculatePayrollStats(entries: EmployeeLedgerEntry[]): PayrollStats {
  const stats: PayrollStats = {
    totalSalary: 0,
    totalAdvance: 0,
    totalDeductions: 0,
    totalPayments: 0,
    netCost: 0,
    employeeCount: new Set(entries.map(e => e.employeeId)).size,
  };

  entries.forEach(entry => {
    switch (entry.kind) {
      case 'salary':
        stats.totalSalary += entry.amount;
        break;
      case 'advance':
        stats.totalAdvance += entry.amount;
        break;
      case 'deduction':
        stats.totalDeductions += entry.amount;
        break;
      case 'payment':
        stats.totalPayments += entry.amount;
        break;
    }
  });

  stats.netCost = stats.totalSalary + stats.totalPayments;
  return stats;
}

// ============================================
// Grouping & Aggregation
// ============================================

export function groupPaymentsByMonth(payments: Payment[]): Map<string, Payment[]> {
  const groups = new Map<string, Payment[]>();
  
  payments.forEach(payment => {
    const date = new Date(payment.paidAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(payment);
  });

  return groups;
}

export function groupPaymentsByMethod(payments: Payment[]): Record<string, { count: number; total: number }> {
  const groups: Record<string, { count: number; total: number }> = {};
  
  payments.forEach(payment => {
    if (!groups[payment.method]) {
      groups[payment.method] = { count: 0, total: 0 };
    }
    groups[payment.method].count++;
    groups[payment.method].total += payment.amount;
  });

  return groups;
}

export interface MonthlyData {
  month: string;
  label: string;
  revenue: number;
  payments: number;
  outstanding: number;
}

export function getMonthlyTrend(payments: Payment[], months: number = 6): MonthlyData[] {
  const data: MonthlyData[] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' });
    
    const monthPayments = payments.filter(p => {
      const pDate = new Date(p.paidAt);
      return pDate.getFullYear() === date.getFullYear() && pDate.getMonth() === date.getMonth();
    });

    const totalPayments = monthPayments.reduce((sum, p) => sum + p.amount, 0);

    data.push({
      month: key,
      label,
      revenue: 0, // Would need orders data
      payments: totalPayments,
      outstanding: 0, // Would need orders data
    });
  }

  return data;
}

// ============================================
// Validation
// ============================================

export function validatePaymentAmount(amount: number, maxAmount?: number): { valid: boolean; error?: string } {
  if (isNaN(amount) || amount <= 0) {
    return { valid: false, error: 'Tutar pozitif bir sayı olmalıdır' };
  }
  if (maxAmount !== undefined && amount > maxAmount) {
    return { valid: false, error: `Tutar kalan borçtan (${formatFinanceCurrency(maxAmount)}) fazla olamaz` };
  }
  if (amount > 999999999) {
    return { valid: false, error: 'Tutar çok yüksek' };
  }
  return { valid: true };
}

export function validateEntryDate(date: string): { valid: boolean; error?: string } {
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) {
    return { valid: false, error: 'Geçersiz tarih formatı' };
  }
  
  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const oneMonthAhead = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
  
  if (parsed < oneYearAgo) {
    return { valid: false, error: 'Tarih 1 yıldan eski olamaz' };
  }
  if (parsed > oneMonthAhead) {
    return { valid: false, error: 'Tarih 1 aydan ileri olamaz' };
  }
  
  return { valid: true };
}

// ============================================
// Export Helpers
// ============================================

export function generateCSVContent(
  data: Record<string, unknown>[],
  columns: { key: string; label: string }[]
): string {
  const header = columns.map(c => c.label).join(',');
  const rows = data.map(row => 
    columns.map(c => {
      // Formula-looking text is neutralised for spreadsheets; numbers stay numbers; RFC 4180 quoting.
      const text = spreadsheetText(row[c.key]);
      return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    }).join(',')
  );
  
  return [header, ...rows].join('\n');
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============================================
// Status Helpers
// ============================================

export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'overpaid';

export function getPaymentStatus(totalAmount: number, paidAmount: number): PaymentStatus {
  if (paidAmount <= 0) return 'unpaid';
  if (paidAmount < totalAmount) return 'partial';
  if (paidAmount === totalAmount) return 'paid';
  return 'overpaid';
}

export const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { label: string; color: string; bgColor: string }> = {
  unpaid: { label: 'Ödenmedi', color: 'text-red-600', bgColor: 'bg-red-50 dark:bg-red-900/20' },
  partial: { label: 'Kısmi Ödeme', color: 'text-orange-600', bgColor: 'bg-orange-50 dark:bg-orange-900/20' },
  paid: { label: 'Tamamlandı', color: 'text-green-600', bgColor: 'bg-green-50 dark:bg-green-900/20' },
  overpaid: { label: 'Fazla Ödeme', color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-900/20' },
};
