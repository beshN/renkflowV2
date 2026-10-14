'use server';

/**
 * Advanced Accounting Server Actions
 * Detaylı muhasebe ve finansal raporlama işlemleri
 */

import { sql } from '@/lib/db';
import { syncLedger, type SyncResult } from '@/lib/features/accounting/posting.server';
import { loadVatReturn } from '@/lib/features/accounting/vat-return.server';
import { vatReturnCsv, type VatReturn } from '@/lib/features/accounting/vat-return';
import { addExpense, deleteExpense, listExpenses, type ExpenseView } from '@/lib/features/accounting/expenses.server';
import { recordAudit } from '@/lib/audit/audit-log';
import { z } from 'zod';
import { getServerUserContext,requirePermission } from '@/lib/features/auth/serverAuth';
import { revalidatePath } from 'next/cache';
import { normalizeCurrencyInput } from '@/lib/utils/currency';
import { isMissingRelationError, tableExists } from '@/lib/db/schema-guard';
import {
  assertPeriodWritable,
  normalizeAccountingPeriod,
  periodFromDateInput,
} from '@/lib/features/accounting/period-lock';
import type {
  Account,
  JournalEntry,
  ProfitLossReport,
  BalanceSheet,
  CashFlowReport,
  Expense,
  AgingItem,
  AgingReport,
  PeriodComparison,
  AccountingKpi,
  CloseChecklistItem,
  AccountingWorkspace,
  TaxSummary,
  AccountingBudgetPlan,
  BudgetVsActualReport,
  BudgetVsActualRow,
  CashForecastReport,
  CashForecastPoint,
  BankReconciliationSummary,
  BankReconciliationItem,
  ComplianceIssue,
  ComplianceSummary,
  PeriodCloseState,
} from '@/lib/types/accounting';

const DEFAULT_PAYMENT_TERM_DAYS = 30;
const MAX_CASH_RUNWAY_MONTHS = 24;
const FORECAST_MONTHS_DEFAULT = 6;

type SessionWithTenant = {
  user: {
    id: string;
    name?: string | null;
    tenantId: string;
    role: string;
  };
};

type JournalLineInput = {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
  orderId?: string;
  invoiceId?: string;
};

export type CreateJournalEntryInput = {
  date: string;
  type: JournalEntry['type'];
  description: string;
  lines: JournalLineInput[];
  attachments?: string[];
};

export type TrialBalanceRow = {
  accountId: string;
  accountCode: string;
  accountName: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
};

export type TrialBalanceReport = {
  period: string;
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
};

export type UpsertAccountingBudgetInput = {
  period: string;
  plannedRevenue: number;
  plannedCostOfGoodsSold: number;
  plannedOperatingExpenses: number;
  plannedTaxExpense?: number;
  plannedCapex?: number;
  notes?: string[];
};

export type SetPeriodCloseInput = {
  period: string;
  status: 'open' | 'soft_closed' | 'hard_closed';
  note?: string;
};

export type ImportBankStatementLineInput = {
  statementDate: string;
  amount: number;
  description: string;
  reference?: string;
  externalId?: string;
  accountId?: string;
};

export type ImportBankStatementInput = {
  lines: ImportBankStatementLineInput[];
  accountId?: string;
};

export type SetBankStatementLineMatchInput = {
  lineId: string;
  matchType: 'payment' | 'expense' | 'ignored' | 'unmatched';
  matchId?: string;
};

type PeriodRange = {
  period: string;
  startDate: string;
  endDate: string;
  startDateIso: string;
  endDateIso: string;
  daysInPeriod: number;
};

