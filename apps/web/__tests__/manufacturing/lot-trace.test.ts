import { LotIdentifierSchema, LotTraceQuerySchema, canTraceLots } from '@/lib/features/manufacturing/lot-trace';
import { effectiveAccess } from '@/lib/security/access-matrix';

describe('lot and heat identifiers', () => {
  test.each([undefined, null, '', '   '])('empty %p stays null', value => {
    expect(LotIdentifierSchema.parse(value)).toBeNull();
  });
  it('trims, preserves case and allows exactly 64 characters', () => {
    expect(LotIdentifierSchema.parse(' Heat-Ab ')).toBe('Heat-Ab');
    expect(LotIdentifierSchema.parse(' ' + 'x'.repeat(64) + ' ')).toHaveLength(64);
    expect(LotIdentifierSchema.safeParse('x'.repeat(65)).success).toBe(false);
    expect(LotIdentifierSchema.safeParse(123).success).toBe(false);
  });
  it('requires at least one nonblank query identifier', () => {
    expect(LotTraceQuerySchema.safeParse({}).success).toBe(false);
    expect(LotTraceQuerySchema.safeParse({ heat: ' ' }).success).toBe(false);
    expect(LotTraceQuerySchema.safeParse({ heat: 'H' }).success).toBe(true);
    expect(LotTraceQuerySchema.safeParse({ supplierLot: 'L' }).success).toBe(true);
    expect(LotTraceQuerySchema.safeParse({ heat: 'H', supplierLot: 'L' }).success).toBe(true);
  });
});

describe('lot trace access', () => {
  test.each(['owner', 'admin', 'office'] as const)('%s can read', role => {
    expect(canTraceLots(effectiveAccess(role, null))).toBe(true);
  });
  test.each(['worker', 'member', 'accountant'] as const)('%s cannot read', role => {
    expect(canTraceLots(effectiveAccess(role, null))).toBe(false);
  });
  test.each(['inventory', 'production'] as const)('requires %s:view', module => {
    const access = effectiveAccess('office', null);
    access.permissions[module] = (access.permissions[module] ?? []).filter(action => action !== 'view');
    expect(canTraceLots(access)).toBe(false);
  });
});
