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
// Enterprise Accounting Analytics
// ============================================

export const AgingItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  documentNumber: z.string().optional(),
  amount: z.number(),
  daysOverdue: z.number().int(),
  dueDate: z.string().optional(),
});

export const AgingReportSchema = z.object({
  asOfDate: z.string().datetime(),
  total: z.number(),
  current: z.number(),
  oneToThirty: z.number(),
  thirtyOneToSixty: z.number(),
  sixtyOneToNinety: z.number(),
  overNinety: z.number(),
  items: z.array(AgingItemSchema),
});

export const AccountingKpiSchema = z.object({
  grossMarginPct: z.number(),
  operatingMarginPct: z.number(),
  currentRatio: z.number(),
  receivableDays: z.number(),
  payablesCoverageRatio: z.number(),
  cashRunwayMonths: z.number(),
});

export const PeriodComparisonSchema = z.object({
  period: z.string(),
  previousPeriod: z.string(),
  revenueChangePct: z.number(),
  expenseChangePct: z.number(),
  netProfitChangePct: z.number(),
  cashChangePct: z.number(),
});

export const CloseChecklistStatusSchema = z.enum(['done', 'warning', 'pending']);

export const CloseChecklistItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: CloseChecklistStatusSchema,
  note: z.string().optional(),
});

export const AccountingCapabilitiesSchema = z.object({
  chartOfAccounts: z.boolean(),
  generalLedger: z.boolean(),
  bankReconciliation: z.boolean(),
  receivableAging: z.boolean(),
  payableAging: z.boolean(),
  cashFlowReporting: z.boolean(),
  taxManagement: z.boolean(),
  fixedAssetDepreciation: z.boolean(),
  budgeting: z.boolean(),
  forecasting: z.boolean(),
  complianceMonitoring: z.boolean(),
  periodLocking: z.boolean(),
  periodClose: z.boolean(),
  kpiDashboard: z.boolean(),
});

export const TaxSummarySchema = z.object({
  vatPayable: z.number(),
  vatReceivable: z.number(),
  netVat: z.number(),
  withholdingTax: z.number(),
});

export const AccountingBudgetPlanSchema = z.object({
  period: z.string(),
  plannedRevenue: z.number(),
  plannedCostOfGoodsSold: z.number(),
  plannedOperatingExpenses: z.number(),
  plannedTaxExpense: z.number(),
  plannedCapex: z.number(),
  notes: z.array(z.string()).optional(),
});

export const BudgetVsActualRowSchema = z.object({
  key: z.enum(['revenue', 'cogs', 'operatingExpenses', 'taxExpense', 'netProfit']),
  label: z.string(),
  planned: z.number(),
  actual: z.number(),
  variance: z.number(),
  variancePct: z.number(),
  betterWhen: z.enum(['higher', 'lower']),
});

export const BudgetVsActualReportSchema = z.object({
  period: z.string(),
  hasBudget: z.boolean(),
  rows: z.array(BudgetVsActualRowSchema),
  totalPlannedProfit: z.number(),
  totalActualProfit: z.number(),
  profitVariance: z.number(),
  profitVariancePct: z.number(),
});

export const CashForecastPointSchema = z.object({
  period: z.string(),
  projectedInflow: z.number(),
  projectedOutflow: z.number(),
  projectedNet: z.number(),
  projectedEndingCash: z.number(),
  confidencePct: z.number(),
});

export const CashForecastReportSchema = z.object({
  startingCash: z.number(),
  averageMonthlyInflow: z.number(),
  averageMonthlyOutflow: z.number(),
  points: z.array(CashForecastPointSchema),
});

export const BankReconciliationStatusSchema = z.enum(['unmatched', 'matched', 'ignored']);

export const BankReconciliationItemSchema = z.object({
  id: z.string().uuid(),
  statementDate: z.string().datetime(),
  description: z.string(),
  amount: z.number(),
  status: BankReconciliationStatusSchema,
  reference: z.string().optional(),
  suggestedMatchType: z.enum(['payment', 'expense']).optional(),
  suggestedMatchId: z.string().uuid().optional(),
  suggestedLabel: z.string().optional(),
});