function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  const parsed = parseFloat(String(value ?? '0'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatCurrencyShort(value: number): string {
  return `${round2(value).toLocaleString('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} TL`;
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) {
    if (current === 0) return 0;
    return 100;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

function normalizePeriod(period?: string): string {
  return normalizeAccountingPeriod(period);
}

function getPeriodRange(period?: string): PeriodRange {
  const normalized = normalizePeriod(period);
  const [yearRaw, monthRaw] = normalized.split('-');
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;

  const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));
  const daysInPeriod = end.getUTCDate();

  return {
    period: normalized,
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    startDateIso: start.toISOString(),
    endDateIso: end.toISOString(),
    daysInPeriod,
  };
}

function getPreviousPeriod(period: string): string {
  const [yearRaw, monthRaw] = period.split('-');
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  const date = new Date(Date.UTC(year, monthIndex, 1));
  date.setUTCMonth(date.getUTCMonth() - 1);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function addMonthsToPeriod(period: string, delta: number): string {
  const [yearRaw, monthRaw] = period.split('-');
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  const date = new Date(Date.UTC(year, monthIndex, 1));
  date.setUTCMonth(date.getUTCMonth() + delta);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function toIsoDate(value: unknown): string {
  const date = value ? new Date(String(value)) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function diffDays(fromDate: Date, toDate: Date): number {
  const msInDay = 24 * 60 * 60 * 1000;
  return Math.floor((toDate.getTime() - fromDate.getTime()) / msInDay);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function bucketAging(items: AgingItem[], asOfDateIso: string): AgingReport {
  const totals = {
    current: 0,
    oneToThirty: 0,
    thirtyOneToSixty: 0,
    sixtyOneToNinety: 0,
    overNinety: 0,
    total: 0,
  };

  for (const item of items) {
    totals.total += item.amount;
    if (item.daysOverdue <= 0) {
      totals.current += item.amount;
      continue;
    }
    if (item.daysOverdue <= 30) {
      totals.oneToThirty += item.amount;
      continue;
    }
    if (item.daysOverdue <= 60) {
      totals.thirtyOneToSixty += item.amount;
      continue;
    }
    if (item.daysOverdue <= 90) {
      totals.sixtyOneToNinety += item.amount;
      continue;
    }
    totals.overNinety += item.amount;
  }

  return {
    asOfDate: asOfDateIso,
    total: round2(totals.total),
    current: round2(totals.current),
    oneToThirty: round2(totals.oneToThirty),
    thirtyOneToSixty: round2(totals.thirtyOneToSixty),
    sixtyOneToNinety: round2(totals.sixtyOneToNinety),
    overNinety: round2(totals.overNinety),
    items,
  };
}

async function getSession(): Promise<SessionWithTenant> {
  const context=await getServerUserContext();
  requirePermission(context,'finance.view');
  return {user:{id:context.userId,name:context.name,tenantId:context.tenantId,role:context.role}};
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
      parentId: (row.parent_id as string) || undefined,
      description: (row.description as string) || undefined,
      isActive: Boolean(row.is_active),
      isBankAccount: Boolean(row.is_bank_account),
      bankName: (row.bank_name as string) || undefined,
      bankAccountNumber: (row.bank_account_number as string) || undefined,
      currency: normalizeCurrencyInput(row.currency),
      openingBalance: toNumber(row.opening_balance),
      currentBalance: toNumber(row.current_balance),
      createdAt: toIsoDate(row.created_at),
      updatedAt: toIsoDate(row.updated_at),
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
    revalidatePath('/accounting');

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
        parentId: (row.parent_id as string) || undefined,
        description: (row.description as string) || undefined,
        isActive: Boolean(row.is_active),
        isBankAccount: Boolean(row.is_bank_account),
        bankName: (row.bank_name as string) || undefined,
        bankAccountNumber: (row.bank_account_number as string) || undefined,
        currency: normalizeCurrencyInput(row.currency),
        openingBalance: toNumber(row.opening_balance),
        currentBalance: toNumber(row.current_balance),
        createdAt: toIsoDate(row.created_at),
        updatedAt: toIsoDate(row.updated_at),
      },
    };
  } catch (error) {
    console.error('[Accounting] Create account error:', error);
    return { success: false, error: 'Hesap oluşturulamadı' };
  }
}

// ============================================
// Journal Entries (Yevmiye Defteri / Büyük Defter)
// ============================================

async function mapJournalLines(
  session: SessionWithTenant,
  journalEntryId: string
): Promise<JournalEntry['lines']> {
  const linesResult = await sql`
    SELECT
      jel.id,
      jel.account_id,
      jel.debit,
      jel.credit,
      jel.description,
      jel.order_id,
      jel.invoice_id,
      a.code as account_code,
      a.name as account_name
    FROM journal_entry_lines jel
    JOIN accounts a ON a.id = jel.account_id
    WHERE jel.journal_entry_id = ${journalEntryId}
      AND a.tenant_id = ${session.user.tenantId}
    ORDER BY jel.line_no ASC, jel.created_at ASC
  `;

  const lineRows = linesResult as any[];
  return lineRows.map((line: any) => ({
    id: line.id as string,
    accountId: line.account_id as string,
    accountCode: line.account_code as string,
    accountName: line.account_name as string,
    debit: toNumber(line.debit),
    credit: toNumber(line.credit),
    description: (line.description as string) || undefined,
    orderId: (line.order_id as string) || undefined,
    invoiceId: (line.invoice_id as string) || undefined,
  }));
}

export async function getJournalEntries(params?: {
  period?: string;
  limit?: number;
}): Promise<JournalEntry[]> {
  try {
    const session = await getSession();
    const journalReady = await tableExists('journal_entries');
    const linesReady = await tableExists('journal_entry_lines');
    if (!journalReady || !linesReady) {
      return [];
    }

    const limit = Math.min(Math.max(params?.limit || 50, 1), 300);
    const period = normalizePeriod(params?.period);

    const result = params?.period
      ? await sql`
          SELECT
            je.*,
            COALESCE(u.name, 'Sistem') as created_by_name
          FROM journal_entries je
          LEFT JOIN users u ON u.id = je.created_by
          WHERE je.tenant_id = ${session.user.tenantId}
            AND je.period = ${period}
          ORDER BY je.entry_date DESC, je.created_at DESC
          LIMIT ${limit}
        `
      : await sql`
          SELECT
            je.*,
            COALESCE(u.name, 'Sistem') as created_by_name
          FROM journal_entries je
          LEFT JOIN users u ON u.id = je.created_by
          WHERE je.tenant_id = ${session.user.tenantId}
          ORDER BY je.entry_date DESC, je.created_at DESC
          LIMIT ${limit}
        `;

    const rows = result as any[];
    const entries: JournalEntry[] = [];

    for (const row of rows) {
      const lines = await mapJournalLines(session, row.id as string);
      const totalDebit = round2(lines.reduce((sum, line) => sum + line.debit, 0));
      const totalCredit = round2(lines.reduce((sum, line) => sum + line.credit, 0));

      entries.push({
        id: row.id as string,
        tenantId: row.tenant_id as string,
        entryNumber: row.entry_number as string,
        date: toIsoDate(row.entry_date),
        type: row.type as JournalEntry['type'],
        description: row.description as string,
        lines,
        totalDebit,
        totalCredit,
        isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
        createdBy: row.created_by as string,
        createdByName: row.created_by_name as string,
        attachments: Array.isArray(row.attachments) ? (row.attachments as string[]) : undefined,
        period: row.period as string,
        createdAt: toIsoDate(row.created_at),
        updatedAt: toIsoDate(row.updated_at),
      });
    }

    return entries;
  } catch (error) {
    if (isMissingRelationError(error, ['journal_entries', 'journal_entry_lines'])) {
      return [];
    }
    console.error('[Accounting] Get journal entries error:', error);
    return [];
  }
}

export async function createJournalEntry(
  input: CreateJournalEntryInput
): Promise<{ success: boolean; entry?: JournalEntry; error?: string }> {
  try {
    const session = await getSession();

    const journalReady = await tableExists('journal_entries');
    const linesReady = await tableExists('journal_entry_lines');
    if (!journalReady || !linesReady) {
      return {
        success: false,
        error: 'Yevmiye tabloları hazır değil. Önce muhasebe migrationlarını uygulayın.',
      };
    }

    if (!input.description?.trim()) {
      return { success: false, error: 'Açıklama zorunludur' };
    }
    if (!input.lines || input.lines.length < 2) {
      return { success: false, error: 'En az iki satır gereklidir' };
    }

    const normalizedLines = input.lines.map((line) => ({
      ...line,
      debit: round2(toNumber(line.debit)),
      credit: round2(toNumber(line.credit)),
    }));

    const invalidLine = normalizedLines.find((line) => line.debit < 0 || line.credit < 0 || (!line.debit && !line.credit));
    if (invalidLine) {
      return { success: false, error: 'Her satırda borç veya alacak tutarı olmalıdır' };
    }

    const totalDebit = round2(normalizedLines.reduce((sum, line) => sum + line.debit, 0));
    const totalCredit = round2(normalizedLines.reduce((sum, line) => sum + line.credit, 0));

    if (Math.abs(totalDebit - totalCredit) >= 0.01) {
      return { success: false, error: 'Yevmiye dengesi bozuk: Borç ve alacak eşit olmalıdır' };
    }

    const uniqueAccountIds = [...new Set(normalizedLines.map((line) => line.accountId))];
    for (const accountId of uniqueAccountIds) {
      const accountCheck = await sql`
        SELECT id FROM accounts
        WHERE id = ${accountId}
          AND tenant_id = ${session.user.tenantId}
          AND is_active = true
        LIMIT 1
      `;
      const accountRows = accountCheck as any[];
      if (accountRows.length === 0) {
        return { success: false, error: 'Geçersiz veya pasif hesap seçildi' };
      }
    }

    const entryDate = new Date(input.date);
    if (Number.isNaN(entryDate.getTime())) {
      return { success: false, error: 'Geçersiz tarih' };
    }

    const period = entryDate.toISOString().slice(0, 7);
    await assertPeriodWritable({
      tenantId: session.user.tenantId,
      period,
      actionLabel: 'Yevmiye kaydı',
    });

    const prefix = period.replace('-', '');

    const created = await sql.begin(async (tx: any) => {
      const countResult = await tx`
        SELECT COUNT(*)::int as count
        FROM journal_entries
        WHERE tenant_id = ${session.user.tenantId}
          AND period = ${period}
      `;
      const countRows = countResult as any[];
      const sequence = Number(countRows[0]?.count || 0) + 1;
      const entryNumber = `JRN-${prefix}-${String(sequence).padStart(4, '0')}`;

      const entryResult = await tx`
        INSERT INTO journal_entries (
          tenant_id,
          entry_number,
          entry_date,
          type,
          description,
          total_debit,
          total_credit,
          attachments,
          period,
          created_by
        ) VALUES (
          ${session.user.tenantId},
          ${entryNumber},
          ${entryDate.toISOString()},
          ${input.type},
          ${input.description.trim()},
          ${totalDebit},
          ${totalCredit},
          ${input.attachments || null},
          ${period},
          ${session.user.id}
        )
        RETURNING *
      `;

      const entryRow = (entryResult as any[])[0];

      for (let i = 0; i < normalizedLines.length; i += 1) {
        const line = normalizedLines[i];
        await tx`
          INSERT INTO journal_entry_lines (
            journal_entry_id,
            line_no,
            account_id,
            debit,
            credit,
            description,
            order_id,
            invoice_id
          ) VALUES (
            ${entryRow.id},
            ${i + 1},
            ${line.accountId},
            ${line.debit},
            ${line.credit},
            ${line.description || null},
            ${line.orderId || null},
            ${line.invoiceId || null}
          )
        `;
      }

      return entryRow;
    });

    const lines = await mapJournalLines(session, created.id as string);
    const createdEntry: JournalEntry = {
      id: created.id as string,
      tenantId: created.tenant_id as string,
      entryNumber: created.entry_number as string,
      date: toIsoDate(created.entry_date),
      type: created.type as JournalEntry['type'],
      description: created.description as string,
      lines,
      totalDebit: toNumber(created.total_debit),
      totalCredit: toNumber(created.total_credit),
      isBalanced: true,
      createdBy: created.created_by as string,
      createdByName: session.user.name || 'Sistem',
      attachments: Array.isArray(created.attachments) ? (created.attachments as string[]) : undefined,
      period: created.period as string,
      createdAt: toIsoDate(created.created_at),
      updatedAt: toIsoDate(created.updated_at),
    };

    revalidatePath('/accounting');
    return { success: true, entry: createdEntry };
  } catch (error) {
    console.error('[Accounting] Create journal entry error:', error);
    return { success: false, error: 'Yevmiye kaydı oluşturulamadı' };
  }
}

export async function getTrialBalance(period?: string): Promise<TrialBalanceReport> {
  const normalizedPeriod = normalizePeriod(period);

  try {
    const session = await getSession();
    const journalReady = await tableExists('journal_entries');
    const linesReady = await tableExists('journal_entry_lines');
    if (!journalReady || !linesReady) {
      return { period: normalizedPeriod, rows: [], totalDebit: 0, totalCredit: 0, isBalanced: true };
    }

    const result = await sql`
      SELECT
        a.id as account_id,
        a.code as account_code,
        a.name as account_name,
        COALESCE(SUM(jel.debit), 0) as total_debit,
        COALESCE(SUM(jel.credit), 0) as total_credit
      FROM journal_entries je
      JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
      JOIN accounts a ON a.id = jel.account_id
      WHERE je.tenant_id = ${session.user.tenantId}
        AND je.period = ${normalizedPeriod}
      GROUP BY a.id, a.code, a.name
      ORDER BY a.code ASC
    `;

    const rows = (result as any[]).map((row) => {
      const totalDebit = toNumber(row.total_debit);
      const totalCredit = toNumber(row.total_credit);
      return {
        accountId: row.account_id as string,
        accountCode: row.account_code as string,
        accountName: row.account_name as string,
        totalDebit,
        totalCredit,
        balance: round2(totalDebit - totalCredit),
      };
    });

    const totalDebit = round2(rows.reduce((sum, row) => sum + row.totalDebit, 0));
    const totalCredit = round2(rows.reduce((sum, row) => sum + row.totalCredit, 0));

    return {
      period: normalizedPeriod,
      rows,
      totalDebit,
      totalCredit,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
    };
  } catch (error) {
    if (isMissingRelationError(error, ['journal_entries', 'journal_entry_lines'])) {
      return { period: normalizedPeriod, rows: [], totalDebit: 0, totalCredit: 0, isBalanced: true };
    }
    console.error('[Accounting] Trial balance error:', error);
    return { period: normalizedPeriod, rows: [], totalDebit: 0, totalCredit: 0, isBalanced: true };
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
      ORDER BY date DESC
      LIMIT ${limit}
    `;

    if (category && startDate && endDate) {
      query = sql`
        SELECT * FROM expenses
        WHERE tenant_id = ${session.user.tenantId}
          AND category = ${category}
          AND date >= ${startDate}
          AND date <= ${endDate}
        ORDER BY date DESC
        LIMIT ${limit}
      `;
    } else if (category) {
      query = sql`
        SELECT * FROM expenses
        WHERE tenant_id = ${session.user.tenantId}
          AND category = ${category}
        ORDER BY date DESC
        LIMIT ${limit}
      `;
    } else if (startDate && endDate) {
      query = sql`
        SELECT * FROM expenses
        WHERE tenant_id = ${session.user.tenantId}
          AND date >= ${startDate}
          AND date <= ${endDate}
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
      amount: toNumber(row.amount),
      currency: normalizeCurrencyInput(row.currency),
      date: `${row.date as string}T00:00:00.000Z`,
      receiptUrl: (row.receipt_url as string) || undefined,
      vendor: (row.vendor as string) || undefined,
      isRecurring: Boolean(row.is_recurring),
      recurringInterval: (row.recurring_interval as Expense['recurringInterval']) || undefined,
      isTaxDeductible: Boolean(row.is_tax_deductible),
      taxAmount: toNumber(row.tax_amount),
      createdBy: row.created_by as string,
      createdAt: toIsoDate(row.created_at),
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
    const expenseDate = data.date.slice(0, 10);
    await assertPeriodWritable({
      tenantId: session.user.tenantId,
      period: periodFromDateInput(expenseDate),
      actionLabel: 'Gider kaydı',
    });

    const result = await sql`
      INSERT INTO expenses (
        tenant_id, category, description, amount, currency,
        date, receipt_url, vendor, is_recurring, recurring_interval,
        is_tax_deductible, tax_amount, created_by
      ) VALUES (
        ${session.user.tenantId}, ${data.category}, ${data.description},
        ${data.amount}, ${data.currency || 'TRY'}, ${expenseDate},
        ${data.receiptUrl || null}, ${data.vendor || null},
        ${data.isRecurring || false}, ${data.recurringInterval || null},
        ${data.isTaxDeductible !== false}, ${data.taxAmount || 0},
        ${session.user.id}
      )
      RETURNING *
    `;

    revalidatePath('/finance/expenses');
    revalidatePath('/accounting');

    const row = (result as any[])[0];
    return {
      success: true,
      expense: {
        id: row.id as string,
        tenantId: row.tenant_id as string,
        category: row.category as Expense['category'],
        description: row.description as string,
        amount: toNumber(row.amount),
        currency: normalizeCurrencyInput(row.currency),
        date: `${row.date as string}T00:00:00.000Z`,
        receiptUrl: (row.receipt_url as string) || undefined,
        vendor: (row.vendor as string) || undefined,
        isRecurring: Boolean(row.is_recurring),
        recurringInterval: (row.recurring_interval as Expense['recurringInterval']) || undefined,
        isTaxDeductible: Boolean(row.is_tax_deductible),
        taxAmount: toNumber(row.tax_amount),
        createdBy: row.created_by as string,
        createdAt: toIsoDate(row.created_at),
      },
    };
  } catch (error) {
    console.error('[Accounting] Create expense error:', error);
    return { success: false, error: 'Gider kaydedilemedi' };
  }
}

// ============================================
// Core Financial Reports
// ============================================

export async function getProfitLossReport(
  startDate: string,
  endDate: string
): Promise<ProfitLossReport | null> {
  try {
    const session = await getSession();
    const warnings: string[] = [];

    const revenue = await sql`
      SELECT
        COALESCE(SUM(total_amount), 0) as gross_revenue
      FROM orders
      WHERE tenant_id = ${session.user.tenantId}
          AND currency = 'TRY'
        AND status = 'delivered'
        AND created_at >= ${startDate}
        AND created_at <= ${endDate}
    `;

    const expenses = await sql`
      SELECT
        category,
        COALESCE(SUM(amount), 0) as total
      FROM expenses
      WHERE tenant_id = ${session.user.tenantId}
          AND currency = 'TRY'
        AND date >= ${startDate.slice(0, 10)}
        AND date <= ${endDate.slice(0, 10)}
      GROUP BY category
    `;

    const salaries = await sql`
      SELECT COALESCE(SUM(amount), 0) as total_salaries
      FROM employee_ledger_entries
      WHERE tenant_id = ${session.user.tenantId}
          AND currency = 'TRY'
        AND kind = 'salary'
        AND entry_date >= ${startDate.slice(0, 10)}
        AND entry_date <= ${endDate.slice(0, 10)}
    `;

    const depreciationResult = await sql`
      SELECT
        COALESCE(SUM(
          CASE
            WHEN is_active = false THEN 0
            WHEN disposed_date IS NOT NULL AND disposed_date < ${startDate.slice(0, 10)}::date THEN 0
            ELSE GREATEST(0, (cost - COALESCE(residual_value, 0))) / NULLIF(useful_life_months, 0)
          END
        ), 0) AS monthly_depreciation
      FROM fixed_assets
      WHERE tenant_id = ${session.user.tenantId}
        AND acquisition_date <= ${endDate.slice(0, 10)}::date
    `;

    const depreciationRows = depreciationResult as any[];
    const monthlyDepreciation = toNumber(depreciationRows[0]?.monthly_depreciation);

    const start = new Date(startDate);
    const end = new Date(endDate);
    const months = Math.max(
      1,
      (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth()) + 1
    );
    const depreciationForPeriod = round2(monthlyDepreciation * months);
    if (depreciationForPeriod === 0) {
      warnings.push('Amortisman verisi bulunamadı veya aktif sabit kıymet yok (fixed_assets).');
    }

    let costOfGoodsSold = 0;
    try {
      const cogsResult = await sql`
        SELECT
          COALESCE(SUM(-l.quantity_delta * COALESCE(l.unit_cost,0)),0) AS cogs,
          COUNT(*) FILTER (WHERE l.unit_cost IS NULL OR l.unit_cost=0) AS missing_total_price
        FROM stock_entry_lines l
        JOIN stock_entries e ON e.id=l.stock_entry_id AND e.tenant_id=l.tenant_id
        WHERE e.tenant_id=${session.user.tenantId} AND e.reference_type='shipment' AND l.quantity_delta<0
          AND e.created_at>=${startDate} AND e.created_at<=${endDate}
      `;

      const cogsRows = cogsResult as any[];
      costOfGoodsSold = toNumber(cogsRows[0]?.cogs);
      const missingCount = Number(cogsRows[0]?.missing_total_price || 0);
      if (missingCount > 0) {
        warnings.push('Sevkiyat maliyetlerinde birim maliyeti girilmemiş hareketler var; satış maliyeti eksik olabilir.');
      }
    } catch {
      warnings.push('Satış maliyeti hesaplanamadı: native stok defterine erişilemedi.');
      costOfGoodsSold = 0;
    }

    const grossRevenue = toNumber((revenue as any[])[0]?.gross_revenue);
    const totalSalaries = toNumber((salaries as any[])[0]?.total_salaries);

    const expenseMap: Record<string, number> = {};
    (expenses as { category: string; total: string }[]).forEach((expense) => {
      expenseMap[expense.category] = toNumber(expense.total);
    });

    const operatingExpenses = {
      salaries: totalSalaries,
      rent: expenseMap.rent || 0,
      utilities: expenseMap.utilities || 0,
      marketing: expenseMap.marketing || 0,
      depreciation: depreciationForPeriod,
      other: Object.entries(expenseMap)
        // Material purchases are stock: their cost reaches the P&L through cost of goods sold on shipment.
        .filter(([category]) => !['rent', 'utilities', 'marketing', 'tax', 'materials'].includes(category))
        .reduce((sum, [, value]) => sum + value, 0),
      total: 0,
    };
    operatingExpenses.total = round2(
      operatingExpenses.salaries +
        operatingExpenses.rent +
        operatingExpenses.utilities +
        operatingExpenses.marketing +
        operatingExpenses.depreciation +
        operatingExpenses.other
    );

    if (expenseMap.materials) {
      warnings.push('Malzeme alışları gider sayılmaz; maliyetleri sevkiyatta satış maliyetine yansır (alış KDV\'si KDV özetine girer).');
    }
    const grossProfit = round2(grossRevenue - costOfGoodsSold);
    const operatingProfit = round2(grossProfit - operatingExpenses.total);
    const profitBeforeTax = operatingProfit;
    const taxExpense = round2(expenseMap.tax || 0);
    warnings.push('Vergi gideri kayıtlı tax kategorisinden alınır; sabit kurumlar vergisi oranıyla tahmin yapılmaz.');
    const netProfit = round2(profitBeforeTax - taxExpense);

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
      costOfGoodsSold: round2(costOfGoodsSold),
      grossProfit,
      operatingExpenses,
      operatingProfit,
      financialIncome: 0,
      financialExpenses: 0,
      profitBeforeTax,
      taxExpense,
      netProfit,
      warnings: warnings.length > 0 ? warnings : undefined,
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
    const warnings: string[] = [];

    let cashAndBank: unknown = [{ total: '0' }];
    try {
      cashAndBank = await sql`
        SELECT COALESCE(SUM(current_balance), 0) as total
        FROM accounts
        WHERE tenant_id = ${session.user.tenantId}
          AND currency = 'TRY'
          AND type = 'asset'
          AND (code LIKE '100%' OR code LIKE '102%')
      `;
    } catch {
      warnings.push('Nakit/Banka hesapları hesaplanamadı: accounts tablosu bulunamadı veya erişilemedi.');
    }

    let receivables: unknown = [{ total: '0' }];
    try {
      receivables = await sql`
        SELECT COALESCE(SUM(remaining_amount), 0) as total
        FROM (
          SELECT
            o.id,
            o.total_amount - COALESCE(SUM(p.amount), 0) as remaining_amount
          FROM orders o
          LEFT JOIN payments p ON o.id = p.order_id AND p.tenant_id = o.tenant_id AND p.currency = o.currency
          WHERE o.tenant_id = ${session.user.tenantId}
          AND o.currency = 'TRY'
            AND o.status NOT IN ('cancelled','canceled','draft')
          GROUP BY o.id
        ) subquery
      `;
    } catch {
      warnings.push('Alacaklar hesaplanamadı: orders/payments tabloları bulunamadı veya erişilemedi.');
    }

    let inventory: unknown = [{ total: '0' }];
    try {
      inventory = await sql`
        SELECT COALESCE(SUM(b.on_hand_qty * COALESCE(c.unit_cost,0)),0) AS total
        FROM stock_balances b
        JOIN inventory_items i ON i.id=b.item_id AND i.tenant_id=b.tenant_id
        LEFT JOIN LATERAL (
          SELECT l.unit_cost FROM stock_entry_lines l
          JOIN stock_entries e ON e.id=l.stock_entry_id AND e.tenant_id=l.tenant_id
          WHERE l.tenant_id=b.tenant_id AND l.item_id=b.item_id AND l.quantity_delta>0 AND l.unit_cost IS NOT NULL
          ORDER BY e.created_at DESC,l.id DESC LIMIT 1
        ) c ON true
        WHERE b.tenant_id=${session.user.tenantId} AND i.active=true
      `;
    } catch {
      warnings.push('Stok değeri hesaplanamadı: native stok defterine erişilemedi.');
    }

    let payables: unknown = [{ total: '0' }];
    try {
      payables = await sql`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM expenses
        WHERE tenant_id = ${session.user.tenantId}
          AND currency = 'TRY'
          AND date <= ${date.slice(0, 10)}
      `;
    } catch {
      warnings.push('Borçlar hesaplanamadı: expenses tablosu bulunamadı veya erişilemedi.');
    }

    warnings.push('Stok değeri mevcut native bakiyeyi son kayıtlı birim maliyetle değerler; muhasebe maliyetleme yöntemi değildir.');
    const totalCash = toNumber((cashAndBank as any[])[0]?.total);
    const totalReceivables = toNumber((receivables as any[])[0]?.total);
    const totalInventory = toNumber((inventory as any[])[0]?.total);
    const totalPayables = toNumber((payables as any[])[0]?.total);

    const currentAssets = {
      cash: totalCash,
      bankAccounts: 0,
      accountsReceivable: totalReceivables,
      inventory: totalInventory,
      prepaidExpenses: 0,
      total: round2(totalCash + totalReceivables + totalInventory),
    };

    const currentLiabilities = {
      accountsPayable: totalPayables,
      shortTermDebt: 0,
      accruedExpenses: 0,
      taxesPayable: 0,
      total: round2(totalPayables),
    };

    const totalAssets = currentAssets.total;
    const totalLiabilities = currentLiabilities.total;
    const totalEquity = round2(totalAssets - totalLiabilities);

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
      warnings: warnings.length > 0 ? warnings : undefined,
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
    const warnings: string[] = [];

    let operatingCash: unknown = [{ total: '0' }];
    try {
      operatingCash = await sql`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM payments
        WHERE tenant_id = ${session.user.tenantId}
          AND currency = 'TRY'
          AND paid_at >= ${startDate}
          AND paid_at <= ${endDate}
      `;
    } catch {
      warnings.push('Tahsilatlar hesaplanamadı: payments tablosu bulunamadı veya erişilemedi.');
    }

    let expensePayments: unknown = [{ total: '0' }];
    try {
      expensePayments = await sql`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM expenses
        WHERE tenant_id = ${session.user.tenantId}
          AND currency = 'TRY'
          AND date >= ${startDate.slice(0, 10)}
          AND date <= ${endDate.slice(0, 10)}
      `;
    } catch {
      warnings.push('Gider ödemeleri hesaplanamadı: expenses tablosu bulunamadı veya erişilemedi.');
    }

    let salaryPayments: unknown = [{ total: '0' }];
    try {
      salaryPayments = await sql`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM employee_ledger_entries
        WHERE tenant_id = ${session.user.tenantId}
          AND currency = 'TRY'
          AND kind IN ('payment', 'advance')
          AND entry_date >= ${startDate.slice(0, 10)}
          AND entry_date <= ${endDate.slice(0, 10)}
      `;
    } catch {
      warnings.push('Maaş ödemeleri hesaplanamadı: employee_ledger_entries tablosu bulunamadı veya erişilemedi.');
    }

    const cashIn = toNumber((operatingCash as any[])[0]?.total);
    const cashOutExpenses = toNumber((expensePayments as any[])[0]?.total);
    const cashOutSalaries = toNumber((salaryPayments as any[])[0]?.total);

    const netOperatingCash = round2(cashIn - cashOutExpenses - cashOutSalaries);

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
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    console.error('[Accounting] Cash flow report error:', error);
    return null;
  }
}

// ============================================
// Tax Summary
// ============================================

export async function getTaxSummary(period: string): Promise<TaxSummary> {
  try {
    const session = await getSession();
    // Same computation as the VAT summary, so the cards and the summary never disagree.
    const v = await loadVatReturn(sql, session.user.tenantId, normalizePeriod(period));
    return { vatPayable: v.output.vat, vatReceivable: v.input.vat, netVat: v.net, withholdingTax: v.output.withheld };
  } catch (error) {
    console.error('[Accounting] Tax summary error:', error);
    return { vatPayable: 0, vatReceivable: 0, netVat: 0, withholdingTax: 0 };
  }
}

// ============================================
// Enterprise Analytics
// ============================================

export async function getReceivablesAging(asOfDate?: string): Promise<AgingReport> {
  const asOfIso = toIsoDate(asOfDate || new Date().toISOString());

  try {
    const session = await getSession();
    const ordersReady = await tableExists('orders');
    if (!ordersReady) {
      return bucketAging([], asOfIso);
    }

    const paymentsReady = await tableExists('payments');
    const asOfDateOnly = asOfIso.slice(0, 10);

    const result = paymentsReady
      ? await sql`
          SELECT
            o.id,
            o.order_number,
            o.customer_name,
            COALESCE(o.delivery_date, (o.created_at::date + ${DEFAULT_PAYMENT_TERM_DAYS} * INTERVAL '1 day')::date) as due_date,
            GREATEST(o.total_amount - COALESCE(SUM(p.amount), 0), 0) as remaining_amount
          FROM orders o
          LEFT JOIN payments p ON p.order_id = o.id AND p.tenant_id = o.tenant_id AND p.currency = o.currency
          WHERE o.tenant_id = ${session.user.tenantId}
          AND o.currency = 'TRY'
            AND o.status NOT IN ('cancelled','canceled','draft')
          GROUP BY o.id, o.order_number, o.customer_name, o.delivery_date, o.created_at, o.total_amount
          HAVING GREATEST(o.total_amount - COALESCE(SUM(p.amount), 0), 0) > 0
          ORDER BY due_date ASC
          LIMIT 300
        `
      : await sql`
          SELECT
            o.id,
            o.order_number,
            o.customer_name,
            COALESCE(o.delivery_date, (o.created_at::date + ${DEFAULT_PAYMENT_TERM_DAYS} * INTERVAL '1 day')::date) as due_date,
            o.total_amount as remaining_amount
          FROM orders o
          WHERE o.tenant_id = ${session.user.tenantId}
          AND o.currency = 'TRY'
            AND o.status NOT IN ('cancelled','canceled','draft')
            AND o.total_amount > 0
          ORDER BY due_date ASC
          LIMIT 300
        `;

    const asOf = new Date(asOfDateOnly);
    const items: AgingItem[] = (result as any[]).map((row) => {
      const dueDate = new Date(toIsoDate(row.due_date));
      return {
        id: row.id as string,
        name: row.customer_name as string,
        documentNumber: row.order_number as string,
        amount: round2(toNumber(row.remaining_amount)),
        daysOverdue: Math.max(0, diffDays(dueDate, asOf)),
        dueDate: dueDate.toISOString(),
      };
    });

    return bucketAging(items, asOfIso);
  } catch (error) {
    if (isMissingRelationError(error, ['orders', 'payments'])) {
      return bucketAging([], asOfIso);
    }
    console.error('[Accounting] Receivables aging error:', error);
    return bucketAging([], asOfIso);
  }
}

export async function getPayablesAging(asOfDate?: string): Promise<AgingReport> {
  const asOfIso = toIsoDate(asOfDate || new Date().toISOString());

  try {
    const session = await getSession();
    const expensesReady = await tableExists('expenses');
    if (!expensesReady) {
      return bucketAging([], asOfIso);
    }

    const asOfDateOnly = asOfIso.slice(0, 10);
    const result = await sql`
      SELECT
        e.id,
        COALESCE(e.vendor, 'Tedarikçi') as vendor_name,
        e.description,
        e.amount,
        e.date as due_date
      FROM expenses e
      WHERE e.tenant_id = ${session.user.tenantId}
        AND e.date <= ${asOfDateOnly}
      ORDER BY e.date ASC
      LIMIT 300
    `;

    const asOf = new Date(`${asOfDateOnly}T00:00:00.000Z`);
    const items: AgingItem[] = (result as any[]).map((row) => {
      const dueDate = new Date(toIsoDate(row.due_date));
      return {
        id: row.id as string,
        name: row.vendor_name as string,
        documentNumber: row.description as string,
        amount: round2(toNumber(row.amount)),
        daysOverdue: Math.max(0, diffDays(dueDate, asOf)),
        dueDate: dueDate.toISOString(),
      };
    });

    return bucketAging(items, asOfIso);
  } catch (error) {
    if (isMissingRelationError(error, ['expenses'])) {
      return bucketAging([], asOfIso);
    }
    console.error('[Accounting] Payables aging error:', error);
    return bucketAging([], asOfIso);
  }
}

export async function getPeriodComparison(period?: string): Promise<PeriodComparison> {
  const normalizedPeriod = normalizePeriod(period);
  const currentRange = getPeriodRange(normalizedPeriod);
  const previousPeriod = getPreviousPeriod(normalizedPeriod);
  const previousRange = getPeriodRange(previousPeriod);

  try {
    const [currentPL, previousPL, currentBS, previousBS] = await Promise.all([
      getProfitLossReport(currentRange.startDateIso, currentRange.endDateIso),
      getProfitLossReport(previousRange.startDateIso, previousRange.endDateIso),
      getBalanceSheet(currentRange.endDateIso),
      getBalanceSheet(previousRange.endDateIso),
    ]);

    const currentRevenue = currentPL?.revenue.netRevenue || 0;
    const previousRevenue = previousPL?.revenue.netRevenue || 0;
    const currentExpenses = currentPL?.operatingExpenses.total || 0;
    const previousExpenses = previousPL?.operatingExpenses.total || 0;
    const currentNetProfit = currentPL?.netProfit || 0;
    const previousNetProfit = previousPL?.netProfit || 0;
    const currentCash = currentBS?.assets.currentAssets.cash || 0;
    const previousCash = previousBS?.assets.currentAssets.cash || 0;

    return {
      period: normalizedPeriod,
      previousPeriod,
      revenueChangePct: round2(pctChange(currentRevenue, previousRevenue)),
      expenseChangePct: round2(pctChange(currentExpenses, previousExpenses)),
      netProfitChangePct: round2(pctChange(currentNetProfit, previousNetProfit)),
      cashChangePct: round2(pctChange(currentCash, previousCash)),
    };
  } catch (error) {
    console.error('[Accounting] Period comparison error:', error);
    return {
      period: normalizedPeriod,
      previousPeriod,
      revenueChangePct: 0,
      expenseChangePct: 0,
      netProfitChangePct: 0,
      cashChangePct: 0,
    };
  }
}

function buildAccountingKpis(
  range: PeriodRange,
  profitLoss: ProfitLossReport | null,
  balanceSheet: BalanceSheet | null,
  receivablesAging: AgingReport,
  payablesAging: AgingReport
): AccountingKpi {
  const revenue = profitLoss?.revenue.netRevenue || 0;
  const grossProfit = profitLoss?.grossProfit || 0;
  const operatingProfit = profitLoss?.operatingProfit || 0;
  const totalCurrentAssets = balanceSheet?.assets.currentAssets.total || 0;
  const totalCurrentLiabilities = balanceSheet?.liabilities.currentLiabilities.total || 0;
  const cash = balanceSheet?.assets.currentAssets.cash || 0;
  const operatingExpenses = profitLoss?.operatingExpenses.total || 0;

  const grossMarginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const operatingMarginPct = revenue > 0 ? (operatingProfit / revenue) * 100 : 0;
  const currentRatio = totalCurrentLiabilities > 0 ? totalCurrentAssets / totalCurrentLiabilities : totalCurrentAssets > 0 ? 999 : 0;

  const dailyRevenue = revenue > 0 ? revenue / Math.max(range.daysInPeriod, 1) : 0;
  const receivableDays = dailyRevenue > 0 ? receivablesAging.total / dailyRevenue : 0;

  const payablesCoverageRatio = payablesAging.total > 0 ? cash / payablesAging.total : cash > 0 ? 999 : 0;
  const burn = Math.max(operatingExpenses - revenue, 0);
  const cashRunwayMonths =
    burn > 0 ? Math.min(cash / burn, MAX_CASH_RUNWAY_MONTHS) : MAX_CASH_RUNWAY_MONTHS;

  return {
    grossMarginPct: round2(grossMarginPct),
    operatingMarginPct: round2(operatingMarginPct),
    currentRatio: round2(currentRatio),
    receivableDays: round2(receivableDays),
    payablesCoverageRatio: round2(payablesCoverageRatio),
    cashRunwayMonths: round2(cashRunwayMonths),
  };
}

function buildAlerts(input: {
  profitLoss: ProfitLossReport | null;
  cashFlow: CashFlowReport | null;
  taxSummary: TaxSummary;
  receivablesAging: AgingReport;
  payablesAging: AgingReport;
  bankReconciliation: BankReconciliationSummary;
  kpis: AccountingKpi;
}): string[] {
  const alerts: string[] = [];

  if ((input.profitLoss?.netProfit || 0) < 0) {
    alerts.push('Net kâr negatif. Maliyet optimizasyonu ve fiyatlama gözden geçirilmeli.');
  }
  if ((input.cashFlow?.netChangeInCash || 0) < 0) {
    alerts.push('Dönemde net nakit çıkışı var. Tahsilat hızlandırma ve ödeme planı önerilir.');
  }
  if (input.kpis.currentRatio > 0 && input.kpis.currentRatio < 1) {
    alerts.push('Cari oran 1’in altında. Kısa vadeli likidite riski oluşabilir.');
  }
  if (input.receivablesAging.overNinety > 0) {
    alerts.push('90+ gün gecikmiş alacak var. Tahsilat aksiyon planı oluşturulmalı.');
  }
  if (input.payablesAging.overNinety > 0) {
    alerts.push('90+ gün gecikmiş borç var. Tedarikçi ilişkileri için ödeme önceliklendirmesi yapın.');
  }
  if (input.taxSummary.netVat > 0) {
    alerts.push('Net KDV ödenecek görünüyor. Beyan ve ödeme tarihi için nakit planı hazırlayın.');
  }
  if (input.kpis.cashRunwayMonths <= 3) {
    alerts.push('Nakit runway 3 ayın altında. Acil finansman veya gider azaltımı değerlendirilmeli.');
  }
  if (input.bankReconciliation.unmatchedAmount > 0) {
    alerts.push(
      `Banka mutabakatında ${formatCurrencyShort(input.bankReconciliation.unmatchedAmount)} tutarında eşleşmeyen hareket var.`
    );
  }
  if (Math.abs(input.bankReconciliation.difference) > 0.01) {
    alerts.push(
      `Banka ekstresi ve muhasebe nakit hareketi arasında ${formatCurrencyShort(Math.abs(input.bankReconciliation.difference))} fark var.`
    );
  }

  return alerts;
}

function buildCloseChecklist(input: {
  profitLoss: ProfitLossReport | null;
  taxSummary: TaxSummary;
  receivablesAging: AgingReport;
  payablesAging: AgingReport;
  bankReconciliation: BankReconciliationSummary;
  capabilities: AccountingWorkspace['capabilities'];
}): CloseChecklistItem[] {
  return [
    {
      id: 'bank-reconcile',
      title: 'Banka/Kasa mutabakatı',
      status: !input.capabilities.bankReconciliation
        ? 'pending'
        : input.bankReconciliation.unmatchedLineCount > 0
          ? 'warning'
          : 'done',
      note: !input.capabilities.bankReconciliation
        ? 'Banka hareket tablosu hazır değil.'
        : input.bankReconciliation.unmatchedLineCount > 0
          ? `${input.bankReconciliation.unmatchedLineCount} banka satırı henüz eşleşmedi.`
          : 'Banka satırları mutabakatı tamamlandı.',
    },
    {
      id: 'ar-aging',
      title: 'Alacak yaşlandırma kontrolü',
      status: input.receivablesAging.overNinety > 0 ? 'warning' : 'done',
      note:
        input.receivablesAging.overNinety > 0
          ? `90+ gün gecikmiş ${round2(input.receivablesAging.overNinety)} bakiye var.`
          : 'Kritik gecikme görünmüyor.',
    },
    {
      id: 'ap-aging',
      title: 'Borç yaşlandırma kontrolü',
      status: input.payablesAging.overNinety > 0 ? 'warning' : 'done',
      note:
        input.payablesAging.overNinety > 0
          ? `90+ gün gecikmiş ${round2(input.payablesAging.overNinety)} bakiye var.`
          : 'Kritik gecikme görünmüyor.',
    },
    {
      id: 'depreciation',
      title: 'Amortisman kaydı',
      status: (input.profitLoss?.operatingExpenses.depreciation || 0) > 0 ? 'done' : 'warning',
      note:
        (input.profitLoss?.operatingExpenses.depreciation || 0) > 0
          ? 'Dönem amortismanı hesaba yansıtıldı.'
          : 'Sabit kıymet amortismanı görünmüyor.',
    },
    {
      id: 'tax-check',
      title: 'Vergi kontrolü (KDV/Stopaj)',
      status: input.capabilities.taxManagement ? 'done' : 'pending',
      note: input.capabilities.taxManagement
        ? `Net KDV: ${input.taxSummary.netVat.toFixed(2)}`
        : 'Vergi modülü hazır değil.',
    },
    {
      id: 'pl-close',
      title: 'Kâr-Zarar kapanışı',
      status: input.profitLoss ? 'done' : 'pending',
      note: input.profitLoss ? 'Dönem kâr-zarar raporu üretildi.' : 'Dönem kâr-zarar raporu üretilemedi.',
    },
  ];
}

function getDefaultBudget(period: string): AccountingBudgetPlan {
  return {
    period,
    plannedRevenue: 0,
    plannedCostOfGoodsSold: 0,
    plannedOperatingExpenses: 0,
    plannedTaxExpense: 0,
    plannedCapex: 0,
    notes: [],
  };
}

async function getBudgetPlanInternal(
  session: SessionWithTenant,
  period: string
): Promise<{ budget: AccountingBudgetPlan; hasBudget: boolean }> {
  const budgetsReady = await tableExists('accounting_budgets');
  if (!budgetsReady) {
    return { budget: getDefaultBudget(period), hasBudget: false };
  }

  try {
    const result = await sql`
      SELECT *
      FROM accounting_budgets
      WHERE tenant_id = ${session.user.tenantId}
        AND period = ${period}
      LIMIT 1
    `;

    const row = (result as any[])[0];
    if (!row) {
      return { budget: getDefaultBudget(period), hasBudget: false };
    }

    return {
      hasBudget: true,
      budget: {
        period,
        plannedRevenue: toNumber(row.planned_revenue),
        plannedCostOfGoodsSold: toNumber(row.planned_cogs),
        plannedOperatingExpenses: toNumber(row.planned_opex),
        plannedTaxExpense: toNumber(row.planned_tax),
        plannedCapex: toNumber(row.planned_capex),
        notes: Array.isArray(row.notes) ? (row.notes as string[]) : [],
      },
    };
  } catch (error) {
    if (isMissingRelationError(error, ['accounting_budgets'])) {
      return { budget: getDefaultBudget(period), hasBudget: false };
    }
    throw error;
  }
}

function buildBudgetVsActualReport(
  period: string,
  budget: AccountingBudgetPlan,
  hasBudget: boolean,
  profitLoss: ProfitLossReport | null,
  taxSummary: TaxSummary
): BudgetVsActualReport {
  const actualRevenue = profitLoss?.revenue.netRevenue || 0;
  const actualCogs = profitLoss?.costOfGoodsSold || 0;
  const actualOpex = profitLoss?.operatingExpenses.total || 0;
  const actualTaxExpense = Math.max(profitLoss?.taxExpense || 0, Math.max(taxSummary.netVat, 0));
  const actualNetProfit = profitLoss?.netProfit || 0;
  const plannedNetProfit =
    budget.plannedRevenue -
    budget.plannedCostOfGoodsSold -
    budget.plannedOperatingExpenses -
    budget.plannedTaxExpense;

  const baseRows: BudgetVsActualRow[] = [
    {
      key: 'revenue',
      label: 'Gelir',
      planned: budget.plannedRevenue,
      actual: actualRevenue,
      variance: actualRevenue - budget.plannedRevenue,
      variancePct: pctChange(actualRevenue, budget.plannedRevenue),
      betterWhen: 'higher',
    },
    {
      key: 'cogs',
      label: 'Satışların Maliyeti',
      planned: budget.plannedCostOfGoodsSold,
      actual: actualCogs,
      variance: actualCogs - budget.plannedCostOfGoodsSold,
      variancePct: pctChange(actualCogs, budget.plannedCostOfGoodsSold),
      betterWhen: 'lower',
    },
    {
      key: 'operatingExpenses',
      label: 'İşletme Giderleri',
      planned: budget.plannedOperatingExpenses,
      actual: actualOpex,
      variance: actualOpex - budget.plannedOperatingExpenses,
      variancePct: pctChange(actualOpex, budget.plannedOperatingExpenses),
      betterWhen: 'lower',
    },
    {
      key: 'taxExpense',
      label: 'Vergi Yükü',
      planned: budget.plannedTaxExpense,
      actual: actualTaxExpense,
      variance: actualTaxExpense - budget.plannedTaxExpense,
      variancePct: pctChange(actualTaxExpense, budget.plannedTaxExpense),
      betterWhen: 'lower',
    },
    {
      key: 'netProfit',
      label: 'Net Kâr',
      planned: plannedNetProfit,
      actual: actualNetProfit,
      variance: actualNetProfit - plannedNetProfit,
      variancePct: pctChange(actualNetProfit, plannedNetProfit),
      betterWhen: 'higher',
    },
  ];

  const rows: BudgetVsActualRow[] = baseRows.map((row): BudgetVsActualRow => ({
    ...row,
    planned: round2(row.planned),
    actual: round2(row.actual),
    variance: round2(row.variance),
    variancePct: round2(row.variancePct),
  }));

  return {
    period,
    hasBudget,
    rows,
    totalPlannedProfit: round2(plannedNetProfit),
    totalActualProfit: round2(actualNetProfit),
    profitVariance: round2(actualNetProfit - plannedNetProfit),
    profitVariancePct: round2(pctChange(actualNetProfit, plannedNetProfit)),
  };
}

export async function getBudgetPlan(period?: string): Promise<AccountingBudgetPlan> {
  try {
    const session = await getSession();
    const normalizedPeriod = normalizePeriod(period);
    const { budget } = await getBudgetPlanInternal(session, normalizedPeriod);
    return budget;
  } catch (error) {
    console.error('[Accounting] Get budget plan error:', error);
    return getDefaultBudget(normalizePeriod(period));
  }
}

export async function upsertAccountingBudget(
  input: UpsertAccountingBudgetInput
): Promise<{ success: boolean; budget?: AccountingBudgetPlan; error?: string }> {
  try {
    const session = await getSession();
    const period = normalizePeriod(input.period);
    const budgetsReady = await tableExists('accounting_budgets');

    if (!budgetsReady) {
      return {
        success: false,
        error: 'Bütçe tabloları hazır değil. Önce migrationları uygulayın.',
      };
    }

    const normalized = {
      plannedRevenue: Math.max(0, round2(toNumber(input.plannedRevenue))),
      plannedCostOfGoodsSold: Math.max(0, round2(toNumber(input.plannedCostOfGoodsSold))),
      plannedOperatingExpenses: Math.max(0, round2(toNumber(input.plannedOperatingExpenses))),
      plannedTaxExpense: Math.max(0, round2(toNumber(input.plannedTaxExpense || 0))),
      plannedCapex: Math.max(0, round2(toNumber(input.plannedCapex || 0))),
      notes: (input.notes || []).filter(Boolean).slice(0, 20),
    };

    await sql`
      INSERT INTO accounting_budgets (
        tenant_id,
        period,
        planned_revenue,
        planned_cogs,
        planned_opex,
        planned_tax,
        planned_capex,
        notes,
        created_by,
        updated_by
      ) VALUES (
        ${session.user.tenantId},
        ${period},
        ${normalized.plannedRevenue},
        ${normalized.plannedCostOfGoodsSold},
        ${normalized.plannedOperatingExpenses},
        ${normalized.plannedTaxExpense},
        ${normalized.plannedCapex},
        ${normalized.notes},
        ${session.user.id},
        ${session.user.id}
      )
      ON CONFLICT (tenant_id, period)
      DO UPDATE SET
        planned_revenue = EXCLUDED.planned_revenue,
        planned_cogs = EXCLUDED.planned_cogs,
        planned_opex = EXCLUDED.planned_opex,
        planned_tax = EXCLUDED.planned_tax,
        planned_capex = EXCLUDED.planned_capex,
        notes = EXCLUDED.notes,
        updated_by = EXCLUDED.updated_by,
        updated_at = timezone('utc'::text, now())
    `;

    revalidatePath('/accounting');

    return {
      success: true,
      budget: {
        period,
        plannedRevenue: normalized.plannedRevenue,
        plannedCostOfGoodsSold: normalized.plannedCostOfGoodsSold,
        plannedOperatingExpenses: normalized.plannedOperatingExpenses,
        plannedTaxExpense: normalized.plannedTaxExpense,
        plannedCapex: normalized.plannedCapex,
        notes: normalized.notes,
      },
    };
  } catch (error) {
    console.error('[Accounting] Upsert budget error:', error);
    return { success: false, error: 'Bütçe kaydedilemedi' };
  }
}

export async function getBudgetVsActual(period?: string): Promise<BudgetVsActualReport> {
  try {
    const session = await getSession();
    const normalizedPeriod = normalizePeriod(period);
    const range = getPeriodRange(normalizedPeriod);
    const [{ budget, hasBudget }, profitLoss, taxSummary] = await Promise.all([
      getBudgetPlanInternal(session, normalizedPeriod),
      getProfitLossReport(range.startDateIso, range.endDateIso),
      getTaxSummary(normalizedPeriod),
    ]);

    return buildBudgetVsActualReport(normalizedPeriod, budget, hasBudget, profitLoss, taxSummary);
  } catch (error) {
    console.error('[Accounting] Budget vs actual error:', error);
    const fallbackPeriod = normalizePeriod(period);
    return buildBudgetVsActualReport(
      fallbackPeriod,
      getDefaultBudget(fallbackPeriod),
      false,
      null,
      { vatPayable: 0, vatReceivable: 0, netVat: 0, withholdingTax: 0 }
    );
  }
}

export async function getCashFlowForecast(
  period?: string,
  monthsAhead: number = FORECAST_MONTHS_DEFAULT
): Promise<CashForecastReport> {
  try {
    const session = await getSession();
    const normalizedPeriod = normalizePeriod(period);
    const cappedMonths = Math.min(Math.max(monthsAhead, 3), 12);
    const historyStartPeriod = addMonthsToPeriod(normalizedPeriod, -11);
    const historyRange = getPeriodRange(historyStartPeriod);
    const currentRange = getPeriodRange(normalizedPeriod);

    const [paymentsReady, expensesReady, ledgerReady] = await Promise.all([
      tableExists('payments'),
      tableExists('expenses'),
      tableExists('employee_ledger_entries'),
    ]);

    const [balanceSheet, inflowRows, expenseRows, payrollRows] = await Promise.all([
      getBalanceSheet(currentRange.endDateIso),
      paymentsReady
        ? sql`
            SELECT
              to_char(date_trunc('month', paid_at), 'YYYY-MM') as period,
              COALESCE(SUM(amount), 0) as total
            FROM payments
            WHERE tenant_id = ${session.user.tenantId}
          AND currency = 'TRY'
              AND paid_at >= ${historyRange.startDateIso}
              AND paid_at <= ${currentRange.endDateIso}
            GROUP BY 1
          `
        : ([] as unknown as any[]),
      expensesReady
        ? sql`
            SELECT
              to_char(date_trunc('month', date::timestamp), 'YYYY-MM') as period,
              COALESCE(SUM(amount), 0) as total
            FROM expenses
            WHERE tenant_id = ${session.user.tenantId}
          AND currency = 'TRY'
              AND date >= ${historyRange.startDate}
              AND date <= ${currentRange.endDate}
            GROUP BY 1
          `
        : ([] as unknown as any[]),
      ledgerReady
        ? sql`
            SELECT
              to_char(date_trunc('month', entry_date::timestamp), 'YYYY-MM') as period,
              COALESCE(SUM(amount), 0) as total
            FROM employee_ledger_entries
            WHERE tenant_id = ${session.user.tenantId}
          AND currency = 'TRY'
              AND kind IN ('payment', 'advance')
              AND entry_date >= ${historyRange.startDate}
              AND entry_date <= ${currentRange.endDate}
            GROUP BY 1
          `
        : ([] as unknown as any[]),
    ]);

    const inflowMap = new Map<string, number>(
      (inflowRows as any[]).map((row) => [row.period as string, toNumber(row.total)])
    );
    const expenseMap = new Map<string, number>(
      (expenseRows as any[]).map((row) => [row.period as string, toNumber(row.total)])
    );
    const payrollMap = new Map<string, number>(
      (payrollRows as any[]).map((row) => [row.period as string, toNumber(row.total)])
    );

    const historyPeriods = Array.from({ length: 6 }, (_, index) => addMonthsToPeriod(normalizedPeriod, -(5 - index)));
    const inflowHistory = historyPeriods.map((value) => inflowMap.get(value) || 0);
    const outflowHistory = historyPeriods.map(
      (value) => (expenseMap.get(value) || 0) + (payrollMap.get(value) || 0)
    );

    const avgInflow = round2(average(inflowHistory));
    const avgOutflow = round2(average(outflowHistory));

    let runningCash = round2(balanceSheet?.assets.currentAssets.cash || 0);
    const points: CashForecastPoint[] = [];

    for (let index = 1; index <= cappedMonths; index += 1) {
      const pointPeriod = addMonthsToPeriod(normalizedPeriod, index);
      const conservativeFactor = 1 + Math.min(index * 0.0125, 0.1);
      const projectedInflow = round2(avgInflow);
      const projectedOutflow = round2(avgOutflow * conservativeFactor);
      const projectedNet = round2(projectedInflow - projectedOutflow);
      runningCash = round2(runningCash + projectedNet);
      const confidencePct = Math.max(35, 90 - index * 8);

      points.push({
        period: pointPeriod,
        projectedInflow,
        projectedOutflow,
        projectedNet,
        projectedEndingCash: runningCash,
        confidencePct,
      });
    }

    return {
      startingCash: round2(balanceSheet?.assets.currentAssets.cash || 0),
      averageMonthlyInflow: avgInflow,
      averageMonthlyOutflow: avgOutflow,
      points,
    };
  } catch (error) {
    console.error('[Accounting] Cash forecast error:', error);
    return {
      startingCash: 0,
      averageMonthlyInflow: 0,
      averageMonthlyOutflow: 0,
      points: [],
    };
  }
}

// ============================================
// Bank Reconciliation
// ============================================

function getEmptyBankReconciliation(period: string): BankReconciliationSummary {
  return {
    period,
    hasData: false,
    importedLineCount: 0,
    matchedLineCount: 0,
    unmatchedLineCount: 0,
    ignoredLineCount: 0,
    statementInflow: 0,
    statementOutflow: 0,
    statementNet: 0,
    booksNet: 0,
    difference: 0,
    matchedAmount: 0,
    unmatchedAmount: 0,
    matchRatePct: 0,
    items: [],
  };
}

type BankStatementLineRow = {
  id: string;
  statement_date: string;
  description: string;
  amount: number | string;
  reference?: string | null;
  reconciliation_status: 'unmatched' | 'matched' | 'ignored';
};

type BankMatchSuggestion = {
  matchType: 'payment' | 'expense';
  matchId: string;
  label: string;
};

async function findBankMatchSuggestion(
  session: SessionWithTenant,
  line: BankStatementLineRow,
  options: {
    paymentsReady: boolean;
    expensesReady: boolean;
  }
): Promise<BankMatchSuggestion | null> {
  const amount = round2(toNumber(line.amount));
  const absAmount = round2(Math.abs(amount));
  const statementDate = toIsoDate(line.statement_date).slice(0, 10);
  if (absAmount < 0.01) {
    return null;
  }

  if (amount > 0 && options.paymentsReady) {
    const paymentResult = await sql`
      SELECT
        p.id,
        p.paid_at
      FROM payments p
      LEFT JOIN bank_statement_lines bsl
        ON bsl.tenant_id = p.tenant_id
        AND bsl.matched_payment_id = p.id
        AND bsl.reconciliation_status = 'matched'
      WHERE p.tenant_id = ${session.user.tenantId}
          AND p.currency = 'TRY'
        AND bsl.id IS NULL
        AND abs(p.amount - ${absAmount}) < 0.01
        AND p.paid_at::date BETWEEN (${statementDate}::date - INTERVAL '3 day')
        AND (${statementDate}::date + INTERVAL '3 day')
      ORDER BY abs(p.paid_at::date - ${statementDate}::date) ASC, p.paid_at DESC
      LIMIT 1
    `;

    const payment = (paymentResult as any[])[0];
    if (payment?.id) {
      return {
        matchType: 'payment',
        matchId: payment.id as string,
        label: `Tahsilat · ${new Date(payment.paid_at).toLocaleDateString('tr-TR')}`,
      };
    }
  }

  if (amount < 0 && options.expensesReady) {
    const expenseResult = await sql`
      SELECT
        e.id,
        e.date,
        COALESCE(e.vendor, e.description) as label
      FROM expenses e
      LEFT JOIN bank_statement_lines bsl
        ON bsl.tenant_id = e.tenant_id
        AND bsl.matched_expense_id = e.id
        AND bsl.reconciliation_status = 'matched'
      WHERE e.tenant_id = ${session.user.tenantId}
          AND e.currency = 'TRY'
        AND bsl.id IS NULL
        AND abs(e.amount - ${absAmount}) < 0.01
        AND e.date BETWEEN (${statementDate}::date - INTERVAL '3 day')
        AND (${statementDate}::date + INTERVAL '3 day')
      ORDER BY abs(e.date - ${statementDate}::date) ASC, e.created_at DESC
      LIMIT 1
    `;

    const expense = (expenseResult as any[])[0];
    if (expense?.id) {
      return {
        matchType: 'expense',
        matchId: expense.id as string,
        label: `${expense.label as string} · ${new Date(toIsoDate(expense.date)).toLocaleDateString('tr-TR')}`,
      };
    }
  }

  return null;
}

function mapBankStatementItem(
  row: BankStatementLineRow,
  suggestion?: BankMatchSuggestion | null
): BankReconciliationItem {
  return {
    id: row.id,
    statementDate: `${row.statement_date}T00:00:00.000Z`,
    description: row.description,
    amount: round2(toNumber(row.amount)),
    status: row.reconciliation_status,
    reference: row.reference || undefined,
    suggestedMatchType: suggestion?.matchType,
    suggestedMatchId: suggestion?.matchId,
    suggestedLabel: suggestion?.label,
  };
}

export async function importBankStatementLines(
  input: ImportBankStatementInput
): Promise<{ success: boolean; importedCount: number; error?: string }> {
  try {
    const session = await getSession();
    const reconciliationTableReady = await tableExists('bank_statement_lines');
    if (!reconciliationTableReady) {
      return {
        success: false,
        importedCount: 0,
        error: 'Banka mutabakat tablosu hazır değil. Önce migrationları uygulayın.',
      };
    }

    if (!input.lines || input.lines.length === 0) {
      return { success: false, importedCount: 0, error: 'En az bir satır girilmelidir.' };
    }
    if (input.lines.length > 1000) {
      return { success: false, importedCount: 0, error: 'Tek seferde en fazla 1000 satır aktarılabilir.' };
    }

    const normalizedLines = input.lines.map((line) => {
      const statementDate = line.statementDate?.slice(0, 10);
      const parsedDate = statementDate ? new Date(`${statementDate}T00:00:00.000Z`) : new Date('invalid');
      const amount = round2(toNumber(line.amount));
      return {
        statementDate,
        parsedDate,
        description: line.description?.trim() || '',
        amount,
        reference: line.reference?.trim() || null,
        externalId: line.externalId?.trim() || null,
        accountId: line.accountId || input.accountId || null,
      };
    });

    if (normalizedLines.some((line) => Number.isNaN(line.parsedDate.getTime()))) {
      return { success: false, importedCount: 0, error: 'Geçersiz statement tarihi bulundu.' };
    }
    if (normalizedLines.some((line) => !line.description)) {
      return { success: false, importedCount: 0, error: 'Açıklama zorunludur.' };
    }
    if (normalizedLines.some((line) => Math.abs(line.amount) < 0.01)) {
      return { success: false, importedCount: 0, error: 'Tutar 0 olamaz.' };
    }

    const periods = [...new Set(normalizedLines.map((line) => periodFromDateInput(line.statementDate as string)))];
    for (const period of periods) {
      await assertPeriodWritable({
        tenantId: session.user.tenantId,
        period,
        actionLabel: 'Banka mutabakat satırı kaydı',
      });
    }

    const accountIds = [...new Set(normalizedLines.map((line) => line.accountId).filter(Boolean))] as string[];
    for (const accountId of accountIds) {
      const accountResult = await sql`
        SELECT id, is_bank_account
        FROM accounts
        WHERE id = ${accountId}
          AND tenant_id = ${session.user.tenantId}
        LIMIT 1
      `;
      const account = (accountResult as any[])[0];
      if (!account?.id) {
        return { success: false, importedCount: 0, error: 'Geçersiz banka hesabı seçildi.' };
      }
      if (!account.is_bank_account) {
        return { success: false, importedCount: 0, error: 'Seçilen hesap banka hesabı olarak işaretli değil.' };
      }
    }

    let importedCount = 0;
    await sql.begin(async (tx: any) => {
      for (const line of normalizedLines) {
        if (line.externalId && line.accountId) {
          await tx`
            INSERT INTO bank_statement_lines (
              tenant_id,
              account_id,
              source,
              external_id,
              statement_date,
              description,
              reference,
              amount,
              currency,
              reconciliation_status,
              matched_payment_id,
              matched_expense_id,
              matched_at,
              note,
              imported_by
            ) VALUES (
              ${session.user.tenantId},
              ${line.accountId},
              'manual_import',
              ${line.externalId},
              ${line.statementDate},
              ${line.description},
              ${line.reference},
              ${line.amount},
              'TRY',
              'unmatched',
              null,
              null,
              null,
              null,
              ${session.user.id}
            )
            ON CONFLICT (tenant_id, account_id, external_id)
            WHERE external_id IS NOT NULL
            DO UPDATE SET
              statement_date = EXCLUDED.statement_date,
              description = EXCLUDED.description,
              reference = EXCLUDED.reference,
              amount = EXCLUDED.amount,
              reconciliation_status = 'unmatched',
              matched_payment_id = NULL,
              matched_expense_id = NULL,
              matched_at = NULL,
              updated_at = timezone('utc'::text, now())
          `;
        } else {
          await tx`
            INSERT INTO bank_statement_lines (
              tenant_id,
              account_id,
              source,
              external_id,
              statement_date,
              description,
              reference,
              amount,
              currency,
              reconciliation_status,
              imported_by
            ) VALUES (
              ${session.user.tenantId},
              ${line.accountId},
              'manual_import',
              ${line.externalId},
              ${line.statementDate},
              ${line.description},
              ${line.reference},
              ${line.amount},
              'TRY',
              'unmatched',
              ${session.user.id}
            )
          `;
        }
        importedCount += 1;
      }
    });

    revalidatePath('/accounting');
    return { success: true, importedCount };
  } catch (error) {
    console.error('[Accounting] Import bank statement lines error:', error);
    return { success: false, importedCount: 0, error: 'Banka hareketleri aktarılırken hata oluştu.' };
  }
}

export async function autoMatchBankStatementLines(
  period?: string
): Promise<{ success: boolean; matchedCount: number; error?: string }> {
  try {
    const session = await getSession();
    const normalizedPeriod = normalizePeriod(period);
    const range = getPeriodRange(normalizedPeriod);
    const reconciliationTableReady = await tableExists('bank_statement_lines');
    if (!reconciliationTableReady) {
      return {
        success: false,
        matchedCount: 0,
        error: 'Banka mutabakat tablosu hazır değil.',
      };
    }

    await assertPeriodWritable({
      tenantId: session.user.tenantId,
      period: normalizedPeriod,
      actionLabel: 'Banka eşleştirme',
    });

    const [paymentsReady, expensesReady] = await Promise.all([
      tableExists('payments'),
      tableExists('expenses'),
    ]);

    const lineResult = await sql`
      SELECT
        id,
        statement_date,
        description,
        reference,
        amount,
        reconciliation_status
      FROM bank_statement_lines
      WHERE tenant_id = ${session.user.tenantId}
        AND currency = 'TRY'
        AND statement_date >= ${range.startDate}
        AND statement_date <= ${range.endDate}
        AND reconciliation_status = 'unmatched'
      ORDER BY statement_date ASC
      LIMIT 500
    `;
    const lines = lineResult as BankStatementLineRow[];

    let matchedCount = 0;
    for (const line of lines) {
      const suggestion = await findBankMatchSuggestion(session, line, {
        paymentsReady,
        expensesReady,
      });
      if (!suggestion) {
        continue;
      }

      await sql`
        UPDATE bank_statement_lines
        SET
          reconciliation_status = 'matched',
          matched_payment_id = ${suggestion.matchType === 'payment' ? suggestion.matchId : null},
          matched_expense_id = ${suggestion.matchType === 'expense' ? suggestion.matchId : null},
          matched_at = timezone('utc'::text, now()),
          updated_at = timezone('utc'::text, now())
        WHERE id = ${line.id}
          AND tenant_id = ${session.user.tenantId}
          AND reconciliation_status = 'unmatched'
      `;
      matchedCount += 1;
    }

    revalidatePath('/accounting');
    return { success: true, matchedCount };
  } catch (error) {
    console.error('[Accounting] Auto match bank statement lines error:', error);
    return { success: false, matchedCount: 0, error: 'Otomatik eşleştirme başarısız oldu.' };
  }
}

export async function setBankStatementLineMatch(
  input: SetBankStatementLineMatchInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    const reconciliationTableReady = await tableExists('bank_statement_lines');
    if (!reconciliationTableReady) {
      return { success: false, error: 'Banka mutabakat tablosu hazır değil.' };
    }

    const lineResult = await sql`
      SELECT id, statement_date, amount
      FROM bank_statement_lines
      WHERE id = ${input.lineId}
        AND tenant_id = ${session.user.tenantId}
        AND currency = 'TRY'
      LIMIT 1
    `;
    const line = (lineResult as any[])[0];
    if (!line?.id) {
      return { success: false, error: 'Banka satırı bulunamadı.' };
    }

    await assertPeriodWritable({
      tenantId: session.user.tenantId,
      period: periodFromDateInput(line.statement_date as string),
      actionLabel: 'Mutabakat düzeltme',
    });

    if (input.matchType === 'ignored') {
      await sql`
        UPDATE bank_statement_lines
        SET
          reconciliation_status = 'ignored',
          matched_payment_id = NULL,
          matched_expense_id = NULL,
          matched_at = timezone('utc'::text, now()),
          updated_at = timezone('utc'::text, now())
        WHERE id = ${input.lineId}
          AND tenant_id = ${session.user.tenantId}
      `;
      revalidatePath('/accounting');
      return { success: true };
    }

    if (input.matchType === 'unmatched') {
      await sql`
        UPDATE bank_statement_lines
        SET
          reconciliation_status = 'unmatched',
          matched_payment_id = NULL,
          matched_expense_id = NULL,
          matched_at = NULL,
          updated_at = timezone('utc'::text, now())
        WHERE id = ${input.lineId}
          AND tenant_id = ${session.user.tenantId}
      `;
      revalidatePath('/accounting');
      return { success: true };
    }

    if (!input.matchId) {
      return { success: false, error: 'Eşleştirme kaydı seçilmedi.' };
    }

    const lineAmount = round2(toNumber(line.amount));
    const absLineAmount = round2(Math.abs(lineAmount));

    if (input.matchType === 'payment') {
      const paymentResult = await sql`
        SELECT id, amount
        FROM payments
        WHERE id = ${input.matchId}
          AND tenant_id = ${session.user.tenantId}
          AND currency = 'TRY'
        LIMIT 1
      `;
      const payment = (paymentResult as any[])[0];
      if (!payment?.id) {
        return { success: false, error: 'Ödeme bulunamadı.' };
      }
      if (lineAmount <= 0 || Math.abs(toNumber(payment.amount) - absLineAmount) >= 0.01) {
        return { success: false, error: 'Ödeme tutarı banka satırı ile uyumsuz.' };
      }

      await sql`
        UPDATE bank_statement_lines
        SET
          reconciliation_status = 'matched',
          matched_payment_id = ${input.matchId},
          matched_expense_id = NULL,
          matched_at = timezone('utc'::text, now()),
          updated_at = timezone('utc'::text, now())
        WHERE id = ${input.lineId}
          AND tenant_id = ${session.user.tenantId}
      `;
    }

    if (input.matchType === 'expense') {
      const expenseResult = await sql`
        SELECT id, amount
        FROM expenses
        WHERE id = ${input.matchId}
          AND tenant_id = ${session.user.tenantId}
          AND currency = 'TRY'
        LIMIT 1
      `;
      const expense = (expenseResult as any[])[0];
      if (!expense?.id) {
        return { success: false, error: 'Gider bulunamadı.' };
      }
      if (lineAmount >= 0 || Math.abs(toNumber(expense.amount) - absLineAmount) >= 0.01) {
        return { success: false, error: 'Gider tutarı banka satırı ile uyumsuz.' };
      }

      await sql`
        UPDATE bank_statement_lines
        SET
          reconciliation_status = 'matched',
          matched_payment_id = NULL,
          matched_expense_id = ${input.matchId},
          matched_at = timezone('utc'::text, now()),
          updated_at = timezone('utc'::text, now())
        WHERE id = ${input.lineId}
          AND tenant_id = ${session.user.tenantId}
      `;
    }

    revalidatePath('/accounting');
    return { success: true };
  } catch (error) {
    console.error('[Accounting] Set bank statement line match error:', error);
    return { success: false, error: 'Mutabakat güncellenemedi.' };
  }
}

export async function getBankReconciliationSummary(period?: string): Promise<BankReconciliationSummary> {
  const normalizedPeriod = normalizePeriod(period);
  const fallback = getEmptyBankReconciliation(normalizedPeriod);

  try {
    const session = await getSession();
    const range = getPeriodRange(normalizedPeriod);
    const reconciliationTableReady = await tableExists('bank_statement_lines');
    if (!reconciliationTableReady) {
      return fallback;
    }

    const [paymentsReady, expensesReady, ledgerReady] = await Promise.all([
      tableExists('payments'),
      tableExists('expenses'),
      tableExists('employee_ledger_entries'),
    ]);

    const [lineResult, paymentsResult, expensesResult, payrollResult] = await Promise.all([
      sql`
        SELECT
          id,
          statement_date,
          description,
          reference,
          amount,
          reconciliation_status
        FROM bank_statement_lines
        WHERE tenant_id = ${session.user.tenantId}
        AND currency = 'TRY'
          AND statement_date >= ${range.startDate}
          AND statement_date <= ${range.endDate}
        ORDER BY statement_date DESC, created_at DESC
        LIMIT 500
      `,
      paymentsReady
        ? sql`
            SELECT COALESCE(SUM(amount), 0) as total
            FROM payments
            WHERE tenant_id = ${session.user.tenantId}
          AND currency = 'TRY'
              AND paid_at >= ${range.startDateIso}
              AND paid_at <= ${range.endDateIso}
          `
        : ([{ total: 0 }] as unknown as any[]),
      expensesReady
        ? sql`
            SELECT COALESCE(SUM(amount), 0) as total
            FROM expenses
            WHERE tenant_id = ${session.user.tenantId}
          AND currency = 'TRY'
              AND date >= ${range.startDate}
              AND date <= ${range.endDate}
          `
        : ([{ total: 0 }] as unknown as any[]),
      ledgerReady
        ? sql`
            SELECT COALESCE(SUM(amount), 0) as total
            FROM employee_ledger_entries
            WHERE tenant_id = ${session.user.tenantId}
          AND currency = 'TRY'
              AND kind IN ('payment', 'advance')
              AND entry_date >= ${range.startDate}
              AND entry_date <= ${range.endDate}
          `
        : ([{ total: 0 }] as unknown as any[]),
    ]);

    const lines = lineResult as BankStatementLineRow[];
    const importedLineCount = lines.length;
    const matchedLines = lines.filter((line) => line.reconciliation_status === 'matched');
    const unmatchedLines = lines.filter((line) => line.reconciliation_status === 'unmatched');
    const ignoredLines = lines.filter((line) => line.reconciliation_status === 'ignored');

    const statementInflow = round2(
      lines.filter((line) => toNumber(line.amount) > 0).reduce((sum, line) => sum + toNumber(line.amount), 0)
    );
    const statementOutflow = round2(
      Math.abs(
        lines.filter((line) => toNumber(line.amount) < 0).reduce((sum, line) => sum + toNumber(line.amount), 0)
      )
    );
    const statementNet = round2(statementInflow - statementOutflow);

    const matchedAmount = round2(matchedLines.reduce((sum, line) => sum + Math.abs(toNumber(line.amount)), 0));
    const unmatchedAmount = round2(unmatchedLines.reduce((sum, line) => sum + Math.abs(toNumber(line.amount)), 0));
    const matchRatePct =
      importedLineCount > 0 ? round2((matchedLines.length / importedLineCount) * 100) : 0;

    const paymentsTotal = toNumber((paymentsResult as any[])[0]?.total);
    const expensesTotal = toNumber((expensesResult as any[])[0]?.total);
    const payrollTotal = toNumber((payrollResult as any[])[0]?.total);
    const booksNet = round2(paymentsTotal - expensesTotal - payrollTotal);
    const difference = round2(booksNet - statementNet);

    const focusLines = unmatchedLines.slice(0, 12);
    const items: BankReconciliationItem[] = [];
    for (const line of focusLines) {
      const suggestion = await findBankMatchSuggestion(session, line, {
        paymentsReady,
        expensesReady,
      });
      items.push(mapBankStatementItem(line, suggestion));
    }

    return {
      period: normalizedPeriod,
      hasData: importedLineCount > 0,
      importedLineCount,
      matchedLineCount: matchedLines.length,
      unmatchedLineCount: unmatchedLines.length,
      ignoredLineCount: ignoredLines.length,
      statementInflow,
      statementOutflow,
      statementNet,
      booksNet,
      difference,
      matchedAmount,
      unmatchedAmount,
      matchRatePct,
      items,
    };
  } catch (error) {
    if (isMissingRelationError(error, ['bank_statement_lines'])) {
      return fallback;
    }
    console.error('[Accounting] Bank reconciliation summary error:', error);
    return fallback;
  }
}

async function getPeriodCloseStateInternal(
  session: SessionWithTenant,
  period: string
): Promise<PeriodCloseState> {
  const closeTableReady = await tableExists('accounting_period_closes');
  if (!closeTableReady) {
    return { period, status: 'open', locked: false };
  }

  try {
    const result = await sql`
      SELECT
        apc.*,
        COALESCE(u.name, 'Sistem') as closed_by_name
      FROM accounting_period_closes apc
      LEFT JOIN users u ON u.id = apc.closed_by
      WHERE apc.tenant_id = ${session.user.tenantId}
        AND apc.period = ${period}
      LIMIT 1
    `;
    const row = (result as any[])[0];
    if (!row) {
      return { period, status: 'open', locked: false };
    }

    const status = row.status as PeriodCloseState['status'];
    return {
      period,
      status,
      locked: status === 'hard_closed',
      closedAt: row.closed_at ? toIsoDate(row.closed_at) : undefined,
      closedByName: (row.closed_by_name as string) || undefined,
    };
  } catch (error) {
    if (isMissingRelationError(error, ['accounting_period_closes'])) {
      return { period, status: 'open', locked: false };
    }
    throw error;
  }
}

export async function setPeriodCloseStatus(
  input: SetPeriodCloseInput
): Promise<{ success: boolean; state?: PeriodCloseState; error?: string }> {
  try {
    const session = await getSession();
    if (!['owner','admin'].includes(session.user.role)) return {success:false,error:'Dönem durumunu firma yöneticisi değiştirebilir.'};
    input=z.object({period:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),status:z.enum(['open','soft_closed','hard_closed']),note:z.string().max(2000).optional()}).parse(input);
    const period = normalizePeriod(input.period);
    const closeTableReady = await tableExists('accounting_period_closes');
    if (!closeTableReady) {
      return { success: false, error: 'Dönem kapanış tablosu hazır değil.' };
    }

    // The status change and its audit record commit together: a period close without a trace
    // (or a trace without the close) must not exist.
    await sql.begin(async (tx: any) => {
      const [previous] = await tx`
        SELECT status FROM accounting_period_closes
        WHERE tenant_id = ${session.user.tenantId} AND period = ${period}
        FOR UPDATE
      `;
      await tx`
        INSERT INTO accounting_period_closes (
          tenant_id,
          period,
          status,
          closed_note,
          closed_by,
          closed_at
        ) VALUES (
          ${session.user.tenantId},
          ${period},
          ${input.status},
          ${input.note || null},
          ${session.user.id},
          ${input.status === 'open' ? null : new Date().toISOString()}
        )
        ON CONFLICT (tenant_id, period)
        DO UPDATE SET
          status = EXCLUDED.status,
          closed_note = EXCLUDED.closed_note,
          closed_by = EXCLUDED.closed_by,
          closed_at = EXCLUDED.closed_at,
          updated_at = timezone('utc'::text, now())
      `;
      await recordAudit(tx, {
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        entityType: 'accounting_period',
        entityId: session.user.tenantId,
        action: 'period_status_changed',
        changes: { status: { from: previous?.status ?? 'open', to: input.status } },
        note: input.note || null,
        metadata: { period },
      });
    });

    const state = await getPeriodCloseStateInternal(session, period);
    revalidatePath('/accounting');
    return { success: true, state };
  } catch (error) {
    console.error('[Accounting] Set period close status error:', error);
    return { success: false, error: 'Dönem kapanış durumu güncellenemedi' };
  }
}

