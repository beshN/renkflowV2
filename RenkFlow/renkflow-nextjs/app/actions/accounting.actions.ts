'use server';

/**
 * Advanced Accounting Server Actions
 * Detaylı muhasebe ve finansal raporlama işlemleri
 */

import { sql } from '@/lib/db';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  AccountSchema,
  JournalEntrySchema,
  ExpenseSchema,
  type Account,
  type JournalEntry,
  type ProfitLossReport,
  type BalanceSheet,
  type CashFlowReport,
  type Expense,
  ACCOUNT_TYPE_LABELS,
  TAX_TYPE_LABELS,
} from '@/lib/types/accounting';

// ============================================
// Helper Functions
// ============================================

async function getSession() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    throw new Error('Yetkilendirme gerekli');
  }
  return session;
}

// ============================================
// Accounts (Hesap Planı)
// ============================================

export async function getAccounts(): Promise<Account[]> {
  try {
    const session = await getSession();

    const result = await sql`
      SELECT * FROM accounts
      WHERE tenant_id = ${session.user.tenantId}
        AND is_active = true
      ORDER BY code ASC
    `;

    const rows = result as any[];
    return rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      tenantId: row.tenant_id as string,
      code: row.code as string,
      name: row.name as string,
      type: row.type as Account['type'],
      parentId: row.parent_id as string | undefined,
      description: row.description as string | undefined,
      isActive: row.is_active as boolean,
      isBankAccount: row.is_bank_account as boolean,
      bankName: row.bank_name as string | undefined,
      bankAccountNumber: row.bank_account_number as string | undefined,
      currency: (row.currency as string) || 'TRY',
      openingBalance: parseFloat(row.opening_balance as string) || 0,
      currentBalance: parseFloat(row.current_balance as string) || 0,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    }));
  } catch (error) {
    console.error('[Accounting] Get accounts error:', error);
    return [];
  }
}

export async function createAccount(
  data: Omit<Account, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>
): Promise<{ success: boolean; account?: Account; error?: string }> {
  try {
    const session = await getSession();

    // Validate account code uniqueness
    const existing = await sql`
      SELECT id FROM accounts
      WHERE code = ${data.code}
        AND tenant_id = ${session.user.tenantId}
      LIMIT 1
    `;
    const existingRows = existing as any[];

    if (existingRows.length > 0) {
      return { success: false, error: 'Bu hesap kodu zaten kullanılıyor' };
    }

    const result = await sql`
      INSERT INTO accounts (
        tenant_id, code, name, type, parent_id, description,
        is_bank_account, bank_name, bank_account_number, currency,
        opening_balance, current_balance, is_active
      ) VALUES (
        ${session.user.tenantId}, ${data.code}, ${data.name}, ${data.type},
        ${data.parentId || null}, ${data.description || null},
        ${data.isBankAccount}, ${data.bankName || null}, ${data.bankAccountNumber || null},
        ${data.currency || 'TRY'}, ${data.openingBalance || 0}, ${data.openingBalance || 0},
        true
      )
      RETURNING *
    `;

    revalidatePath('/finance/accounts');

    const rows = result as any[];
    const row = rows[0];
    return {
      success: true,
      account: {
        id: row.id as string,
        tenantId: row.tenant_id as string,
        code: row.code as string,
        name: row.name as string,
        type: row.type as Account['type'],
        parentId: row.parent_id as string | undefined,
        description: row.description as string | undefined,
        isActive: row.is_active as boolean,
        isBankAccount: row.is_bank_account as boolean,
        bankName: row.bank_name as string | undefined,
        bankAccountNumber: row.bank_account_number as string | undefined,
        currency: (row.currency as string) || 'TRY',
        openingBalance: parseFloat(row.opening_balance as string) || 0,
        currentBalance: parseFloat(row.current_balance as string) || 0,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      },
    };
  } catch (error) {
    console.error('[Accounting] Create account error:', error);
    return { success: false, error: 'Hesap oluşturulamadı' };
  }
}

// ============================================
// Expenses (Giderler)
// ============================================

