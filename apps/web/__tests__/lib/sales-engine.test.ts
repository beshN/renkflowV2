import {
  addDays, allocatePayments, changeImpact, customerDiscountFor, diffQuotes, effectiveDiscountPercent, lineDeliveryStatus,
  needsDiscountApproval, planProblem, quoteTotals, sendBlocker, slipDays, tryEquivalent, type QuoteSnapshot,
} from '@/lib/features/sales/engine';
import { transitionNeedsReason, transitionProblem } from '@/lib/features/orders/transition-rules';

describe('quote totals and discounts', () => {
  const lines = [{ quantity: 2, unitPrice: 1000, discountPercent: 10 }, { quantity: 1, unitPrice: 500, discountPercent: 0 }];

  it('applies line discount, header discount, then VAT at the quote rate', () => {
    expect(quoteTotals(lines, 5, 20)).toEqual({ subtotal: 2300, discountAmount: 115, taxAmount: 437, totalAmount: 2622 });
    expect(quoteTotals(lines, 0, 10).taxAmount).toBe(230);
    expect(quoteTotals(lines, 0, 0).totalAmount).toBe(2300);
  });

  it('measures the whole discount against the list price', () => {
    // list 2500, after line discounts 2300, after 5% header 2185 → 12.6 %
    expect(effectiveDiscountPercent(lines, 5)).toBe(12.6);
    expect(effectiveDiscountPercent([], 50)).toBe(0);
  });

  it('asks for approval above the threshold unless an approval covers it', () => {
    expect(needsDiscountApproval(9, 10, null)).toBe(false);
    expect(needsDiscountApproval(12.6, 10, null)).toBe(true);
    expect(needsDiscountApproval(12.6, 10, 12.6)).toBe(false);
    expect(needsDiscountApproval(15, 10, 12.6)).toBe(true);
  });

  it('gives the TRY total only with a typed rate', () => {
    expect(tryEquivalent(100, 'TRY', null)).toBe(100);
    expect(tryEquivalent(100, 'EUR', 36.5)).toBe(3650);
    expect(tryEquivalent(100, 'EUR', null)).toBeNull();
  });

  it('prefers the family rule over the general customer discount', () => {
    const rules = [{ family: null, discountPercent: 5 }, { family: 'pergola', discountPercent: 8 }];
    expect(customerDiscountFor(rules, 'pergola')).toBe(8);
    expect(customerDiscountFor(rules, 'giyotin')).toBe(5);
    expect(customerDiscountFor([], 'pergola')).toBe(0);
  });

  it('refuses to send without lines or with a passed date', () => {
    expect(sendBlocker({ validUntil: '2026-10-01', itemCount: 1 }, '2026-10-08')).toMatch(/geçmiş/);
    expect(sendBlocker({ validUntil: null, itemCount: 0 }, '2026-10-08')).toMatch(/kalemi/);
    expect(sendBlocker({ validUntil: '2026-10-08', itemCount: 1 }, '2026-10-08')).toBeNull();
    expect(addDays('2026-10-08', 15)).toBe('2026-10-23');
  });
});

describe('quote revision diff', () => {
  const base: QuoteSnapshot = {
    revision: 1, currency: 'TRY', discountPercent: 0, vatPercent: 20, validUntil: '2026-10-20', totalAmount: 1200,
    items: [
      { productName: 'Pergola', quantity: 1, unitPrice: 800, discountPercent: 0, widthMm: 4000, color: 'RAL 7016 Mat' },
      { productName: 'Giyotin', quantity: 1, unitPrice: 200, discountPercent: 0 },
    ],
  };

  it('shows changed fields, added and removed lines, and the total delta', () => {
    const next: QuoteSnapshot = {
      ...base, revision: 2, vatPercent: 10, totalAmount: 1100,
      items: [{ ...base.items[0], widthMm: 4500, color: 'RAL 9016 Mat' }, { productName: 'Tente', quantity: 2, unitPrice: 100, discountPercent: 0 }],
    };
    const d = diffQuotes(base, next);
    expect(d.header.map((h) => h.field)).toEqual(['vatPercent', 'totalAmount']);
    expect(d.lines).toEqual([
      { kind: 'changed', productName: 'Pergola', changes: [{ field: 'widthMm', label: 'Genişlik', from: 4000, to: 4500 }, { field: 'color', label: 'Renk', from: 'RAL 7016 Mat', to: 'RAL 9016 Mat' }] },
      { kind: 'added', productName: 'Tente', changes: [] },
      { kind: 'removed', productName: 'Giyotin', changes: [] },
    ]);
    expect(d.totalDelta).toBe(-100);
  });

  it('reports nothing for an unchanged quote', () => {
    expect(diffQuotes(base, { ...base })).toEqual({ header: [], lines: [], totalDelta: 0 });
  });
});