function buildComplianceSummary(input: {
  period: string;
  closeChecklist: CloseChecklistItem[];
  kpis: AccountingKpi;
  trialBalance: TrialBalanceReport;
  budgetVsActual: BudgetVsActualReport;
  receivablesAging: AgingReport;
  bankReconciliation: BankReconciliationSummary;
  taxSummary: TaxSummary;
  periodCloseState: PeriodCloseState;
}): ComplianceSummary {
  const issues: ComplianceIssue[] = [];

  if (!input.trialBalance.isBalanced) {
    issues.push({
      code: 'GL_UNBALANCED',
      title: 'Büyük Defter Dengesi Bozuk',
      detail: `Borç (${input.trialBalance.totalDebit}) ve alacak (${input.trialBalance.totalCredit}) eşit değil.`,
      severity: 'critical',
      recommendation: 'Yevmiye satırlarını kontrol edip eşitlik sağlanmalı.',
    });
  }

  const checklistWarnings = input.closeChecklist.filter((item) => item.status !== 'done').length;
  if (checklistWarnings > 0) {
    issues.push({
      code: 'CLOSE_CHECKLIST_PENDING',
      title: 'Dönem Kapanış Adımları Eksik',
      detail: `${checklistWarnings} kapanış adımı tamamlanmadı.`,
      severity: checklistWarnings >= 3 ? 'critical' : 'warning',
      recommendation: 'Kapanış checklist adımlarını tamamlayın.',
    });
  }

  if (input.kpis.currentRatio > 0 && input.kpis.currentRatio < 1) {
    issues.push({
      code: 'LOW_CURRENT_RATIO',
      title: 'Likidite Riski',
      detail: `Cari oran ${input.kpis.currentRatio.toFixed(2)} seviyesinde.`,
      severity: 'critical',
      recommendation: 'Kısa vadeli borçlar için nakit planı ve tahsilat hızlandırması yapın.',
    });
  }

  const overdueShare =
    input.receivablesAging.total > 0 ? input.receivablesAging.overNinety / input.receivablesAging.total : 0;
  if (overdueShare >= 0.25) {
    issues.push({
      code: 'AR_90_PLUS_HIGH',
      title: 'Yüksek Gecikmiş Alacak',
      detail: `90+ gün gecikmiş alacak oranı %${(overdueShare * 100).toFixed(1)}.`,
      severity: overdueShare >= 0.4 ? 'critical' : 'warning',
      recommendation: 'Tahsilat planı, müşteri kredi limiti ve vadeleri gözden geçirin.',
    });
  }

  if (input.budgetVsActual.hasBudget && input.budgetVsActual.profitVariancePct < -20) {
    issues.push({
      code: 'BUDGET_PROFIT_GAP',
      title: 'Bütçe Kârlılık Sapması',
      detail: `Net kâr bütçe sapması %${input.budgetVsActual.profitVariancePct.toFixed(1)}.`,
      severity: 'warning',
      recommendation: 'Fiyatlama, maliyet ve gider dağılımı yeniden planlanmalı.',
    });
  }

  if (input.bankReconciliation.unmatchedAmount > 0) {
    issues.push({
      code: 'BANK_UNMATCHED_TRANSACTIONS',
      title: 'Banka Mutabakat Açıkları',
      detail: `${input.bankReconciliation.unmatchedLineCount} satır (${formatCurrencyShort(
        input.bankReconciliation.unmatchedAmount
      )}) eşleştirilmedi.`,
      severity: input.bankReconciliation.unmatchedLineCount >= 10 ? 'critical' : 'warning',
      recommendation: 'Banka satırlarını ödeme/gider kayıtlarıyla eşleştirin veya gerekçeli olarak işaretleyin.',
    });
  }

  if (Math.abs(input.bankReconciliation.difference) >= 100) {
    issues.push({
      code: 'BANK_BOOKS_DIFFERENCE',
      title: 'Banka ve Defter Farkı',
      detail: `Nakit hareket farkı ${formatCurrencyShort(Math.abs(input.bankReconciliation.difference))}.`,
      severity: Math.abs(input.bankReconciliation.difference) >= 1000 ? 'critical' : 'warning',
      recommendation: 'Dönem içi tahsilat/ödeme kayıtları ile ekstrelere ait tarihleri ve tutarları kontrol edin.',
    });
  }

  if (input.taxSummary.netVat > 0) {
    const [yearRaw, monthRaw] = input.period.split('-');
    const dueDate = new Date(Number(yearRaw), Number(monthRaw), 26);
    if (new Date() > dueDate) {
      issues.push({
        code: 'VAT_DUE_DATE_RISK',
        title: 'KDV Ödeme Tarihi Riski',
        detail: `${input.period} dönemi için net KDV yükümlülüğü mevcut.`,
        severity: 'warning',
        recommendation: 'Beyan/ödeme durumunu kontrol ederek gecikmeyi önleyin.',
      });
    }
  }

  if (input.periodCloseState.status === 'hard_closed') {
    issues.push({
      code: 'PERIOD_LOCKED',
      title: 'Dönem Kilitli',
      detail: `${input.period} dönemi hard close statüsünde.`,
      severity: 'info',
      recommendation: 'Bu dönem için kayıt değişikliği gerekiyorsa yetkili onay süreci işletin.',
    });
  }

  const criticalCount = issues.filter((issue) => issue.severity === 'critical').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;
  const infoCount = issues.filter((issue) => issue.severity === 'info').length;

  const score = Math.max(0, 100 - criticalCount * 25 - warningCount * 10 - infoCount * 3);

  return {
    score: round2(score),
    issues,
    criticalCount,
    warningCount,
    infoCount,
  };
}