export async function getExpenses(params?: {
  category?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<Expense[]> {
  try {
    const session = await getSession();
    const { category, startDate, endDate, limit = 100 } = params || {};

    let query = sql`
      SELECT * FROM expenses
      WHERE tenant_id = ${session.user.tenantId}
    `;

    if (category) {
      query = sql`
        SELECT * FROM expenses
        WHERE tenant_id = ${session.user.tenantId}
          AND category = ${category}
      `;
    }

    if (startDate && endDate) {
      query = sql`
        SELECT * FROM expenses
        WHERE tenant_id = ${session.user.tenantId}
          AND date >= ${startDate}
          AND date <= ${endDate}
        ORDER BY date DESC
        LIMIT ${limit}
      `;
    } else {
      query = sql`
        SELECT * FROM expenses
        WHERE tenant_id = ${session.user.tenantId}
        ORDER BY date DESC
        LIMIT ${limit}
      `;
    }

    const result = await query;
    const rows = result as any[];

    return rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      tenantId: row.tenant_id as string,
      category: row.category as Expense['category'],
      description: row.description as string,
      amount: parseFloat(row.amount as string),
      currency: (row.currency as string) || 'TRY',
      date: row.date as string,
      receiptUrl: row.receipt_url as string | undefined,
      vendor: row.vendor as string | undefined,
      isRecurring: row.is_recurring as boolean,
      recurringInterval: row.recurring_interval as Expense['recurringInterval'],
      isTaxDeductible: row.is_tax_deductible as boolean,
      taxAmount: parseFloat(row.tax_amount as string) || 0,
      createdBy: row.created_by as string,
      createdAt: row.created_at as string,
    }));
  } catch (error) {
    console.error('[Accounting] Get expenses error:', error);
    return [];
  }
}

export async function createExpense(
  data: Omit<Expense, 'id' | 'tenantId' | 'createdAt'>
): Promise<{ success: boolean; expense?: Expense; error?: string }> {
  try {
    const session = await getSession();

    const result = await sql`
      INSERT INTO expenses (
        tenant_id, category, description, amount, currency,
        date, receipt_url, vendor, is_recurring, recurring_interval,
        is_tax_deductible, tax_amount, created_by
      ) VALUES (
        ${session.user.tenantId}, ${data.category}, ${data.description},
        ${data.amount}, ${data.currency || 'TRY'}, ${data.date},
        ${data.receiptUrl || null}, ${data.vendor || null},
        ${data.isRecurring || false}, ${data.recurringInterval || null},
        ${data.isTaxDeductible !== false}, ${data.taxAmount || 0},
        ${session.user.id}
      )
      RETURNING *
    `;

    revalidatePath('/finance/expenses');

    const resultRows = result as any[];
    const row = resultRows[0];
    return {
      success: true,
      expense: {
        id: row.id as string,
        tenantId: row.tenant_id as string,
        category: row.category as Expense['category'],
        description: row.description as string,
        amount: parseFloat(row.amount as string),
        currency: (row.currency as string) || 'TRY',
        date: row.date as string,
        receiptUrl: row.receipt_url as string | undefined,
        vendor: row.vendor as string | undefined,
        isRecurring: row.is_recurring as boolean,
        recurringInterval: row.recurring_interval as Expense['recurringInterval'],
        isTaxDeductible: row.is_tax_deductible as boolean,
        taxAmount: parseFloat(row.tax_amount as string) || 0,
        createdBy: row.created_by as string,
        createdAt: row.created_at as string,
      },
    };
  } catch (error) {
    console.error('[Accounting] Create expense error:', error);
    return { success: false, error: 'Gider kaydedilemedi' };
  }
}

// ============================================
// Advanced Reports
// ============================================

