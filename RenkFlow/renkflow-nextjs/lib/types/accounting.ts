/**
 * Advanced Accounting Types
 * Detaylı muhasebe ve finans yönetimi için tip tanımlamaları
 */

import { z } from 'zod';
import { CurrencySchema as CurrencyNormalized } from './currency';

// ============================================
// Account Types (Hesap Planı)
// ============================================

export const AccountTypeSchema = z.enum([
  'asset',      // Varlık (Aktif)
  'liability',  // Borç (Pasif)
  'equity',     // Öz sermaye
  'revenue',    // Gelir
  'expense',    // Gider
]);

export const AccountCodeSchema = z.string().regex(/^\d{3,6}$/);

export const AccountSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  code: AccountCodeSchema,
  name: z.string().min(1),
  type: AccountTypeSchema,
  parentId: z.string().uuid().optional(), // Ana hesap ilişkisi
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  isBankAccount: z.boolean().default(false),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  currency: CurrencyNormalized.default('TRY'),
  openingBalance: z.number().default(0),
  currentBalance: z.number().default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// ============================================
// Journal Entries (Yevmiye Kayıtları)
// ============================================

export const JournalEntryTypeSchema = z.enum([
  'invoice',      // Fatura
  'payment',      // Ödeme
  'expense',      // Gider
  'salary',       // Maaş
  'adjustment',   // Düzeltme
  'opening',      // Açılış
  'closing',      // Kapanış
  'transfer',     // Transfer
]);

export const JournalEntryLineSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  accountCode: z.string(),
  accountName: z.string(),
  debit: z.number().min(0).default(0),
  credit: z.number().min(0).default(0),
  description: z.string().optional(),
  orderId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
});

export const JournalEntrySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  entryNumber: z.string(), // Otomatik oluşturulan yevmiye numarası
  date: z.string().datetime(),
  type: JournalEntryTypeSchema,
  description: z.string(),
  lines: z.array(JournalEntryLineSchema).min(2), // En az 2 satır (borç/alacak)
  totalDebit: z.number(),
  totalCredit: z.number(),
  isBalanced: z.boolean(), // Borç = Alacak kontrolü
  createdBy: z.string().uuid(),
  createdByName: z.string(),
  attachments: z.array(z.string()).optional(), // Ek dosyalar
  period: z.string(), // YYYY-MM formatında dönem
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// ============================================
// Tax Management (Vergi Yönetimi)
// ============================================

export const TaxTypeSchema = z.enum([
  'vat',          // KDV
  'withholding',  // Stopaj
  'corporate',    // Kurumlar vergisi
  'income',       // Gelir vergisi
  'stamp',        // Damga vergisi
]);

export const VatRateSchema = z.enum(['0', '1', '8', '10', '18', '20']);

export const TaxRateSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  type: TaxTypeSchema,
  name: z.string(),
  rate: z.number(), // Yüzde olarak (18 = %18)
  applicableFrom: z.string().datetime(),
  applicableTo: z.string().datetime().optional(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const TaxTransactionSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  taxType: TaxTypeSchema,
  rate: z.number(),
  baseAmount: z.number(), // Vergiye tabi tutar
  taxAmount: z.number(),  // Hesaplanan vergi
  totalAmount: z.number(), // Toplam tutar
  description: z.string(),
  relatedOrderId: z.string().uuid().optional(),
  relatedInvoiceId: z.string().uuid().optional(),
  period: z.string(), // YYYY-MM
  isDeclared: z.boolean().default(false), // Beyan edildi mi
  declarationDate: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
});

// ============================================
// Multi-Currency Support
// ============================================

export const CurrencyCodeSchema = z.enum(['TRY', 'USD', 'EUR', 'GBP']);

export const ExchangeRateSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  fromCurrency: CurrencyCodeSchema,
  toCurrency: CurrencyCodeSchema,
  rate: z.number().positive(),
  date: z.string().datetime(),
  source: z.string().optional(), // TCMB, ECB, vb.
  isManual: z.boolean().default(false),
  createdAt: z.string().datetime(),
});

export const MultiCurrencyTransactionSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  amount: z.number(),
  currency: CurrencyCodeSchema,
  exchangeRate: z.number(),
  amountInTRY: z.number(),
  description: z.string(),
  transactionDate: z.string().datetime(),
  createdAt: z.string().datetime(),
});

// ============================================
// Advanced Reports
// ============================================

export const ReportPeriodSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  period: z.string(), // YYYY-MM veya YYYY-QQ
});

// Kâr-Zarar Tablosu
export const ProfitLossReportSchema = z.object({
  period: ReportPeriodSchema,
  revenue: z.object({
    grossRevenue: z.number(),
    discounts: z.number(),
    returns: z.number(),
    netRevenue: z.number(),
  }),
  costOfGoodsSold: z.number(),
  grossProfit: z.number(),
  operatingExpenses: z.object({
    salaries: z.number(),
    rent: z.number(),
    utilities: z.number(),
    marketing: z.number(),
    depreciation: z.number(),
    other: z.number(),
    total: z.number(),
  }),
  operatingProfit: z.number(),
  financialIncome: z.number(),
  financialExpenses: z.number(),
  profitBeforeTax: z.number(),
  taxExpense: z.number(),
  netProfit: z.number(),
  warnings: z.array(z.string()).optional(),
});

