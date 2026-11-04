jest.mock('server-only', () => ({}));
jest.mock('@/lib/features/work-orders/security', () => ({ WorkOrderApiError: class extends Error {} }));
jest.mock('@/lib/db', () => ({ getSql: jest.fn() }));
jest.mock('@/lib/features/field/common.server', () => ({}));
import { calculateMaterialReadiness, type PromiseStockLot } from '../promise-material.server';
import { CUTTING_DEFAULTS } from '../cutting-defaults';
const lot = (overrides: Partial<PromiseStockLot> = {}): PromiseStockLot => ({
  id: 'lot', itemId: 'profile', lotNumber: 'P1', quantity: 6, uom: 'm', lengthM: 6,
  color: 'RAL 7016 Mat', kind: 'new', status: 'available', reserved: false, ...overrides,
});
const input = () => ({ today: '2026-12-29',
  requirements: [{ itemId: 'profile', color: '7016 MAT', quantity: 2, uom: 'm' }],
  cuts: [{ itemId: 'profile', lengthMm: 2000, quantity: 1 }],
  items: [{ id: 'profile', uom: 'm', leadTimeDays: 5 as number | null }], lots: [lot()], cutting: CUTTING_DEFAULTS,
});
test('available profile and remnant are ready today, without requiring lead time', () => {
  const data = input();
  expect(calculateMaterialReadiness(data).readyDate).toBe(data.today);
  expect(calculateMaterialReadiness({ ...data, items: [{id:'profile',uom:'m',leadTimeDays:null}], lots: [lot({ kind: 'remnant', quantity: 2.1, lengthM: 2.1 })] }).fulfilled).toHaveLength(1);
});
test.each([{ status: 'reserved' }, { reserved: true }, { color: 'RAL 9005 Mat' }, { quantity: 6, lengthM: null }, { quantity: 2, lengthM: 2 }])('unusable/reserved/short profiles do not fulfil demand: %j', override => {
  const result = calculateMaterialReadiness({ ...input(), lots: [lot(override)] });
  expect(result.fulfilled).toHaveLength(0);
  expect(result.missing[0].shortage).toBe(2);
  expect(result.readyDate).toBe('2027-01-03');
});
test('counted profiles retain physical lengths', () => {
  const stock = lot({ uom: 'adet', quantity: 3, lengthM: null, pieceLengthMm: 1000 });
  expect(calculateMaterialReadiness({ ...input(), lots: [stock], items: [{ id:'profile', uom:'adet', leadTimeDays:5, pieceLengthMm:1000 }] }).missing).toHaveLength(1);
  expect(calculateMaterialReadiness({ ...input(), lots: [{ ...stock, pieceLengthMm: 2100 }], items: [{ id:'profile', uom:'adet', leadTimeDays:5, pieceLengthMm:2100 }] }).fulfilled).toHaveLength(1);
});
test('metres, kg and count stay separate; longest lead time determines date', () => {
  const data = input();
  data.requirements.push({ itemId: 'kg', color: '', quantity: 2, uom: 'kg' }, { itemId: 'count', color: '', quantity: 4, uom: 'adet' });
  data.items.push({ id: 'kg', uom: 'kg', leadTimeDays: 12 }, { id: 'count', uom: 'adet', leadTimeDays: 3 });
  const result = calculateMaterialReadiness(data);
  expect(result.fulfilled.map(l => l.uom)).toEqual(['m']);
  expect(result.missing.map(l => [l.uom, l.shortage])).toEqual([['kg', 2], ['adet', 4]]);
  expect(result.readyDate).toBe('2027-01-10');
});
test('undefined lead time prevents a fabricated date; zero is defined', () => {
  const data = input();
  data.items[0].leadTimeDays = null;
  const result = calculateMaterialReadiness({ ...data, lots: [] });
  expect(result.readyDate).toBeNull();
  expect(result.undefinedLeadTime[0].shortage).toBe(2);
  expect(result.missing).toEqual([]);
  data.items[0].leadTimeDays = 0;
  expect(calculateMaterialReadiness({ ...data, lots: [] }).readyDate).toBe(data.today);
});
test('partial cuts report only unfulfilled metres', () => {
  const data = input(); data.requirements[0].quantity = 4; data.cuts[0].quantity = 2;
  expect(calculateMaterialReadiness({ ...data, lots: [lot({ quantity: 2.1, lengthM: 2.1 })] }).missing[0]).toMatchObject({ available: 2, shortage: 2, uom: 'm' });
});
test('duplicate demands share stock; different units never share stock', () => {
  const result = calculateMaterialReadiness({ ...input(), cuts: [], requirements: [
    { itemId: 'profile', color: '7016 MAT', quantity: 4, uom: 'm' },
    { itemId: 'profile', color: '7016 MAT', quantity: 4, uom: 'm' },
    { itemId: 'profile', color: '7016 MAT', quantity: 1, uom: 'kg' },
  ] });
  expect(result.missing.map(l => [l.uom, l.shortage])).toEqual([['m', 2]]);
  expect(result.unitMismatch[0]).toMatchObject({ uom:'kg', stockUom:'m' });
  expect(result.readyDate).toBeNull();
});
test('invalid dates, amounts and inconsistent cut totals are rejected', () => {
  expect(() => calculateMaterialReadiness({ ...input(), today: '2026-02-30' })).toThrow();
  const data = input(); data.requirements[0].quantity = NaN;
  expect(() => calculateMaterialReadiness(data)).toThrow();
  expect(() => calculateMaterialReadiness({ ...input(), cuts: [{ itemId: 'profile', quantity: 2, lengthMm: 2000 }] })).toThrow();
});

test('partial lot and unallocated reservations subtract once per warehouse within the same unit', () => {
  const data = { ...input(), cuts: [], requirements: [{ itemId:'kg', color:'7016 MAT', quantity:7, uom:'kg' }],
    items: [{ id:'kg', uom:'kg', leadTimeDays:5 }],
    lots: [lot({ id:'k1',itemId:'kg',uom:'kg',quantity:6,warehouseId:'w',reservedQuantity:2 }),
      lot({ id:'k2',itemId:'kg',uom:'kg',quantity:5,warehouseId:'w' })],
    unallocatedReservations: [{ itemId:'kg',warehouseId:'w',quantity:2 }],
  };
  expect(calculateMaterialReadiness(data).fulfilled[0]).toMatchObject({ available:7, shortage:0 });
  expect(calculateMaterialReadiness({ ...data, unallocatedReservations:[{itemId:'kg',warehouseId:'w',quantity:20}] }).missing[0].available).toBe(0);
});
test('incompatible profile units and plain material units prevent a date', () => {
  const result = calculateMaterialReadiness({ ...input(), items:[{id:'profile',uom:'kg',leadTimeDays:5}] });
  expect(result.unitMismatch[0]).toMatchObject({uom:'m',stockUom:'kg'});
  expect(result.readyDate).toBeNull();
});
test('ambiguous partial profile reservations report their conservative exclusion', () => {
  const result = calculateMaterialReadiness({ ...input(), lots:[lot({reservedQuantity:0.1})] });
  expect(result.missing[0].shortage).toBe(2);
  expect(result.reservationWarnings[0]).toMatchObject({itemId:'profile',lotId:'lot'});
});