export async function getProfitLossReport(
  startDate: string,
  endDate: string
): Promise<ProfitLossReport | null> {
  try {
    const session = await getSession();

    // Gelir hesapla
    const revenue = await sql`
      SELECT 
        COALESCE(SUM(total_amount), 0) as gross_revenue,
        COUNT(*) as order_count
      FROM orders
      WHERE tenant_id = ${session.user.tenantId}
        AND status = 'delivered'
        AND created_at >= ${startDate}
        AND created_at <= ${endDate}
    `;

    // Ödemeleri hesapla
    const payments = await sql`
      SELECT COALESCE(SUM(amount), 0) as total_payments
      FROM payments
      WHERE tenant_id = ${session.user.tenantId}
        AND paid_at >= ${startDate}
        AND paid_at <= ${endDate}
    `;

    // Giderleri hesapla
    const expenses = await sql`
      SELECT 
        category,
        COALESCE(SUM(amount), 0) as total
      FROM expenses
      WHERE tenant_id = ${session.user.tenantId}
        AND date >= ${startDate}
        AND date <= ${endDate}
      GROUP BY category
    `;

    // Maaşları hesapla
    const salaries = await sql`
      SELECT COALESCE(SUM(amount), 0) as total_salaries
      FROM employee_ledger
      WHERE tenant_id = ${session.user.tenantId}
        AND kind = 'salary'
        AND entry_date >= ${startDate.slice(0, 10)}
        AND entry_date <= ${endDate.slice(0, 10)}
    `;

    const revenueRows = revenue as any[];
    const paymentsRows = payments as any[];
    const salariesRows = salaries as any[];

    const grossRevenue = parseFloat(revenueRows[0]?.gross_revenue || '0');
    const totalPayments = parseFloat(paymentsRows[0]?.total_payments || '0');
    const totalSalaries = parseFloat(salariesRows[0]?.total_salaries || '0');

    const expenseMap: Record<string, number> = {};
    (expenses as { category: string; total: string }[]).forEach((e) => {
      expenseMap[e.category] = parseFloat(e.total);
    });

    const operatingExpenses = {
      salaries: totalSalaries,
      rent: expenseMap['rent'] || 0,
      utilities: expenseMap['utilities'] || 0,
      marketing: expenseMap['marketing'] || 0,
      depreciation: 0, // TODO: Calculate depreciation
      other: Object.entries(expenseMap)
        .filter(([k]) => !['rent', 'utilities', 'marketing'].includes(k))
        .reduce((sum, [, v]) => sum + v, 0),
      total: 0,
    };
    operatingExpenses.total = Object.values(operatingExpenses).reduce((a, b) => a + b, 0) - operatingExpenses.total;

    const grossProfit = grossRevenue; // TODO: Subtract COGS
    const operatingProfit = grossProfit - operatingExpenses.total;
    const profitBeforeTax = operatingProfit;
    const taxExpense = profitBeforeTax * 0.20; // %20 kurumlar vergisi
    const netProfit = profitBeforeTax - taxExpense;

    return {
      period: {
        startDate,
        endDate,
        period: startDate.slice(0, 7),
      },
      revenue: {
        grossRevenue,
        discounts: 0,
        returns: 0,
        netRevenue: grossRevenue,
      },
      costOfGoodsSold: 0,
      grossProfit,
      operatingExpenses,
      operatingProfit,
      financialIncome: 0,
      financialExpenses: 0,
      profitBeforeTax,
      taxExpense,
      netProfit,
    };
  } catch (error) {
    console.error('[Accounting] Profit/Loss report error:', error);
    return null;
  }
}

export async function getBalanceSheet(asOfDate?: string): Promise<BalanceSheet | null> {
  try {
    const session = await getSession();
    const date = asOfDate || new Date().toISOString();

    // Nakit ve banka hesapları
    const cashAndBank = await sql`
      SELECT 
        COALESCE(SUM(current_balance), 0) as total
      FROM accounts
      WHERE tenant_id = ${session.user.tenantId}
        AND type = 'asset'
        AND (code LIKE '100%' OR code LIKE '102%')
    `;

    // Alacaklar
    const receivables = await sql`
      SELECT COALESCE(SUM(remaining_amount), 0) as total
      FROM (
        SELECT 
          o.id,
          o.total_amount - COALESCE(SUM(p.amount), 0) as remaining_amount
        FROM orders o
        LEFT JOIN payments p ON o.id = p.order_id
        WHERE o.tenant_id = ${session.user.tenantId}
          AND o.status IN ('pending', 'in_production', 'delivered')
        GROUP BY o.id
      ) subquery
    `;

    // Stok değeri
    const inventory = await sql`
      SELECT COALESCE(SUM(current_stock * unit_cost), 0) as total
      FROM inventory_items
      WHERE tenant_id = ${session.user.tenantId}
        AND is_active = true
    `;

    // Borçlar (Ödenecekler)
    const payables = await sql`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM expenses
      WHERE tenant_id = ${session.user.tenantId}
        AND date <= ${date}
    `;

    const cashAndBankRows = cashAndBank as any[];
    const receivablesRows = receivables as any[];
    const inventoryRows = inventory as any[];
    const payablesRows = payables as any[];

    const totalCash = parseFloat(cashAndBankRows[0]?.total || '0');
    const totalReceivables = parseFloat(receivablesRows[0]?.total || '0');
    const totalInventory = parseFloat(inventoryRows[0]?.total || '0');
    const totalPayables = parseFloat(payablesRows[0]?.total || '0');

    const currentAssets = {
      cash: totalCash,
      bankAccounts: 0,
      accountsReceivable: totalReceivables,
      inventory: totalInventory,
      prepaidExpenses: 0,
      total: totalCash + totalReceivables + totalInventory,
    };

    const currentLiabilities = {
      accountsPayable: totalPayables,
      shortTermDebt: 0,
      accruedExpenses: 0,
      taxesPayable: 0,
      total: totalPayables,
    };

    const totalAssets = currentAssets.total;
    const totalLiabilities = currentLiabilities.total;
    const totalEquity = totalAssets - totalLiabilities;

    return {
      asOfDate: date,
      assets: {
        currentAssets,
        nonCurrentAssets: {
          propertyPlantEquipment: 0,
          intangibleAssets: 0,
          longTermInvestments: 0,
          total: 0,
        },
        totalAssets,
      },
      liabilities: {
        currentLiabilities,
        nonCurrentLiabilities: {
          longTermDebt: 0,
          deferredTax: 0,
          total: 0,
        },
        totalLiabilities,
      },
      equity: {
        shareCapital: 0,
        retainedEarnings: 0,
        currentYearProfit: totalEquity,
        totalEquity,
      },
    };
  } catch (error) {
    console.error('[Accounting] Balance sheet error:', error);
    return null;
  }
}