// Bilanço
export const BalanceSheetSchema = z.object({
  asOfDate: z.string().datetime(),
  assets: z.object({
    currentAssets: z.object({
      cash: z.number(),
      bankAccounts: z.number(),
      accountsReceivable: z.number(),
      inventory: z.number(),
      prepaidExpenses: z.number(),
      total: z.number(),
    }),
    nonCurrentAssets: z.object({
      propertyPlantEquipment: z.number(),
      intangibleAssets: z.number(),
      longTermInvestments: z.number(),
      total: z.number(),
    }),
    totalAssets: z.number(),
  }),
  liabilities: z.object({
    currentLiabilities: z.object({
      accountsPayable: z.number(),
      shortTermDebt: z.number(),
      accruedExpenses: z.number(),
      taxesPayable: z.number(),
      total: z.number(),
    }),
    nonCurrentLiabilities: z.object({
      longTermDebt: z.number(),
      deferredTax: z.number(),
      total: z.number(),
    }),
    totalLiabilities: z.number(),
  }),
  equity: z.object({
    shareCapital: z.number(),
    retainedEarnings: z.number(),
    currentYearProfit: z.number(),
    totalEquity: z.number(),
  }),
  warnings: z.array(z.string()).optional(),
});

// Nakit Akış Tablosu
export const CashFlowReportSchema = z.object({
  period: ReportPeriodSchema,
  operatingActivities: z.object({
    netProfit: z.number(),
    depreciation: z.number(),
    changesInReceivables: z.number(),
    changesInInventory: z.number(),
    changesInPayables: z.number(),
    netOperatingCashFlow: z.number(),
  }),
  investingActivities: z.object({
    purchaseOfAssets: z.number(),
    saleOfAssets: z.number(),
    investments: z.number(),
    netInvestingCashFlow: z.number(),
  }),
  financingActivities: z.object({
    loanProceeds: z.number(),
    loanRepayments: z.number(),
    capitalContributions: z.number(),
    dividends: z.number(),
    netFinancingCashFlow: z.number(),
  }),
  netChangeInCash: z.number(),
  beginningCash: z.number(),
  endingCash: z.number(),
  warnings: z.array(z.string()).optional(),
});

// ============================================
// Expense Management
// ============================================

export const ExpenseCategorySchema = z.enum([
  'rent',
  'utilities',
  'salaries',
  'marketing',
  'office',
  'travel',
  'maintenance',
  'insurance',
  'taxes',
  'other',
]);

export const ExpenseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  category: ExpenseCategorySchema,
  description: z.string(),
  amount: z.number().positive(),
  currency: CurrencyNormalized.default('TRY'),
  date: z.string().datetime(),
  receiptUrl: z.string().optional(),
  vendor: z.string().optional(),
  isRecurring: z.boolean().default(false),
  recurringInterval: z.enum(['monthly', 'quarterly', 'yearly']).optional(),
  isTaxDeductible: z.boolean().default(true),
  taxAmount: z.number().default(0),
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
});

// ============================================
// Types
// ============================================

export type AccountType = z.infer<typeof AccountTypeSchema>;
export type Account = z.infer<typeof AccountSchema>;
export type JournalEntryType = z.infer<typeof JournalEntryTypeSchema>;
export type JournalEntry = z.infer<typeof JournalEntrySchema>;
export type JournalEntryLine = z.infer<typeof JournalEntryLineSchema>;
export type TaxType = z.infer<typeof TaxTypeSchema>;
export type TaxRate = z.infer<typeof TaxRateSchema>;
export type TaxTransaction = z.infer<typeof TaxTransactionSchema>;
export type CurrencyCode = z.infer<typeof CurrencyCodeSchema>;
export type ExchangeRate = z.infer<typeof ExchangeRateSchema>;
export type ProfitLossReport = z.infer<typeof ProfitLossReportSchema>;
export type BalanceSheet = z.infer<typeof BalanceSheetSchema>;
export type CashFlowReport = z.infer<typeof CashFlowReportSchema>;
export type ExpenseCategory = z.infer<typeof ExpenseCategorySchema>;
export type Expense = z.infer<typeof ExpenseSchema>;

// ============================================
// Labels
// ============================================

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  asset: 'Varlık (Aktif)',
  liability: 'Borç (Pasif)',
  equity: 'Öz Sermaye',
  revenue: 'Gelir',
  expense: 'Gider',
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  rent: 'Kira',
  utilities: 'Elektrik/Su/Doğalgaz',
  salaries: 'Maaşlar',
  marketing: 'Pazarlama',
  office: 'Ofis Giderleri',
  travel: 'Seyahat',
  maintenance: 'Bakım/Onarım',
  insurance: 'Sigorta',
  taxes: 'Vergiler',
  other: 'Diğer',
};

export const TAX_TYPE_LABELS: Record<TaxType, string> = {
  vat: 'KDV',
  withholding: 'Stopaj',
  corporate: 'Kurumlar Vergisi',
  income: 'Gelir Vergisi',
  stamp: 'Damga Vergisi',
};