export async function getAccountingWorkspace(period?: string): Promise<AccountingWorkspace> {
  const range = getPeriodRange(period);
  const notes: string[] = ['Bu çalışma alanı TRY kayıtlarını raporlar; USD ve EUR tahsilatları kendi para birimleriyle Finans ekranında izlenir.', 'Operasyonel mali özetler yasal bilanço veya vergi beyannamesi yerine geçmez.'];
  const session = await getSession();
  // Books anything a write path left unposted, so the reports below read a complete ledger.
  const ledger = await syncLedger(sql, session.user.tenantId).catch((error) => {
    console.error('[Accounting] ledger sync failed', error instanceof Error ? error.message : error);
    return null;
  });
  if (ledger?.awaitingRate) notes.push(`${ledger.awaitingRate} dövizli fatura kur girilmediği için yevmiyeye işlenmedi.`);
  if (ledger?.skippedClosed) notes.push(`${ledger.skippedClosed} kayıt kesin kapanmış döneme düştüğü için işlenmedi.`);

  const capabilityChecks = await Promise.all([
    tableExists('accounts'),
    tableExists('journal_entries'),
    tableExists('journal_entry_lines'),
    tableExists('payments'),
    tableExists('expenses'),
    tableExists('tax_transactions'),
    tableExists('fixed_assets'),
    tableExists('orders'),
    tableExists('accounting_budgets'),
    tableExists('accounting_period_closes'),
    tableExists('bank_statement_lines'),
  ]);

  const capabilities: AccountingWorkspace['capabilities'] = {
    chartOfAccounts: capabilityChecks[0],
    generalLedger: capabilityChecks[1] && capabilityChecks[2],
    bankReconciliation: capabilityChecks[10],
    receivableAging: capabilityChecks[7] && capabilityChecks[3],
    payableAging: capabilityChecks[4],
    cashFlowReporting: capabilityChecks[3] || capabilityChecks[4],
    taxManagement: capabilityChecks[5],
    fixedAssetDepreciation: capabilityChecks[6],
    budgeting: capabilityChecks[8],
    forecasting: capabilityChecks[3] || capabilityChecks[4],
    complianceMonitoring: true,
    periodLocking: capabilityChecks[9],
    periodClose: true,
    kpiDashboard: true,
  };

  const [profitLoss, balanceSheet, cashFlow, taxSummary, receivablesAging, payablesAging, periodComparison] =
    await Promise.all([
      getProfitLossReport(range.startDateIso, range.endDateIso),
      getBalanceSheet(range.endDateIso),
      getCashFlowReport(range.startDateIso, range.endDateIso),
      getTaxSummary(range.period),
      getReceivablesAging(range.endDateIso),
      getPayablesAging(range.endDateIso),
      getPeriodComparison(range.period),
    ]);

  const [{ budget, hasBudget }, cashForecast, trialBalance, periodCloseState, bankReconciliation] = await Promise.all([
    getBudgetPlanInternal(session, range.period),
    getCashFlowForecast(range.period, FORECAST_MONTHS_DEFAULT),
    getTrialBalance(range.period),
    getPeriodCloseStateInternal(session, range.period),
    getBankReconciliationSummary(range.period),
  ]);

  const budgetVsActual = buildBudgetVsActualReport(
    range.period,
    budget,
    hasBudget,
    profitLoss,
    taxSummary
  );

  const kpis = buildAccountingKpis(range, profitLoss, balanceSheet, receivablesAging, payablesAging);
  const alerts = buildAlerts({
    profitLoss,
    cashFlow,
    taxSummary,
    receivablesAging,
    payablesAging,
    bankReconciliation,
    kpis,
  });
  const closeChecklist = buildCloseChecklist({
    profitLoss,
    taxSummary,
    receivablesAging,
    payablesAging,
    bankReconciliation,
    capabilities,
  });
  const compliance = buildComplianceSummary({
    period: range.period,
    closeChecklist,
    kpis,
    trialBalance,
    budgetVsActual,
    receivablesAging,
    bankReconciliation,
    taxSummary,
    periodCloseState,
  });

  if (!capabilities.generalLedger) {
    notes.push('Genel muhasebe defteri tabloları henüz migration ile kurulmamış olabilir.');
  }
  if (!capabilities.taxManagement) {
    notes.push('Vergi hareket tablosu eksik; KDV/stopaj özeti gerçek veriden üretilemiyor olabilir.');
  }
  if (!capabilities.receivableAging) {
    notes.push('Alacak yaşlandırma için orders/payments tabloları gerekiyor.');
  }
  if (!capabilities.budgeting) {
    notes.push('Bütçe plan tablosu eksik; bütçe/gerçekleşen analizi varsayılan değerlerle çalışıyor.');
  }
  if (!capabilities.periodLocking) {
    notes.push('Dönem kilitleme tablosu eksik; close/lock yönetimi aktif değil.');
  }
  if (!capabilities.bankReconciliation) {
    notes.push('Banka mutabakat tablosu eksik; ekstre eşleştirme görünümü devre dışı.');
  }

  const warnings = [
    ...(profitLoss?.warnings || []),
    ...(balanceSheet?.warnings || []),
    ...(cashFlow?.warnings || []),
  ];
  for (const warning of warnings) {
    if (!notes.includes(warning)) {
      notes.push(warning);
    }
  }

  return {
    period: range.period,
    profitLoss,
    balanceSheet,
    cashFlow,
    taxSummary,
    budget,
    budgetVsActual,
    cashForecast,
    bankReconciliation,
    compliance,
    periodCloseState,
    receivablesAging,
    payablesAging,
    periodComparison,
    kpis,
    alerts,
    closeChecklist,
    capabilities,
    notes,
  };
}