export async function getCashFlowReport(
  startDate: string,
  endDate: string
): Promise<CashFlowReport | null> {
  try {
    const session = await getSession();

    // İşletme faaliyetlerinden nakit akışı
    const operatingCash = await sql`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM payments
      WHERE tenant_id = ${session.user.tenantId}
        AND paid_at >= ${startDate}
        AND paid_at <= ${endDate}
    `;

    // Gider ödemeleri
    const expensePayments = await sql`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM expenses
      WHERE tenant_id = ${session.user.tenantId}
        AND date >= ${startDate}
        AND date <= ${endDate}
    `;

    // Maaş ödemeleri
    const salaryPayments = await sql`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM employee_ledger
      WHERE tenant_id = ${session.user.tenantId}
        AND kind = 'salary'
        AND entry_date >= ${startDate.slice(0, 10)}
        AND entry_date <= ${endDate.slice(0, 10)}
    `;

    const operatingCashRows = operatingCash as any[];
    const expensePaymentsRows = expensePayments as any[];
    const salaryPaymentsRows = salaryPayments as any[];

    const cashIn = parseFloat(operatingCashRows[0]?.total || '0');
    const cashOutExpenses = parseFloat(expensePaymentsRows[0]?.total || '0');
    const cashOutSalaries = parseFloat(salaryPaymentsRows[0]?.total || '0');

    const netOperatingCash = cashIn - cashOutExpenses - cashOutSalaries;

    return {
      period: {
        startDate,
        endDate,
        period: startDate.slice(0, 7),
      },
      operatingActivities: {
        netProfit: netOperatingCash,
        depreciation: 0,
        changesInReceivables: 0,
        changesInInventory: 0,
        changesInPayables: 0,
        netOperatingCashFlow: netOperatingCash,
      },
      investingActivities: {
        purchaseOfAssets: 0,
        saleOfAssets: 0,
        investments: 0,
        netInvestingCashFlow: 0,
      },
      financingActivities: {
        loanProceeds: 0,
        loanRepayments: 0,
        capitalContributions: 0,
        dividends: 0,
        netFinancingCashFlow: 0,
      },
      netChangeInCash: netOperatingCash,
      beginningCash: 0,
      endingCash: netOperatingCash,
    };
  } catch (error) {
    console.error('[Accounting] Cash flow report error:', error);
    return null;
  }
}

// ============================================
// Tax Summary
// ============================================

export async function getTaxSummary(period: string): Promise<{
  vatPayable: number;
  vatReceivable: number;
  netVat: number;
  withholdingTax: number;
}> {
  try {
    const session = await getSession();

    // KDV hesapla
    const vatTransactions = await sql`
      SELECT 
        type,
        COALESCE(SUM(tax_amount), 0) as total
      FROM tax_transactions
      WHERE tenant_id = ${session.user.tenantId}
        AND period = ${period}
        AND tax_type = 'vat'
      GROUP BY type
    `;

    const vatPayable = parseFloat(
      (vatTransactions as { type: string; total: string }[]).find((t) => t.type === 'output')?.total || '0'
    );
    const vatReceivable = parseFloat(
      (vatTransactions as { type: string; total: string }[]).find((t) => t.type === 'input')?.total || '0'
    );

    // Stopaj
    const withholding = await sql`
      SELECT COALESCE(SUM(tax_amount), 0) as total
      FROM tax_transactions
      WHERE tenant_id = ${session.user.tenantId}
        AND period = ${period}
        AND tax_type = 'withholding'
    `;

    const withholdingRows = withholding as any[];

    return {
      vatPayable,
      vatReceivable,
      netVat: vatPayable - vatReceivable,
      withholdingTax: parseFloat(withholdingRows[0]?.total || '0'),
    };
  } catch (error) {
    console.error('[Accounting] Tax summary error:', error);
    return { vatPayable: 0, vatReceivable: 0, netVat: 0, withholdingTax: 0 };
  }
}
