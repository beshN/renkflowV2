import 'server-only';

import { z } from 'zod';

import { recordAudit } from '@/lib/audit/audit-log';
import { columnExists } from '@/lib/db/schema-guard';
import { VAT_RATES } from '@/lib/features/einvoice/codes';
import { assertPeriodWritable } from './period-lock';
import { syncLedger } from './posting.server';

// Purchase invoices and expenses (alış faturası, gider): the source of deductible VAT. The amount is
// entered before VAT and the VAT is computed from the rate, so the summary never depends on someone
// typing the VAT by hand.

type Db = any;
type Actor = { tenantId: string; userId: string };

export const EXPENSE_CATEGORIES = {
  materials: 'Malzeme ve hammadde alışı (stok)',
  rent: 'Kira',
  utilities: 'Elektrik, su, doğalgaz',
  salaries: 'Personel',
  marketing: 'Reklam',
  office: 'Ofis',
  travel: 'Yol ve araç',
  maintenance: 'Bakım ve onarım',
  insurance: 'Sigorta',
  taxes: 'Vergi ve harç',
  other: 'Diğer',
} as const;

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const ExpenseInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  vendor: z.string().trim().min(1, 'Tedarikçi gerekli').max(200),
  documentNumber: z.string().trim().max(60).optional().transform((v) => v || null),
  description: z.string().trim().min(1, 'Açıklama gerekli').max(300),
  category: z.enum(Object.keys(EXPENSE_CATEGORIES) as [keyof typeof EXPENSE_CATEGORIES, ...(keyof typeof EXPENSE_CATEGORIES)[]]),
  /** Amount before VAT, TRY. */
  net: z.number().positive().max(1_000_000_000),
  vatPercent: z.number().refine((v) => (VAT_RATES as readonly number[]).includes(v), 'KDV oranı 0, 1, 10 ya da 20 olmalı'),
  deductible: z.boolean().default(true),
}).strict();

export type ExpenseView = {
  id: string; date: string; vendor: string | null; documentNumber: string | null; description: string; category: string;
  net: number; vatPercent: number | null; vat: number; deductible: boolean; currency: string;
};

export async function addExpense(db: Db, actor: Actor, raw: unknown): Promise<ExpenseView> {
  const input = ExpenseInput.parse(raw);
  await assertPeriodWritable({ tenantId: actor.tenantId, period: input.date.slice(0, 7), actionLabel: 'Gider kaydı' });
  if (!(await columnExists('expenses', 'vat_percent'))) throw new Error('Gider KDV alanları henüz kurulmadı');
  const vat = r2((input.net * input.vatPercent) / 100);
  return db.begin(async (tx: Db) => {
    if (input.documentNumber) {
      const [dup] = await tx`SELECT id FROM expenses WHERE tenant_id = ${actor.tenantId} AND lower(vendor) = lower(${input.vendor}) AND document_number = ${input.documentNumber} LIMIT 1`;
      if (dup) throw new Error('Bu tedarikçinin aynı numaralı belgesi zaten kayıtlı');
    }
    const [row] = await tx`
      INSERT INTO expenses (tenant_id, category, description, amount, currency, date, vendor, is_tax_deductible, tax_amount, vat_percent, document_number, created_by)
      VALUES (${actor.tenantId}, ${input.category}, ${input.description}, ${input.net}, 'TRY', ${input.date}, ${input.vendor}, ${input.deductible}, ${vat}, ${input.vatPercent}, ${input.documentNumber}, ${actor.userId})
      RETURNING *`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'expense', entityId: row.id, action: 'created', metadata: { net: input.net, vat, vatPercent: input.vatPercent, documentNumber: input.documentNumber } });
    await syncLedger(tx, actor.tenantId, { expenseId: String(row.id) });
    return view(row);
  });
}

export async function listExpenses(db: Db, tenantId: string, period: string): Promise<ExpenseView[]> {
  const rows = await db`
    SELECT e.*, to_jsonb(e) ->> 'vat_percent' AS vat_percent_text, to_jsonb(e) ->> 'document_number' AS document_number_text
    FROM expenses e WHERE tenant_id = ${tenantId} AND to_char(date, 'YYYY-MM') = ${period}
    ORDER BY date DESC, created_at DESC LIMIT 500`;
  return (rows as any[]).map(view);
}

export async function deleteExpense(db: Db, actor: Actor, id: string): Promise<void> {
  const [row] = await db`SELECT id, to_char(date, 'YYYY-MM') AS period, description, amount, tax_amount FROM expenses WHERE id = ${id} AND tenant_id = ${actor.tenantId}`;
  if (!row) throw new Error('Gider bulunamadı');
  await assertPeriodWritable({ tenantId: actor.tenantId, period: row.period, actionLabel: 'Gider silme' });
  await db.begin(async (tx: Db) => {
    await tx`DELETE FROM expenses WHERE id = ${id} AND tenant_id = ${actor.tenantId}`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'expense', entityId: id, action: 'deleted', metadata: { description: row.description, net: Number(row.amount), vat: Number(row.tax_amount) } });
    // The booked entry stays; a reversal closes it.
    await syncLedger(tx, actor.tenantId, { expenseId: id });
  });
}

function view(r: any): ExpenseView {
  const pct = r.vat_percent_text ?? r.vat_percent;
  return {
    id: String(r.id), date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10),
    vendor: r.vendor ?? null, documentNumber: r.document_number_text ?? r.document_number ?? null, description: r.description, category: r.category,
    net: Number(r.amount), vatPercent: pct === null || pct === undefined ? null : Number(pct), vat: Number(r.tax_amount),
    deductible: Boolean(r.is_tax_deductible), currency: r.currency || 'TRY',
  };
}
