/**
 * Automatic ledger entries (Tekdüzen Hesap Planı): every template balances, withholding keeps the
 * withheld VAT out of 391, and reversals mirror the original.
 */
import { CHART, COLLECTION_ACCOUNT, collectionLines, isBalanced, reversed, saleLines, expenseLines } from '@/lib/features/accounting/chart';

const totals = (lines: ReturnType<typeof saleLines>) => Object.fromEntries(lines.map((l) => [l.account, l.debit || -l.credit]));

describe('sale entry', () => {
  it('120 / 600 / 391 for an ordinary sale', () => {
    const lines = saleLines({ number: 'RNK2026000000001', customerName: 'Işık İnşaat', subtotal: 10000, vat: 2000, withholding: 0, exported: false });
    expect(totals(lines)).toEqual({ 120: 12000, 600: -10000, 391: -2000 });
    expect(isBalanced(lines)).toBe(true);
  });

  it('with 4/10 withholding the seller books only the VAT it collects', () => {
    const lines = saleLines({ number: 'RNK2026000000002', customerName: 'Işık İnşaat', subtotal: 10000, vat: 2000, withholding: 800, exported: false });
    expect(totals(lines)).toEqual({ 120: 11200, 600: -10000, 391: -1200 });
    expect(isBalanced(lines)).toBe(true);
  });

  it('export goes to 601 with no VAT line', () => {
    const lines = saleLines({ number: 'RNK2026000000003', customerName: 'GmbH', subtotal: 5000, vat: 0, withholding: 0, exported: true });
    expect(totals(lines)).toEqual({ 120: 5000, 601: -5000 });
    expect(isBalanced(lines)).toBe(true);
  });

  it('rounds to kuruş and still balances', () => {
    const lines = saleLines({ number: 'X', customerName: 'Y', subtotal: 100.01, vat: 20.002, withholding: 0, exported: false });
    expect(isBalanced(lines)).toBe(true);
  });
});

describe('collection entry', () => {
  it.each(Object.entries(COLLECTION_ACCOUNT))('%s lands on %s against 120', (method, account) => {
    const lines = collectionLines({ amount: 5000, method, label: 'Tahsilat' });
    expect(totals(lines)).toEqual({ [account]: 5000, 120: -5000 });
    expect(isBalanced(lines)).toBe(true);
  });
});

describe('reversal and chart', () => {
  it('mirrors the original', () => {
    const sale = saleLines({ number: 'N', customerName: 'C', subtotal: 1000, vat: 200, withholding: 0, exported: false });
    const back = reversed(sale, 'İptal');
    expect(totals(back)).toEqual({ 120: -1200, 600: 1000, 391: 200 });
    expect(isBalanced(back)).toBe(true);
    expect(back[0].description).toMatch(/^İptal: /);
  });

  it('has every account the templates use, once', () => {
    const codes = CHART.map((a) => a.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of ['100', '101', '102', '108', '120', '391', '600', '601', ...Object.values(COLLECTION_ACCOUNT)]) expect(codes).toContain(code);
  });
});

describe('purchase records', () => {
  const byAccount = (lines: ReturnType<typeof expenseLines>) => Object.fromEntries(lines.map((l) => [l.account, l.debit || -l.credit]));

  it('books a deductible expense to 770 and 191 against 320', () => {
    const lines = expenseLines({ net: 1000, vat: 200, deductible: true, category: 'office', label: 'Kırtasiye' });
    expect(byAccount(lines)).toEqual({ 770: 1000, 191: 200, 320: -1200 });
    expect(isBalanced(lines)).toBe(true);
  });

  it('puts material purchases on 150 (stock) and marketing on 760', () => {
    expect(byAccount(expenseLines({ net: 5000, vat: 1000, deductible: true, category: 'materials', label: 'Profil' }))).toEqual({ 150: 5000, 191: 1000, 320: -6000 });
    expect(byAccount(expenseLines({ net: 100, vat: 20, deductible: true, category: 'marketing', label: 'Reklam' }))).toEqual({ 760: 100, 191: 20, 320: -120 });
  });

  it('adds non-deductible VAT to the cost and leaves 191 alone', () => {
    const lines = expenseLines({ net: 100, vat: 10, deductible: false, category: 'other', label: 'Yemek' });
    expect(byAccount(lines)).toEqual({ 770: 110, 320: -110 });
    expect(isBalanced(lines)).toBe(true);
  });

  it('a zero-rate purchase has no VAT line', () => {
    expect(byAccount(expenseLines({ net: 300, vat: 0, deductible: true, category: 'rent', label: 'Kira' }))).toEqual({ 770: 300, 320: -300 });
  });
});