// ============================================
// Ledger view (yevmiye ve mizan)
// ============================================

export type LedgerEntryView = { id: string; number: string; date: string; type: string; description: string; total: number; source: string | null;
  lines: Array<{ code: string; name: string; debit: number; credit: number; description: string | null }> };

/** Books what is missing (any finance role may trigger it; it only posts what the records say). */
export async function syncLedgerNow(): Promise<SyncResult> {
  const session = await getSession();
  const result = await syncLedger(sql, session.user.tenantId);
  revalidatePath('/accounting');
  return result;
}

/** The period's trial balance and its entries with their lines. */
export async function getLedgerView(period?: string): Promise<{ trialBalance: TrialBalanceReport; entries: LedgerEntryView[] }> {
  const session = await getSession();
  const normalizedPeriod = normalizePeriod(period);
  const trialBalance = await getTrialBalance(normalizedPeriod);
  if (!(await tableExists('journal_entries')) || !(await tableExists('journal_entry_lines'))) return { trialBalance, entries: [] };
  const rows = await sql`
    SELECT je.id, je.entry_number, je.entry_date, je.type, je.description, je.total_debit, to_jsonb(je) ->> 'source_key' AS source_key,
      coalesce(json_agg(json_build_object('code', a.code, 'name', a.name, 'debit', l.debit, 'credit', l.credit, 'description', l.description) ORDER BY l.line_no) FILTER (WHERE l.id IS NOT NULL), '[]') AS lines
    FROM journal_entries je
    LEFT JOIN journal_entry_lines l ON l.journal_entry_id = je.id
    LEFT JOIN accounts a ON a.id = l.account_id
    WHERE je.tenant_id = ${session.user.tenantId} AND je.period = ${normalizedPeriod}
    GROUP BY je.id
    ORDER BY je.entry_date, je.created_at
    LIMIT 500`;
  return {
    trialBalance,
    entries: (rows as any[]).map((r) => ({
      id: String(r.id), number: r.entry_number, date: new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date(r.entry_date)),
      type: r.type, description: r.description, total: toNumber(r.total_debit), source: r.source_key ?? null,
      lines: (r.lines as any[]).map((l) => ({ code: l.code, name: l.name, debit: toNumber(l.debit), credit: toNumber(l.credit), description: l.description ?? null })),
    })),
  };
}

