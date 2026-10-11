import { comparePlans, explain, releasedMaterial, type PlanJob } from '@/lib/ai/commands/whatif';

const job = (id: string, order: string, finish: string, late: boolean): PlanJob => ({ workOrderId: id, label: `İE-${id}`, orderId: order, orderNumber: `ORD-${order}`, finishAt: finish, dueAt: '2026-10-15T20:59:59Z', late });

describe('what-if', () => {
  it('expedite: the order fixes itself, another job slips and is named', () => {
    const before = [job('1', 'A', '2026-10-16T10:00:00Z', true), job('2', 'B', '2026-10-14T10:00:00Z', false)];
    const after = [job('1', 'A', '2026-10-14T10:00:00Z', false), job('2', 'B', '2026-10-16T10:00:00Z', true)];
    const r = comparePlans(before, after, 'A');
    expect(r.newlyLate.map((j) => j.label)).toEqual(['İE-2']);
    expect(r.ownLateAfter).toBe(false);
    expect(r.shifted[0]).toMatchObject({ workOrderId: '2', shiftHours: 48 });
    expect(explain({ scenario: 'expedite', orderNumber: 'ORD-A', days: null }, r)).toBe('ORD-A öne alınırsa: 1 iş termine yetişmez (İE-2); ORD-A termine yetişir.');
  });
  it('delay: frees capacity, a late job is no longer late', () => {
    const before = [job('1', 'A', '2026-10-14T10:00:00Z', false), job('2', 'B', '2026-10-16T10:00:00Z', true)];
    const after = [job('1', 'A', '2026-10-18T10:00:00Z', false), job('2', 'B', '2026-10-14T10:00:00Z', false)];
    const r = comparePlans(before, after, 'A');
    expect([r.newlyLate.length, r.noLongerLate.map((j) => j.label)]).toEqual([0, ['İE-2']]);
    expect(explain({ scenario: 'delay', orderNumber: 'ORD-A', days: 2 }, r)).toContain('başka hiçbir iş gecikmeye düşmez; 1 geciken iş yetişir hale gelir');
  });
  it('cancel: released material covers the biggest needs first', () => {
    const m = releasedMaterial([{ itemId: 'p', itemName: 'Profil', quantity: 30 }], [
      { workOrderId: 'w1', label: 'İE-1', itemId: 'p', itemName: 'Profil', missing: 10 },
      { workOrderId: 'w2', label: 'İE-2', itemId: 'p', itemName: 'Profil', missing: 25 },
      { workOrderId: 'w3', label: 'İE-3', itemId: 'q', itemName: 'Vida', missing: 5 },
    ]);
    expect(m.covered.map((c) => [c.workOrderId, c.covered])).toEqual([['w2', 25], ['w1', 5]]);
    expect(m.fullyCovered).toEqual(['w2']);
  });
});
