import { compareResponses, priceHistory, shortage, supplierScore } from '@/lib/features/stock/engine';
import { reorderLevels, thresholdStatus, toMultiple, type ThresholdRow } from '@/lib/features/inventory/reorder';

const row = (over: Partial<ThresholdRow> = {}): ThresholdRow => ({
  itemId: 'i1', sku: 'SKU', name: 'Vida', uom: 'adet', minStock: 100, onHand: 120, reserved: 0, incoming: 0, drafted: 0,
  last: { supplierId: 's1', supplierName: 'Tedarikçi', supplierActive: true, warehouseId: 'w1', warehouseUsable: true, unitPrice: 2, currency: 'TRY', lengthMm: null, color: null, orderNumber: 'SAT-1' },
  ...over,
});

describe('reorder policy', () => {
  it('without a policy behaves as the minimum always did', () => {
    expect(reorderLevels(row())).toEqual({ reorderPoint: 100, target: 100, cover: 0 });
    expect(thresholdStatus(row({ onHand: 90 }))).toMatchObject({ state: 'draftable', shortfall: 10, line: { quantity: 10 } });
    expect(thresholdStatus(row())).toEqual({ state: 'ok' });
  });

  it('orders before the minimum when use during the lead time would cross it, up to the maximum, in packs', () => {
    const r = row({ onHand: 120, policy: { maxStock: 300, leadTimeDays: 10, orderMultiple: 50, dailyUsage: 3 } });
    expect(reorderLevels(r)).toEqual({ reorderPoint: 130, target: 300, cover: 30 });
    // 300 − 120 = 180 → packs of 50 → 200
    expect(thresholdStatus(r)).toMatchObject({ state: 'draftable', shortfall: 180, line: { quantity: 200 } });
  });

  it('counts what is ordered or drafted', () => {
    const r = row({ onHand: 120, incoming: 150, drafted: 30, policy: { maxStock: 300, leadTimeDays: 10, orderMultiple: null, dailyUsage: 3 } });
    expect(thresholdStatus(r)).toMatchObject({ state: 'covered' });
  });

  it('rounds up to whole packs', () => {
    expect(toMultiple(101, 50)).toBe(150);
    expect(toMultiple(100, 50)).toBe(100);
    expect(toMultiple(7, null)).toBe(7);
  });
});

describe('shortage', () => {
  it('needs against what is free for this order; incoming shown, not counted', () => {
    const lines = shortage(
      [{ itemId: 'a', name: 'Profil', uom: 'm', quantity: 30 }, { itemId: 'a', name: 'Profil', uom: 'm', quantity: 10 }, { itemId: 'b', name: 'Vida', uom: 'adet', quantity: 8 }],
      (id) => (id === 'a' ? { onHand: 50, reservedByOthers: 25, reservedForThis: 0, incoming: 20 } : { onHand: 100, reservedByOthers: 0, reservedForThis: 8, incoming: 0 }),
    );
    expect(lines).toEqual([
      { itemId: 'a', name: 'Profil', uom: 'm', quantity: 40, free: 25, incoming: 20, missing: 15, coveredByIncoming: true },
      { itemId: 'b', name: 'Vida', uom: 'adet', quantity: 8, free: 100, incoming: 0, missing: 0, coveredByIncoming: false },
    ]);
  });
});

describe('quote comparison', () => {
  const lines = [{ id: 'l1', quantity: 10 }, { id: 'l2', quantity: 2 }];
  it('suggests the cheapest complete, valid answer; shows the cheapest per line', () => {
    const c = compareResponses(lines, [
      { supplierId: 'A', supplierName: 'A', leadTimeDays: 5, validUntil: '2026-12-01', prices: [{ lineId: 'l1', unitPrice: 10 }, { lineId: 'l2', unitPrice: 50 }] },
      { supplierId: 'B', supplierName: 'B', leadTimeDays: 2, validUntil: null, prices: [{ lineId: 'l1', unitPrice: 9 }] },
      { supplierId: 'C', supplierName: 'C', leadTimeDays: 1, validUntil: '2026-01-01', prices: [{ lineId: 'l1', unitPrice: 5 }, { lineId: 'l2', unitPrice: 5 }] },
    ], '2026-10-09');
    expect(c.rows.map((r) => [r.supplierId, r.total, r.complete, r.expired])).toEqual([['A', 200, true, false], ['B', 90, false, false], ['C', 60, true, true]]);
    expect(c.cheapest.l1).toEqual({ supplierId: 'C', unitPrice: 5 });
    expect(c.suggested).toBe('A');
  });
});

describe('supplier score', () => {
  it('weighs punctuality and quality, and asks for 3 received orders before a grade', () => {
    const s = supplierScore([
      { expectedAt: '2026-09-10', sentAt: '2026-09-01T08:00:00Z', firstReceiptAt: '2026-09-10T10:00:00Z', accepted: 100, rejected: 0 },
      { expectedAt: '2026-09-20', sentAt: '2026-09-11T08:00:00Z', firstReceiptAt: '2026-09-24T10:00:00Z', accepted: 95, rejected: 5 },
      { expectedAt: null, sentAt: '2026-09-21T08:00:00Z', firstReceiptAt: '2026-09-25T10:00:00Z', accepted: 50, rejected: 0 },
      { expectedAt: '2026-10-20', sentAt: '2026-10-01T08:00:00Z', firstReceiptAt: null, accepted: 0, rejected: 0 },
    ]);
    expect([s.onTimePct, s.rejectPct, s.avgDaysLate, s.received, s.enoughData]).toEqual([50, 2, 2, 3, true]);
    expect(s.score).toBe(Math.round(0.6 * 50 + 0.4 * 90));
    expect(s.grade).toBe('C');
    expect(supplierScore([{ expectedAt: '2026-09-10', sentAt: '2026-09-01T00:00:00Z', firstReceiptAt: '2026-09-09T00:00:00Z', accepted: 1, rejected: 0 }]).grade).toBeNull();
  });
});

describe('price history', () => {
  it('groups per item and supplier with the change from the last purchase', () => {
    const h = priceHistory([
      { itemId: 'p', itemName: 'Profil', supplierId: 's', supplierName: 'S', currency: 'TRY', unitPrice: 100, at: '2026-08-01T00:00:00Z', orderNumber: 'A' },
      { itemId: 'p', itemName: 'Profil', supplierId: 's', supplierName: 'S', currency: 'TRY', unitPrice: 110, at: '2026-09-01T00:00:00Z', orderNumber: 'B' },
    ]);
    expect(h).toHaveLength(1);
    expect([h[0].last, h[0].changePct, h[0].min, h[0].max, h[0].series.length]).toEqual([110, 10, 100, 110, 2]);
  });
});
