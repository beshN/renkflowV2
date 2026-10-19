// The Tekdüzen Hesap Planı accounts RenkFlow posts to automatically. The firm's accountant may add
// more; these are created when missing and never renamed or removed.

export type ChartAccount = { code: string; name: string; type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' };

export const CHART: readonly ChartAccount[] = [
  { code: '100', name: 'Kasa', type: 'asset' },
  { code: '101', name: 'Alınan Çekler', type: 'asset' },
  { code: '102', name: 'Bankalar', type: 'asset' },
  { code: '108', name: 'Diğer Hazır Değerler', type: 'asset' },
  { code: '120', name: 'Alıcılar', type: 'asset' },
  { code: '150', name: 'İlk Madde ve Malzeme', type: 'asset' },
  { code: '191', name: 'İndirilecek KDV', type: 'asset' },
  { code: '320', name: 'Satıcılar', type: 'liability' },
  { code: '340', name: 'Alınan Sipariş Avansları', type: 'liability' },
  { code: '360', name: 'Ödenecek Vergi ve Fonlar', type: 'liability' },
  { code: '391', name: 'Hesaplanan KDV', type: 'liability' },
  { code: '600', name: 'Yurt İçi Satışlar', type: 'revenue' },
  { code: '601', name: 'Yurt Dışı Satışlar', type: 'revenue' },
  { code: '602', name: 'Diğer Gelirler', type: 'revenue' },
  { code: '760', name: 'Pazarlama Satış ve Dağıtım Giderleri', type: 'expense' },
  { code: '770', name: 'Genel Yönetim Giderleri', type: 'expense' },
];

/** Where a purchase record is booked, by its category. Material purchases are stock, not expense. */
export const EXPENSE_ACCOUNT: Record<string, string> = {
  materials: '150',
  marketing: '760',
};

/** Where a collection lands, by payment method. */
export const COLLECTION_ACCOUNT: Record<string, string> = {
  cash: '100',
  check: '101',
  bank_transfer: '102',
  credit_card: '108',
  card: '108',
  other: '102',
};

export type LedgerLine = { account: string; debit: number; credit: number; description: string };

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type SaleInput = {
  number: string;
  customerName: string;
  /** Amounts in TRY (foreign-currency invoices are converted before this). */
  subtotal: number;
  vat: number;
  withholding: number;
  /** Export (ISTISNA with a 301 line) goes to 601. */
  exported: boolean;
};

/**
 * Seller's entry for an issued invoice. With withholding (tevkifat) the buyer pays the withheld
 * VAT to the tax office, so the seller records as payable VAT (391) only the part it collects:
 *   120 Alıcılar        net + VAT − withheld   (debit)
 *   600/601 Satışlar    net                    (credit)
 *   391 Hesaplanan KDV  VAT − withheld         (credit)
 */
export function saleLines(s: SaleInput): LedgerLine[] {
  const collectedVat = round2(s.vat - s.withholding);
  const receivable = round2(s.subtotal + collectedVat);
  const lines: LedgerLine[] = [
    { account: '120', debit: receivable, credit: 0, description: `${s.number} · ${s.customerName}` },
    { account: s.exported ? '601' : '600', debit: 0, credit: round2(s.subtotal), description: `${s.number} satış` },
  ];
  if (collectedVat > 0) lines.push({ account: '391', debit: 0, credit: collectedVat, description: `${s.number} hesaplanan KDV` });
  return lines.filter((l) => l.debit > 0 || l.credit > 0);
}

export function collectionLines(p: { amount: number; method: string; label: string }): LedgerLine[] {
  const amount = round2(p.amount);
  return [
    { account: COLLECTION_ACCOUNT[p.method] ?? '102', debit: amount, credit: 0, description: p.label },
    { account: '120', debit: 0, credit: amount, description: p.label },
  ];
}

/**
 * Purchase invoice or expense, unpaid until the supplier payment is recorded:
 *   150/760/770        net (+ VAT when it cannot be deducted)   (debit)
 *   191 İndirilecek KDV VAT, when deductible                     (debit)
 *   320 Satıcılar       net + VAT                                (credit)
 */
export function expenseLines(x: { net: number; vat: number; deductible: boolean; category: string; label: string }): LedgerLine[] {
  const net = round2(x.net);
  const vat = round2(x.vat);
  const lines: LedgerLine[] = [
    { account: EXPENSE_ACCOUNT[x.category] ?? '770', debit: x.deductible ? net : round2(net + vat), credit: 0, description: x.label },
  ];
  if (x.deductible && vat > 0) lines.push({ account: '191', debit: vat, credit: 0, description: `${x.label} indirilecek KDV` });
  lines.push({ account: '320', debit: 0, credit: round2(net + vat), description: x.label });
  return lines.filter((l) => l.debit > 0 || l.credit > 0);
}

/** The same entry with debits and credits swapped (cancellation, deleted collection). */
export function reversed(lines: LedgerLine[], note: string): LedgerLine[] {
  return lines.map((l) => ({ account: l.account, debit: l.credit, credit: l.debit, description: `${note}: ${l.description}` }));
}

export function isBalanced(lines: LedgerLine[]): boolean {
  const debit = round2(lines.reduce((s, l) => s + l.debit, 0));
  const credit = round2(lines.reduce((s, l) => s + l.credit, 0));
  return debit > 0 && Math.abs(debit - credit) < 0.005;
}
