import { materialReadyAt, promiseLine } from '../promise-order';
import { canPromiseOrder, effectiveAccess, presetFor } from '@/lib/security/access-matrix';

test('date-only readiness is explicitly 08:00 Istanbul, including year boundary', () => {
  expect(materialReadyAt('2027-01-01')).toBe('2027-01-01T08:00:00+03:00');
  expect(new Date(materialReadyAt('2027-01-01')).toISOString()).toBe('2027-01-01T05:00:00.000Z');
  expect(() => materialReadyAt('2027-02-29')).toThrow();
  expect(() => materialReadyAt('2026-01-01T00:00:00Z')).toThrow();
});
test('promise capability respects base role and narrowed inventory access', () => {
  expect(canPromiseOrder(effectiveAccess('office', null))).toBe(true);
  expect(canPromiseOrder(effectiveAccess('worker', null))).toBe(false);
  expect(canPromiseOrder(effectiveAccess('office', { ...presetFor('office')!, permissions: { orders: ['view'], production: ['view'] } }))).toBe(false);
});
test('missing or unpublished recipe is never guessed', () => {
  expect(() => promiseLine({}, undefined)).toThrow('Yayınlı');
  expect(() => promiseLine({}, { status: 'draft' })).toThrow('Yayınlı');
});
