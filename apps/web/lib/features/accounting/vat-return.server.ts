import 'server-only';

import { tableExists } from '@/lib/db/schema-guard';
import { buildVatReturn, carryInto, type VatPurchase, type VatReturn, type VatSaleLine } from './vat-return';

// Loads a firm's invoice lines and purchase records up to a period and builds that period's VAT
// summary. Earlier months are summarised the same way to carry deductible VAT forward.

type Db = any;
type Row = Record<string, any>;

export async function loadVatReturn(db: Db, tenantId: string, period: string): Promise<VatReturn> {
  const byMonth = new Map<string, { lines: VatSaleLine[]; purchases: VatPurchase[] }>();
  const month = (m: string) => {
    let v = byMonth.get(m);
    if (!v) byMonth.set(m, (v = { lines: [], purchases: [] }));
    return v;
  };
  const awaitingRate = new Set<string>();

  if ((await tableExists('invoices')) && (await tableExists('invoice_lines'))) {
    const rows: Row[] = await db`
      SELECT i.invoice_number, i.currency, (to_jsonb(i) ->> 'exchange_rate')::numeric AS exchange_rate,
        to_char(i.issued_on, 'YYYY-MM') AS issued_period,
        CASE WHEN i.status = 'cancelled' THEN to_char(coalesce(i.cancelled_at, now()) AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM') END AS cancelled_period,
        l.vat_percent, l.net_amount, l.vat_amount,
        to_jsonb(l) ->> 'withholding_code' AS withholding_code,
        coalesce((to_jsonb(l) ->> 'withholding_percent')::numeric, 0) AS withholding_percent,
        coalesce((to_jsonb(l) ->> 'withholding_amount')::numeric, 0) AS withholding_amount,
        to_jsonb(l) ->> 'exemption_code' AS exemption_code
      FROM invoices i
      JOIN invoice_lines l ON l.invoice_id = i.id
      WHERE i.tenant_id = ${tenantId} AND i.invoice_number IS NOT NULL AND i.status IN ('issued', 'cancelled')
        AND to_char(i.issued_on, 'YYYY-MM') <= ${period}
      ORDER BY i.issued_on, i.invoice_number, l.position`;
    for (const r of rows) {
      const rate = r.currency === 'TRY' ? 1 : Number(r.exchange_rate ?? 0);
      if (!rate) { if (r.issued_period === period || r.cancelled_period === period) awaitingRate.add(r.invoice_number); continue; }
      const line = {
        invoiceNumber: r.invoice_number, rate, vatPercent: Number(r.vat_percent), net: Number(r.net_amount), vat: Number(r.vat_amount),
        withholdingCode: r.withholding_code || null, withholdingPercent: Number(r.withholding_percent), withholdingAmount: Number(r.withholding_amount),
        exemptionCode: r.exemption_code || null,
      };
      month(r.issued_period).lines.push({ ...line, sign: 1 });
      if (r.cancelled_period && r.cancelled_period <= period) month(r.cancelled_period).lines.push({ ...line, sign: -1 });
    }
  }

  if (await tableExists('expenses')) {
    const rows: Row[] = await db`
      SELECT to_char(date, 'YYYY-MM') AS period, amount, tax_amount, (to_jsonb(e) ->> 'vat_percent')::numeric AS vat_percent, is_tax_deductible, currency
      FROM expenses e WHERE tenant_id = ${tenantId} AND to_char(date, 'YYYY-MM') <= ${period}`;
    for (const r of rows) {
      month(r.period).purchases.push({
        net: Number(r.amount), vat: Number(r.tax_amount), vatPercent: r.vat_percent === null ? null : Number(r.vat_percent),
        deductible: Boolean(r.is_tax_deductible), currency: r.currency || 'TRY',
      });
    }
  }

  const earlier = [...byMonth.keys()].filter((m) => m < period).sort().map((m) => buildVatReturn(m, byMonth.get(m)!.lines, byMonth.get(m)!.purchases));
  const notes: string[] = [];
  if (awaitingRate.size) notes.push(`${awaitingRate.size} dövizli fatura kur girilmediği için özete katılmadı: ${[...awaitingRate].slice(0, 5).join(', ')}${awaitingRate.size > 5 ? '…' : ''}`);
  notes.push('Devreden KDV, RenkFlow\'daki kayıtlardan hesaplanır; RenkFlow\'u kullanmaya başlamadan önceki devir dahil değildir.');
  const current = byMonth.get(period) ?? { lines: [], purchases: [] };
  return buildVatReturn(period, current.lines, current.purchases, { carryIn: carryInto(earlier), notes });
}