export const BankReconciliationSummarySchema = z.object({
  period: z.string(),
  hasData: z.boolean(),
  importedLineCount: z.number(),
  matchedLineCount: z.number(),
  unmatchedLineCount: z.number(),
  ignoredLineCount: z.number(),
  statementInflow: z.number(),
  statementOutflow: z.number(),
  statementNet: z.number(),
  booksNet: z.number(),
  difference: z.number(),
  matchedAmount: z.number(),
  unmatchedAmount: z.number(),
  matchRatePct: z.number(),
  items: z.array(BankReconciliationItemSchema),
});

export const ComplianceSeveritySchema = z.enum(['info', 'warning', 'critical']);

export const ComplianceIssueSchema = z.object({
  code: z.string(),
  title: z.string(),
  detail: z.string(),
  severity: ComplianceSeveritySchema,
  recommendation: z.string(),
});

export const ComplianceSummarySchema = z.object({
  score: z.number(),
  issues: z.array(ComplianceIssueSchema),
  criticalCount: z.number(),
  warningCount: z.number(),
  infoCount: z.number(),
});

export const PeriodCloseStateSchema = z.object({
  period: z.string(),
  status: z.enum(['open', 'soft_closed', 'hard_closed']),
  locked: z.boolean(),
  closedAt: z.string().datetime().optional(),
  closedByName: z.string().optional(),
});

export const AccountingWorkspaceSchema = z.object({
  period: z.string(),
  profitLoss: ProfitLossReportSchema.nullable(),
  balanceSheet: BalanceSheetSchema.nullable(),
  cashFlow: CashFlowReportSchema.nullable(),
  taxSummary: TaxSummarySchema,
  budget: AccountingBudgetPlanSchema,
  budgetVsActual: BudgetVsActualReportSchema,
  cashForecast: CashForecastReportSchema,
  bankReconciliation: BankReconciliationSummarySchema,
  compliance: ComplianceSummarySchema,
  periodCloseState: PeriodCloseStateSchema,
  receivablesAging: AgingReportSchema,
  payablesAging: AgingReportSchema,
  periodComparison: PeriodComparisonSchema,
  kpis: AccountingKpiSchema,
  alerts: z.array(z.string()),
  closeChecklist: z.array(CloseChecklistItemSchema),
  capabilities: AccountingCapabilitiesSchema,
  notes: z.array(z.string()),
});

// ============================================
// Expense Management
// ============================================

export const ExpenseCategorySchema = z.enum([
  'materials',
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
export type AgingItem = z.infer<typeof AgingItemSchema>;
export type AgingReport = z.infer<typeof AgingReportSchema>;
export type AccountingKpi = z.infer<typeof AccountingKpiSchema>;
export type PeriodComparison = z.infer<typeof PeriodComparisonSchema>;
export type CloseChecklistStatus = z.infer<typeof CloseChecklistStatusSchema>;
export type CloseChecklistItem = z.infer<typeof CloseChecklistItemSchema>;
export type AccountingCapabilities = z.infer<typeof AccountingCapabilitiesSchema>;
export type TaxSummary = z.infer<typeof TaxSummarySchema>;
export type AccountingBudgetPlan = z.infer<typeof AccountingBudgetPlanSchema>;
export type BudgetVsActualRow = z.infer<typeof BudgetVsActualRowSchema>;
export type BudgetVsActualReport = z.infer<typeof BudgetVsActualReportSchema>;
export type CashForecastPoint = z.infer<typeof CashForecastPointSchema>;
export type CashForecastReport = z.infer<typeof CashForecastReportSchema>;
export type BankReconciliationStatus = z.infer<typeof BankReconciliationStatusSchema>;
export type BankReconciliationItem = z.infer<typeof BankReconciliationItemSchema>;
export type BankReconciliationSummary = z.infer<typeof BankReconciliationSummarySchema>;
export type ComplianceSeverity = z.infer<typeof ComplianceSeveritySchema>;
export type ComplianceIssue = z.infer<typeof ComplianceIssueSchema>;
export type ComplianceSummary = z.infer<typeof ComplianceSummarySchema>;
export type PeriodCloseState = z.infer<typeof PeriodCloseStateSchema>;
export type AccountingWorkspace = z.infer<typeof AccountingWorkspaceSchema>;
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
  materials: 'Malzeme ve hammadde alışı (stok)',
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
