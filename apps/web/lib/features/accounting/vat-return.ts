// VAT period summary (KDV dönem özeti) for the accountant who files the KDV-1 return. Pure: the
// server loads the period's invoice lines and purchase records, this groups them the way the return
// asks (sales by rate, partial withholding by code, exempt sales by code, deductible input VAT).
// Amounts are TRY: foreign-currency invoices are converted at the invoice's own rate.
//
// Periods follow the ledger: an invoice counts in the month it was issued; a cancellation reverses
// it in the month it was cancelled (a cancel inside the same month nets to nothing).

import { exemptionCode, withholdingCode } from '@/lib/features/einvoice/codes';

export type VatSaleLine = {
  invoiceNumber: string;
  /** +1 issued in the period, -1 cancelled in the period. */
  sign: 1 | -1;
  /** Invoice currency → TRY. */
  rate: number;
  vatPercent: number;
  net: number;
  vat: number;
  withholdingCode: string | null;
  withholdingPercent: number;
  withholdingAmount: number;
  exemptionCode: string | null;
};

export type VatPurchase = { net: number; vat: number; vatPercent: number | null; deductible: boolean; currency: string };

export type VatReturn = {
  period: string;
  /** Fully taxed sales by rate (KDV-1 "Matrah ve vergi"). */
  sales: Array<{ vatPercent: number; base: number; vat: number }>;
  /** Partial withholding (kısmi tevkifat): the buyer pays the withheld share to the tax office. */
  withheld: Array<{ code: string; name: string; vatPercent: number; withholdingPercent: number; base: number; vat: number; withheld: number; payable: number }>;
  /** Exempt or zero-rated sales by exemption code. */
  exempt: Array<{ code: string | null; name: string; base: number }>;
  output: { base: number; vat: number; withheld: number };
  /** Deductible VAT on purchases and expenses (indirilecek KDV) by rate. */
  input: { byRate: Array<{ vatPercent: number | null; base: number; vat: number }>; vat: number; count: number };
  /** Deductible VAT carried in from earlier months (devreden KDV), as far as RenkFlow has records. */
  carryIn: number;
  /** Output VAT − input VAT − carried-in VAT; positive is payable, negative carries forward. */
  net: number;
  payable: number;
  carryForward: number;
  notes: string[];
};

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function bucket<T>(map: Map<string, T>, key: string, make: () => T): T {
  let v = map.get(key);
  if (!v) map.set(key, (v = make()));
  return v;
}

