import { groupReorder, thresholdStatus, type ThresholdRow } from '@/lib/features/inventory/reorder';

const last = { supplierId: 's1', supplierName: 'Tedarikçi A', supplierActive: true, warehouseId: 'w1', unitPrice: 10, currency: 'TRY', lengthMm: null, color: null, orderNumber: 'SAT-1' };
const row = (over: Partial<ThresholdRow>): ThresholdRow => ({ itemId: 'i1', sku: 'S', name: 'N', uom: 'adet', minStock: 10, onHand: 0, reserved: 0, incoming: 0, drafted: 0, last, ...over });

describe('stock threshold', () => {
  it('is fine at or above the minimum, and without a minimum', () => {
    expect(thresholdStatus(row({ onHand: 10 })).state).toBe('ok');
    expect(thresholdStatus(row({ minStock: 0 })).state).toBe('ok');
  });

  it('counts reservations against stock and orders towards it', () => {
    expect(thresholdStatus(row({ onHand: 12, reserved: 5 }))).toMatchObject({ state: 'draftable', shortfall: 3, line: { quantity: 3 } });
    expect(thresholdStatus(row({ onHand: 4, incoming: 4, drafted: 2 }))).toEqual({ state: 'covered', shortfall: 6 });
    expect(thresholdStatus(row({ onHand: 4, incoming: 4 }))).toMatchObject({ state: 'draftable', shortfall: 2 });
  });

  it('rounds counted units up to whole pieces and profiles up to whole bars of the last length', () => {
    expect(thresholdStatus(row({ onHand: 7.5, uom: 'takim' }))).toMatchObject({ line: { quantity: 3 } });
    const profile = thresholdStatus(row({ uom: 'm', minStock: 100, onHand: 40, last: { ...last, lengthMm: 6500, color: '7016 Mat' } }));
    expect(profile).toMatchObject({ state: 'draftable', shortfall: 60, line: { quantity: 10, lengthMm: 6500, color: '7016 Mat', unitPrice: 10, warehouseId: 'w1' } });
    expect(thresholdStatus(row({ uom: 'kg', minStock: 1, onHand: 0.25 }))).toMatchObject({ line: { quantity: 0.75 } });
  });

  it('guesses nothing it was not given', () => {
    expect(thresholdStatus(row({ last: null }))).toMatchObject({ state: 'unknown', reason: expect.stringMatching(/Daha önce satın alınmamış/) });
    expect(thresholdStatus(row({ last: { ...last, supplierActive: false } }))).toMatchObject({ state: 'unknown', reason: expect.stringMatching(/pasif/) });
    expect(thresholdStatus(row({ last: { ...last, unitPrice: null } }))).toMatchObject({ state: 'unknown' });
    expect(thresholdStatus(row({ uom: 'm', last: { ...last, lengthMm: 6000, color: null } }))).toMatchObject({ state: 'unknown', reason: expect.stringMatching(/renk/) });
    // Never a draft the purchase order would refuse: at most 10 000 bars on a line.
    expect(thresholdStatus(row({ uom: 'm', minStock: 100000, last: { ...last, lengthMm: 6000, color: 'Gri' } }))).toMatchObject({ state: 'unknown', reason: expect.stringMatching(/minimum stoğu kontrol edin/) });
    expect(thresholdStatus(row({ uom: 'm', minStock: 60000, last: { ...last, lengthMm: 6000, color: 'Gri' } }))).toMatchObject({ state: 'draftable', line: { quantity: 10000 } });
  });

  it('groups draft lines by supplier and currency in a fixed order', () => {
    const orders = groupReorder([
      row({ itemId: 'b' }),
      row({ itemId: 'a' }),
      row({ itemId: 'c', last: { ...last, currency: 'EUR' } }),
      row({ itemId: 'd', last: null }),
      row({ itemId: 'e', onHand: 50 }),
    ]);
    expect(orders.map((o) => [o.currency, o.lines.map((l) => l.itemId)])).toEqual([['EUR', ['c']], ['TRY', ['a', 'b']]]);
  });
});