// ============================================
// VAT period summary and purchase records
// ============================================

const allows = (context: Awaited<ReturnType<typeof getServerUserContext>>, permission: Parameters<typeof requirePermission>[1]) => {
  try { requirePermission(context, permission); return true; } catch { return false; }
};

/** The period's VAT summary (output by rate, withholding, exemptions, deductible VAT, carry-forward) and its purchase records. */
export async function getVatReturnView(period?: string): Promise<{ summary: VatReturn; csv: string; expenses: ExpenseView[]; canAdd: boolean; canDelete: boolean }> {
  const context = await getServerUserContext();
  requirePermission(context, 'finance.view');
  const normalizedPeriod = normalizePeriod(period);
  const [summary, expenses] = await Promise.all([
    loadVatReturn(sql, context.tenantId, normalizedPeriod),
    (await tableExists('expenses')) ? listExpenses(sql, context.tenantId, normalizedPeriod) : Promise.resolve([]),
  ]);
  return { summary, csv: vatReturnCsv(summary), expenses, canAdd: allows(context, 'finance.ledger.create'), canDelete: allows(context, 'finance.ledger.delete') };
}

export async function addExpenseRecord(input: unknown): Promise<{ ok: true; expense: ExpenseView } | { ok: false; error: string }> {
  const context = await getServerUserContext();
  requirePermission(context, 'finance.ledger.create');
  try {
    const expense = await addExpense(sql, { tenantId: context.tenantId, userId: context.userId }, input);
    revalidatePath('/accounting');
    return { ok: true, expense };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? 'Bilgiler eksik' };
    return { ok: false, error: error instanceof Error ? error.message : 'Gider kaydedilemedi' };
  }
}

export async function deleteExpenseRecord(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const context = await getServerUserContext();
  requirePermission(context, 'finance.ledger.delete');
  try {
    await deleteExpense(sql, { tenantId: context.tenantId, userId: context.userId }, z.string().uuid().parse(id));
    revalidatePath('/accounting');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Gider silinemedi' };
  }
}
