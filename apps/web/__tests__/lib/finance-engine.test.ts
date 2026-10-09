import {
  aging, agingBucket, customerKey, draftProblems, dueDate, estimateProfit, invoiceTotals, invoiceableLines, lineTotals, overdueInvoices, settle, statement,
} from '@/lib/features/finance/engine';

const today = '2026-10-09';

describe('invoice lines', () => {
  it('VAT on the net, rounded per line; totals add the printed lines', () => {
    expect(lineTotals({ quantity: 3, unitPrice: 33.335, vatPercent: 20 })).toEqual({ net: 100.01, vat: 20, gross: 120.01 });
    expect(invoiceTotals([{ quantity: 1, unitPrice: 0.05, vatPercent: 20 }, { quantity: 1, unitPrice: 0.05, vatPercent: 20 }])).toEqual({ subtotal: 0.1, vatTotal: 0.02, total: 0.12 });
    expect(invoiceTotals([{ quantity: 2, unitPrice: 1000, vatPercent: 20 }, { quantity: 1, unitPrice: 500, vatPercent: 10 }])).toEqual({ subtotal: 2500, vatTotal: 450, total: 2950 });
  });
});

describe('partial invoicing', () => {
  const lines = [{ id: 'a', description: 'Pergola', quantity: 2, unitPrice: 10000 }, { id: 'b', description: 'Montaj', quantity: 1, unitPrice: 2000 }];
  it('what is left to invoice', () => {
    const left = invoiceableLines(lines, { a: 1 });
    expect(left.map((l) => [l.id, l.invoiced, l.remaining])).toEqual([['a', 1, 1], ['b', 0, 1]]);
  });
  it('refuses more than is left, unknown lines, zero quantities and empty drafts', () => {
    const left = invoiceableLines(lines, { a: 1 });
    expect(draftProblems([{ orderItemId: 'a', quantity: 1 }], left)).toEqual([]);
    expect(draftProblems([{ orderItemId: 'a', quantity: 1 }, { orderItemId: 'a', quantity: 0.5 }], left)).toEqual(['Pergola: kalan 1, istenen 1.5']);
    expect(draftProblems([{ orderItemId: 'x', quantity: 1 }], left)).toEqual(['Kalem bu siparişte yok']);
    expect(draftProblems([{ orderItemId: 'b', quantity: 0 }], left)).toEqual(['Miktar sıfırdan büyük olmalı']);
    expect(draftProblems([], left)).toEqual(['Faturaya en az bir kalem ekleyin']);
    // A free line (shipping) is not tied to an order line.
    expect(draftProblems([{ orderItemId: null, quantity: 1 }], left)).toEqual([]);
  });
});

describe('due dates', () => {
  it("customer's terms, else 30 days", () => {
    expect(dueDate('2026-10-09', 45)).toBe('2026-11-23');
    expect(dueDate('2026-10-09', 0)).toBe('2026-10-09');
    expect(dueDate('2026-10-09', null)).toBe('2026-11-08');
  });
});

describe('receivables', () => {
  const inv = (id: string, dueOn: string, total: number) => ({ id, number: id, issuedOn: '2026-07-01', dueOn, total });
  const invoices = [inv('F3', '2026-10-20', 1000), inv('F1', '2026-07-01', 1000), inv('F2', '2026-08-25', 1000)];
  it('collections settle the oldest due first; extra is an advance', () => {
    const s = settle(invoices, 1500, today);
    expect(s.items.map((i) => [i.id, i.paid, i.open])).toEqual([['F1', 1000, 0], ['F2', 500, 500], ['F3', 0, 1000]]);
    expect(s.advance).toBe(0);
    expect(settle(invoices, 3200, today).advance).toBe(200);
  });
  it('buckets by days past due', () => {
    expect(agingBucket('2026-10-10', today)).toBe('notDue');
    expect(agingBucket('2026-10-09', today)).toBe('d0_30');
    expect(agingBucket('2026-09-09', today)).toBe('d0_30');
    expect(agingBucket('2026-09-08', today)).toBe('d31_60');
    expect(agingBucket('2026-08-10', today)).toBe('d31_60');
    expect(agingBucket('2026-08-09', today)).toBe('d60plus');
  });
  it('aging of the open amounts and the overdue list', () => {
    const s = settle([...invoices, inv('F0', '2026-06-01', 400)], 1400, today);
    expect(aging(s.items, today)).toEqual({ notDue: 1000, d0_30: 0, d31_60: 1000, d60plus: 0, total: 2000, overdue: 1000 });
    expect(overdueInvoices(s.items, today).map((i) => i.id)).toEqual(['F2']);
  });
});

describe('statement', () => {
  it('balance brought forward, running balance, closing', () => {
    const s = statement([
      { on: '2026-08-01', kind: 'invoice', ref: 'F1', text: 'Fatura', debit: 1000, credit: 0 },
      { on: '2026-08-20', kind: 'collection', ref: 'T1', text: 'Havale', debit: 0, credit: 400 },
      { on: '2026-09-05', kind: 'collection', ref: 'T2', text: 'Nakit', debit: 0, credit: 100 },
      { on: '2026-09-05', kind: 'invoice', ref: 'F2', text: 'Fatura', debit: 500, credit: 0 },
      { on: '2026-10-15', kind: 'invoice', ref: 'F3', text: 'Fatura', debit: 9, credit: 0 },
    ], '2026-09-01', '2026-09-30');
    expect(s.opening).toBe(600);
    expect(s.lines.map((l) => [l.ref, l.balance])).toEqual([['F2', 1100], ['T2', 1000]]);
    expect([s.debit, s.credit, s.closing]).toEqual([500, 100, 1000]);
  });
});

describe('estimated profit', () => {
  it('revenue minus priced material, labour and rework', () => {
    const p = estimateProfit({ revenueNet: 20000, orderTotal: 24000, material: { amount: 8000, unpricedLots: 0, lots: 4 }, labor: { seconds: 36000, ratePerHour: 300 }, rework: 500 });
    expect([p.cost, p.profit, p.marginPercent, p.complete]).toEqual([11500, 8500, 42.5, true]);
  });
  it('never guesses: missing rate, unpriced lots and no lines are gaps', () => {
    const p = estimateProfit({ revenueNet: null, orderTotal: 12000, material: { amount: 3000, unpricedLots: 2, lots: 5 }, labor: { seconds: 3600, ratePerHour: null }, rework: 0 });
    expect(p.labor).toBeNull();
    expect(p.profit).toBe(9000);
    expect(p.complete).toBe(false);
    expect(p.gaps).toHaveLength(3);
    expect(estimateProfit({ revenueNet: 0, orderTotal: 0, material: { amount: 0, unpricedLots: 0, lots: 0 }, labor: { seconds: 0, ratePerHour: 100 }, rework: 0 }).marginPercent).toBeNull();
  });
});

describe('customer key', () => {
  it('by card, else by name', () => {
    expect(customerKey('u1', 'X')).toBe('id:u1');
    expect(customerKey(null, ' İzmir Yapı ')).toBe('name:izmir yapı');
  });
});