export function buildVatReturn(period: string, lines: VatSaleLine[], purchases: VatPurchase[], options: { carryIn?: number; notes?: string[] } = {}): VatReturn {
  const sales = new Map<string, VatReturn['sales'][number]>();
  const withheld = new Map<string, VatReturn['withheld'][number]>();
  const exempt = new Map<string, VatReturn['exempt'][number]>();

  for (const l of lines) {
    const k = l.sign * l.rate;
    const base = r2(l.net * k);
    const vat = r2(l.vat * k);
    if (l.withholdingCode && l.withholdingAmount) {
      const w = r2(l.withholdingAmount * k);
      const row = bucket(withheld, `${l.withholdingCode}|${l.vatPercent}`, () => ({
        code: l.withholdingCode!, name: withholdingCode(l.withholdingCode)?.name ?? l.withholdingCode!, vatPercent: l.vatPercent,
        withholdingPercent: l.withholdingPercent, base: 0, vat: 0, withheld: 0, payable: 0,
      }));
      row.base += base; row.vat += vat; row.withheld += w; row.payable += vat - w;
    } else if (l.exemptionCode || !l.vatPercent) {
      const code = l.exemptionCode || null;
      const row = bucket(exempt, code ?? '-', () => ({ code, name: code ? exemptionCode(code)?.name ?? code : 'İstisna kodu girilmemiş', base: 0 }));
      row.base += base;
    } else {
      const row = bucket(sales, String(l.vatPercent), () => ({ vatPercent: l.vatPercent, base: 0, vat: 0 }));
      row.base += base; row.vat += vat;
    }
  }

  const inputMap = new Map<string, VatReturn['input']['byRate'][number]>();
  let inputCount = 0;
  let skippedForeign = 0;
  let skippedNonDeductible = 0;
  for (const p of purchases) {
    if (!p.deductible) { skippedNonDeductible++; continue; }
    if (p.currency !== 'TRY') { skippedForeign++; continue; }
    if (!p.vat) continue;
    const row = bucket(inputMap, String(p.vatPercent ?? '-'), () => ({ vatPercent: p.vatPercent, base: 0, vat: 0 }));
    row.base += p.net; row.vat += p.vat;
    inputCount++;
  }

  const round = <T extends Record<string, unknown>>(rows: T[], keys: (keyof T)[]) =>
    rows.map((row) => { for (const k of keys) (row as any)[k] = r2(row[k] as number); return row; });
  const salesRows = round([...sales.values()].sort((a, b) => b.vatPercent - a.vatPercent), ['base', 'vat']).filter((r) => r.base || r.vat);
  const withheldRows = round([...withheld.values()].sort((a, b) => a.code.localeCompare(b.code) || b.vatPercent - a.vatPercent), ['base', 'vat', 'withheld', 'payable']).filter((r) => r.base || r.vat);
  const exemptRows = round([...exempt.values()].sort((a, b) => (a.code === null ? 1 : 0) - (b.code === null ? 1 : 0) || (a.code ?? '').localeCompare(b.code ?? '')), ['base']).filter((r) => r.base);
  const inputRows = round([...inputMap.values()].sort((a, b) => (b.vatPercent ?? -1) - (a.vatPercent ?? -1)), ['base', 'vat']);

  const outputVat = r2(salesRows.reduce((s, r) => s + r.vat, 0) + withheldRows.reduce((s, r) => s + r.payable, 0));
  const outputBase = r2([...salesRows, ...withheldRows, ...exemptRows].reduce((s, r) => s + r.base, 0));
  const inputVat = r2(inputRows.reduce((s, r) => s + r.vat, 0));
  const carryIn = r2(options.carryIn ?? 0);
  const net = r2(outputVat - inputVat - carryIn);

  const notes = [...(options.notes ?? [])];
  if (exemptRows.some((r) => !r.code)) notes.push('KDV oranı %0 olup istisna kodu girilmemiş satırlar var; beyanda istisna türü belirtilmelidir.');
  if (skippedForeign) notes.push(`${skippedForeign} dövizli gider indirilecek KDV'ye katılmadı; TL karşılığıyla girilmelidir.`);
  if (skippedNonDeductible) notes.push(`${skippedNonDeductible} gider "KDV indirilemez" işaretli olduğu için katılmadı.`);

  return {
    period,
    sales: salesRows,
    withheld: withheldRows,
    exempt: exemptRows,
    output: { base: outputBase, vat: outputVat, withheld: r2(withheldRows.reduce((s, r) => s + r.withheld, 0)) },
    input: { byRate: inputRows, vat: inputVat, count: inputCount },
    carryIn,
    net,
    payable: Math.max(net, 0),
    carryForward: r2(Math.max(-net, 0)),
    notes,
  };
}

/** Semicolon CSV (Excel, Turkish locale) of the summary for the accountant. */
export function vatReturnCsv(v: VatReturn): string {
  const n = (x: number) => x.toFixed(2).replace('.', ',');
  const rows: string[][] = [['KDV dönem özeti', v.period], []];
  rows.push(['Tam tevkifatsız satışlar', 'KDV %', 'Matrah', 'KDV']);
  for (const r of v.sales) rows.push(['', String(r.vatPercent), n(r.base), n(r.vat)]);
  if (v.withheld.length) {
    rows.push([], ['Kısmi tevkifat', 'Kod', 'KDV %', 'Tevkifat oranı', 'Matrah', 'KDV', 'Tevkif edilen', 'Beyan edilecek']);
    for (const r of v.withheld) rows.push([r.name, r.code, String(r.vatPercent), `${r.withholdingPercent / 10}/10`, n(r.base), n(r.vat), n(r.withheld), n(r.payable)]);
  }
  if (v.exempt.length) {
    rows.push([], ['İstisna', 'Kod', 'Matrah']);
    for (const r of v.exempt) rows.push([r.name, r.code ?? '', n(r.base)]);
  }
  rows.push([], ['İndirilecek KDV', 'KDV %', 'Matrah', 'KDV']);
  for (const r of v.input.byRate) rows.push(['', r.vatPercent === null ? 'belirtilmemiş' : String(r.vatPercent), n(r.base), n(r.vat)]);
  rows.push([], ['Hesaplanan KDV', n(v.output.vat)], ['İndirilecek KDV', n(v.input.vat)], ['Önceki dönemden devreden KDV', n(v.carryIn)], ['Ödenecek KDV', n(v.payable)], ['Sonraki döneme devreden KDV', n(v.carryForward)]);
  for (const note of v.notes) rows.push(['Not', note]);
  return rows.map((r) => r.map((c) => (/[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(';')).join('\r\n') + '\r\n';
}

/** Carry-forward into `period` from the earlier months' summaries (oldest first). */
export function carryInto(earlier: Array<Pick<VatReturn, 'output' | 'input'>>): number {
  let carry = 0;
  for (const m of earlier) carry = r2(Math.max(-(m.output.vat - m.input.vat - carry), 0));
  return carry;
}
