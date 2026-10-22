import { effectiveAccess, presetFor } from '@/lib/security/access-matrix';
import { officeReadScope, mayReadOfficeTask } from '@/lib/features/office/access';

const owner = effectiveAccess('owner', null);
const sales = effectiveAccess('office', presetFor('sales'));
const planning = effectiveAccess('office', presetFor('planning'));
const task = { created_by: 'creator', access_scope: officeReadScope(sales) };

it('does not expose another member’s files or task text just because the base role matches', () => {
  expect(mayReadOfficeTask(sales, 'colleague', task)).toBe(false);
  expect(mayReadOfficeTask(sales, 'creator', task)).toBe(true);
});
it('rejects outputs made before a creator’s permissions were narrowed', () => {
  expect(mayReadOfficeTask(planning, 'creator', task)).toBe(false);
  expect(mayReadOfficeTask(sales, 'creator', { ...task, access_scope: officeReadScope(owner) })).toBe(false);
});
it('lets unrestricted managers supervise the firm, while narrowed managers cannot bypass the snapshot', () => {
  expect(mayReadOfficeTask(owner, 'manager', task)).toBe(true);
  const narrowed = { ...owner, hidden: ['price' as const] };
  expect(mayReadOfficeTask(narrowed, 'manager', task)).toBe(false);
});
it('fails closed for legacy and malformed scope data', () => {
  for (const access_scope of [undefined, null, {}, { modules: ['invented'], hidden: [] }, { modules: [], hidden: ['invented'] }])
    expect(mayReadOfficeTask(sales, 'creator', { created_by: 'creator', access_scope })).toBe(false);
  expect(mayReadOfficeTask(owner, 'manager', { created_by: 'creator' })).toBe(true);
});