describe('order state machine', () => {
  it('needs a reason to stop, cancel or send work back', () => {
    expect(transitionNeedsReason('approved', 'on_hold')).toBe(true);
    expect(transitionNeedsReason('pending', 'cancelled')).toBe(true);
    expect(transitionNeedsReason('quality_check', 'in_production')).toBe(true);
    expect(transitionNeedsReason('approved', 'preparing_materials')).toBe(false);
  });

  it('refuses moves outside the map and reasonless stops', () => {
    expect(transitionProblem('pending', 'in_production', '')).toMatch(/izin verilmiyor/);
    expect(transitionProblem('approved', 'cancelled', ' ')).toMatch(/gerekçe/);
    expect(transitionProblem('approved', 'cancelled', 'Müşteri vazgeçti')).toBeNull();
    expect(transitionProblem('completed', 'in_production', 'x yz')).toMatch(/izin verilmiyor/);
  });
});

describe('deliveries, promise and payment plan', () => {
  it('tracks a line as open, partial, delivered', () => {
    expect(lineDeliveryStatus(3, 0)).toBe('open');
    expect(lineDeliveryStatus(3, 1)).toBe('partial');
    expect(lineDeliveryStatus(3, 3)).toBe('delivered');
  });

  it('counts days late against the promise', () => {
    expect(slipDays(null, null, '2026-10-08')).toBeNull();
    expect(slipDays('2026-10-10', null, '2026-10-08')).toBe(0);
    expect(slipDays('2026-10-05', null, '2026-10-08')).toBe(3);
    expect(slipDays('2026-10-05', '2026-10-04', '2026-10-08')).toBe(-1);
  });

  it('wants the plan to add up to the order total', () => {
    expect(planProblem([], 100)).toMatch(/En az/);
    expect(planProblem([{ label: 'Kapora', dueOn: '2026-10-08', amount: 30 }, { label: 'Teslimde', dueOn: '2026-10-20', amount: 60 }], 100)).toMatch(/eşit/);
    expect(planProblem([{ label: 'Kapora', dueOn: '2026-10-08', amount: 30 }, { label: 'Teslimde', dueOn: '2026-10-20', amount: 70 }], 100)).toBeNull();
    expect(planProblem([{ label: 'X', dueOn: '2026-10-08', amount: 0 }], 0)).toMatch(/sıfırdan/);
  });

  it('applies payments to installments in order and finds the overdue one', () => {
    const plan = [
      { seq: 1, label: 'Kapora', dueOn: '2026-10-01', amount: 300 },
      { seq: 2, label: 'Üretimde', dueOn: '2026-10-05', amount: 300 },
      { seq: 3, label: 'Teslimde', dueOn: '2026-10-20', amount: 400 },
    ];
    const r = allocatePayments(plan, 450, '2026-10-08');
    expect(r.rows.map((x) => [x.state, x.paid, x.remaining])).toEqual([['paid', 300, 0], ['overdue', 150, 150], ['planned', 0, 400]]);
    expect([r.overdue, r.next?.seq, r.paid, r.surplus]).toEqual([150, 2, 450, 0]);
    expect(allocatePayments(plan, 1100, '2026-10-08').surplus).toBe(100);
  });
});

describe('change order impact', () => {
  const lines = [
    { orderItemId: 'a', productName: 'Pergola', quantity: 2, delivered: 0, workOrders: [{ status: 'open', producedQty: 0 }] },
    { orderItemId: 'b', productName: 'Giyotin', quantity: 1, delivered: 0, workOrders: [{ status: 'in_progress', producedQty: 0 }] },
    { orderItemId: 'c', productName: 'Tente', quantity: 3, delivered: 1, workOrders: [] },
    { orderItemId: 'd', productName: 'Kapı', quantity: 1, delivered: 0, workOrders: [] },
  ];

  it('price or note changes do not touch production', () => {
    expect(changeImpact('approved', lines, [{ orderItemId: 'a', unitPrice: 900 }])).toEqual({ level: 'none', reasons: [] });
    expect(changeImpact('approved', lines, [{ orderItemId: 'd', widthMm: 900 }]).level).toBe('none');
  });

  it('warns for an open work order and for started production', () => {
    expect(changeImpact('approved', lines, [{ orderItemId: 'a', widthMm: 4100 }]).reasons[0]).toMatch(/kesim listesi/);
    expect(changeImpact('in_production', lines, [{ orderItemId: 'b', color: 'RAL 9016' }]).reasons[0]).toMatch(/hurdaya/);
  });

  it('blocks closed orders, delivered goods and quantities under what was delivered', () => {
    expect(changeImpact('shipped', lines, [{ orderItemId: 'a', unitPrice: 1 }]).level).toBe('block');
    expect(changeImpact('approved', lines, [{ orderItemId: 'c', quantity: 0 }]).level).toBe('block');
    expect(changeImpact('approved', lines, [{ orderItemId: 'c', widthMm: 1 }]).level).toBe('block');
    expect(changeImpact('approved', lines, [{ orderItemId: 'c', quantity: 5 }]).level).toBe('none');
    expect(changeImpact('approved', lines, [{ orderItemId: 'zz', quantity: 5 }]).level).toBe('block');
  });
});
