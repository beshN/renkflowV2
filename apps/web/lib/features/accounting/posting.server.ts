import 'server-only';

import { columnExists, tableExists } from '@/lib/db/schema-guard';
import { CHART, collectionLines, isBalanced, reversed, saleLines, type LedgerLine } from './chart';

// Automatic ledger (yevmiye) entries for invoices and collections. syncLedger books every business
// record that has no entry yet and reverses the ones that were cancelled or deleted; each entry is
// keyed by its source, so it is safe to run after every change and again on demand.

type Db = any;
type Row = Record<string, any>;

export type SyncResult = { posted: number; skippedClosed: number; awaitingRate: number; failed: number };
type Scope = { invoiceId?: string; paymentId?: string };

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const istanbulDay = (d: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(d);
const day = (v: unknown) => (v instanceof Date ? istanbulDay(v) : String(v).slice(0, 10));

export async function ledgerReady(): Promise<boolean> {
  return (await tableExists('journal_entries')) && (await tableExists('accounts')) && (await columnExists('journal_entries', 'source_key'));
}

/** Creates the Tekdüzen accounts the templates use (never renames the firm's own). */
async function chartIds(db: Db, tenantId: string): Promise<Record<string, string>> {
  for (const a of CHART) {
    await db`INSERT INTO accounts (tenant_id, code, name, type) VALUES (${tenantId}, ${a.code}, ${a.name}, ${a.type}) ON CONFLICT (tenant_id, code) DO NOTHING`;
  }
  const rows = await db`SELECT id, code FROM accounts WHERE tenant_id = ${tenantId} AND code = ANY(${CHART.map((a) => a.code)})`;
  return Object.fromEntries(rows.map((r: Row) => [r.code, String(r.id)]));
}

async function hardClosed(db: Db, tenantId: string, period: string): Promise<boolean> {
  if (!(await tableExists('accounting_period_closes'))) return false;
  const [row] = await db`SELECT status FROM accounting_period_closes WHERE tenant_id = ${tenantId} AND period = ${period}`;
  return row?.status === 'hard_closed';
}

type Entry = { sourceKey: string; entryNumber: string; date: string; type: 'invoice' | 'payment' | 'adjustment'; description: string; lines: LedgerLine[]; orderId?: string | null; invoiceId?: string | null };

/** Inserts one balanced entry; false when the source already has one. */
async function postEntry(db: Db, tenantId: string, accounts: Record<string, string>, e: Entry): Promise<boolean> {
  if (!isBalanced(e.lines)) throw new Error(`Dengesiz kayıt: ${e.sourceKey}`);
  const total = round2(e.lines.reduce((s, l) => s + l.debit, 0));
  const [entry] = await db`
    INSERT INTO journal_entries (tenant_id, entry_number, entry_date, type, description, total_debit, total_credit, period, source_key)
    VALUES (${tenantId}, ${e.entryNumber}, ${`${e.date}T12:00:00+03:00`}, ${e.type}, ${e.description}, ${total}, ${total}, ${e.date.slice(0, 7)}, ${e.sourceKey})
    ON CONFLICT (tenant_id, source_key) WHERE source_key IS NOT NULL DO NOTHING
    RETURNING id`;
  if (!entry) return false;
  let lineNo = 1;
  for (const l of e.lines) {
    await db`INSERT INTO journal_entry_lines (journal_entry_id, line_no, account_id, debit, credit, description, order_id, invoice_id)
      VALUES (${entry.id}, ${lineNo++}, ${accounts[l.account]}, ${l.debit}, ${l.credit}, ${l.description}, ${e.orderId ?? null}, ${e.invoiceId ?? null})`;
  }
  return true;
}

async function taxRows(db: Db, tenantId: string, invoice: Row, sign: 1 | -1, period: string, rate: number) {
  if (!(await tableExists('tax_transactions'))) return;
  const vat = round2(Number(invoice.vat_total) * rate);
  const withheld = round2(Number(invoice.withholding_total ?? 0) * rate);
  const base = round2(Number(invoice.subtotal) * rate);
  const label = `${sign < 0 ? 'İptal · ' : ''}${invoice.invoice_number}`;
  if (vat - withheld !== 0) {
    await db`INSERT INTO tax_transactions (tenant_id, tax_type, type, base_amount, tax_amount, total_amount, description, related_order_id, related_invoice_id, period)
      VALUES (${tenantId}, 'vat', 'output', ${sign * base}, ${sign * round2(vat - withheld)}, ${sign * round2(base + vat - withheld)}, ${label}, ${invoice.order_id}, ${invoice.id}, ${period})`;
  }
  if (withheld) {
    await db`INSERT INTO tax_transactions (tenant_id, tax_type, type, base_amount, tax_amount, total_amount, description, related_order_id, related_invoice_id, period)
      VALUES (${tenantId}, 'withholding', 'output', ${sign * vat}, ${sign * withheld}, ${sign * withheld}, ${`${label} tevkifat (alıcı beyan eder)`}, ${invoice.order_id}, ${invoice.id}, ${period})`;
  }
}

/** One savepoint per record: a failure is logged and retried by the next sync, never blocks the change. */
async function guarded(db: Db, work: (db: Db) => Promise<boolean>, result: SyncResult, label: string) {
  try {
    const run = typeof db.savepoint === 'function' ? (fn: (d: Db) => Promise<boolean>) => db.savepoint(fn) : (fn: (d: Db) => Promise<boolean>) => db.begin(fn);
    if (await run(work)) result.posted++;
  } catch (error) {
    result.failed++;
    console.error('[ledger]', label, error instanceof Error ? error.message : error);
  }
}

export async function syncLedger(db: Db, tenantId: string, scope: Scope = {}): Promise<SyncResult> {
  const result: SyncResult = { posted: 0, skippedClosed: 0, awaitingRate: 0, failed: 0 };
  if (!(await ledgerReady())) return result;
  const accounts = await chartIds(db, tenantId);
  const onlyPayments = Boolean(scope.paymentId) && !scope.invoiceId;
  const onlyInvoices = Boolean(scope.invoiceId) && !scope.paymentId;

  if (!onlyPayments) {
    const invoices = await db`
      SELECT i.*, EXISTS (SELECT 1 FROM invoice_lines l WHERE l.invoice_id = i.id AND (to_jsonb(l) ->> 'exemption_code') = '301') AS exported,
        EXISTS (SELECT 1 FROM journal_entries j WHERE j.tenant_id = i.tenant_id AND j.source_key = 'invoice:' || i.id) AS booked,
        EXISTS (SELECT 1 FROM journal_entries j WHERE j.tenant_id = i.tenant_id AND j.source_key = 'invoice-cancel:' || i.id) AS reversed_already
      FROM invoices i
      WHERE i.tenant_id = ${tenantId} AND i.invoice_number IS NOT NULL AND i.status IN ('issued', 'cancelled')
        AND (${scope.invoiceId ?? null}::uuid IS NULL OR i.id = ${scope.invoiceId ?? null}::uuid)`;
    for (const inv of invoices as Row[]) {
      if (inv.booked && (inv.status !== 'cancelled' || inv.reversed_already)) continue;
      const rate = inv.currency === 'TRY' ? 1 : Number((inv as Row).exchange_rate ?? 0);
      if (!rate) { result.awaitingRate++; continue; }
      const issuedOn = day(inv.issued_on);
      const sale = saleLines({
        number: inv.invoice_number, customerName: inv.customer_name, exported: Boolean(inv.exported),
        subtotal: round2(Number(inv.subtotal) * rate), vat: round2(Number(inv.vat_total) * rate), withholding: round2(Number(inv.withholding_total ?? 0) * rate),
      });
      if (!inv.booked) {
        if (await hardClosed(db, tenantId, issuedOn.slice(0, 7))) { result.skippedClosed++; continue; }
        await guarded(db, async (d) => {
          const posted = await postEntry(d, tenantId, accounts, { sourceKey: `invoice:${inv.id}`, entryNumber: `FTR-${inv.invoice_number}`, date: issuedOn, type: 'invoice', description: `Satış faturası ${inv.invoice_number} · ${inv.customer_name}`, lines: sale, orderId: inv.order_id, invoiceId: inv.id });
          if (posted) await taxRows(d, tenantId, inv, 1, issuedOn.slice(0, 7), rate);
          return posted;
        }, result, `invoice ${inv.id}`);
      }
      if (inv.status === 'cancelled' && !inv.reversed_already) {
        const cancelledOn = inv.cancelled_at ? istanbulDay(new Date(inv.cancelled_at)) : istanbulDay(new Date());
        if (await hardClosed(db, tenantId, cancelledOn.slice(0, 7))) { result.skippedClosed++; continue; }
        await guarded(db, async (d) => {
          const posted = await postEntry(d, tenantId, accounts, { sourceKey: `invoice-cancel:${inv.id}`, entryNumber: `FTR-IPT-${inv.invoice_number}`, date: cancelledOn, type: 'adjustment', description: `İptal ${inv.invoice_number}`, lines: reversed(sale, 'İptal'), orderId: inv.order_id, invoiceId: inv.id });
          if (posted) await taxRows(d, tenantId, inv, -1, cancelledOn.slice(0, 7), rate);
          return posted;
        }, result, `invoice-cancel ${inv.id}`);
      }
    }
  }

  if (!onlyInvoices) {
    const payments = await db`
      SELECT p.*, o.order_number FROM payments p JOIN orders o ON o.id = p.order_id
      WHERE p.tenant_id = ${tenantId} AND p.currency = 'TRY'
        AND (${scope.paymentId ?? null}::uuid IS NULL OR p.id = ${scope.paymentId ?? null}::uuid)
        AND NOT EXISTS (SELECT 1 FROM journal_entries j WHERE j.tenant_id = p.tenant_id AND j.source_key = 'payment:' || p.id)`;
    for (const p of payments as Row[]) {
      const paidOn = istanbulDay(new Date(p.paid_at));
      if (await hardClosed(db, tenantId, paidOn.slice(0, 7))) { result.skippedClosed++; continue; }
      const label = `Tahsilat · ${p.order_number}${p.reference ? ` · ${p.reference}` : ''}`;
      await guarded(db, (d) => postEntry(d, tenantId, accounts, { sourceKey: `payment:${p.id}`, entryNumber: `THS-${String(p.id).slice(0, 8)}`, date: paidOn, type: 'payment', description: label, lines: collectionLines({ amount: Number(p.amount), method: p.method, label }), orderId: p.order_id, invoiceId: p.invoice_id ?? null }), result, `payment ${p.id}`);
    }

    // A deleted collection keeps its entry and gets a reversal dated the day it is noticed.
    if (!scope.paymentId) {
      const orphans = await db`
        SELECT j.id, j.source_key, j.entry_number FROM journal_entries j
        WHERE j.tenant_id = ${tenantId} AND j.source_key LIKE 'payment:%'
          AND NOT EXISTS (SELECT 1 FROM payments p WHERE 'payment:' || p.id = j.source_key)
          AND NOT EXISTS (SELECT 1 FROM journal_entries r WHERE r.tenant_id = j.tenant_id AND r.source_key = 'payment-delete:' || substring(j.source_key FROM 9))`;
      for (const o of orphans as Row[]) {
        const today = istanbulDay(new Date());
        if (await hardClosed(db, tenantId, today.slice(0, 7))) { result.skippedClosed++; continue; }
        const lines = await db`SELECT a.code AS account, l.debit, l.credit, l.description FROM journal_entry_lines l JOIN accounts a ON a.id = l.account_id WHERE l.journal_entry_id = ${o.id} ORDER BY l.line_no`;
        const original: LedgerLine[] = lines.map((l: Row) => ({ account: l.account, debit: Number(l.debit), credit: Number(l.credit), description: l.description ?? '' }));
        await guarded(db, (d) => postEntry(d, tenantId, accounts, { sourceKey: `payment-delete:${String(o.source_key).slice(8)}`, entryNumber: `${o.entry_number}-SIL`, date: today, type: 'adjustment', description: `Silinen tahsilat ${o.entry_number}`, lines: reversed(original, 'Silindi') }), result, `payment-delete ${o.source_key}`);
      }
    }
  }
  return result;
}
