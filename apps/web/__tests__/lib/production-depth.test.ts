import { bomRecalcBlocker, dailyCapacity, DEFAULT_REASONS, istanbulDay, pareto, planHistory, reasonCodeFrom } from '@/lib/features/production/engine';
import { chooseBarLengths } from '@/lib/features/manufacturing/cutting-engine';

describe('reason catalogue', () => {
  it('starts every firm with scrap, rework and delay reasons; rework keeps the codes production uses', () => {
    expect(DEFAULT_REASONS.rework.map((r) => r.code)).toEqual(['measurement', 'material', 'assembly', 'quality', 'other']);
    expect(DEFAULT_REASONS.scrap.length).toBeGreaterThan(3);
    expect(DEFAULT_REASONS.delay.some((r) => r.code === 'material')).toBe(true);
  });

  it('turns a Turkish label into a code', () => {
    expect(reasonCodeFrom('Boya çizildi')).toBe('boya_cizildi');
    expect(reasonCodeFrom('Şerit testere kırıldı!')).toBe('serit_testere_kirildi');
    expect(reasonCodeFrom('***')).toBe('kod');
  });
});

describe('pareto', () => {
  it('sorts by impact with running share and marks the vital few', () => {
    const rows = pareto([
      { code: 'a', label: 'Boya', count: 2 },
      { code: 'b', label: 'Kesim', count: 6 },
      { code: 'c', label: 'Taşıma', count: 2 },
    ]);
    expect(rows.map((r) => [r.code, r.share, r.cumulative, r.vital])).toEqual([
      ['b', 60, 60, true],
      ['a', 20, 80, true],
      ['c', 20, 100, false],
    ]);
    expect(pareto([], 'count')).toEqual([]);
  });

  it('can weigh by quantity', () => {
    const rows = pareto([{ code: 'a', label: 'A', count: 5, quantity: 1 }, { code: 'b', label: 'B', count: 1, quantity: 9 }], 'quantity');
    expect(rows[0].code).toBe('b');
  });
});

describe('daily capacity', () => {
  const center = { code: 'KESIM', name: 'Kesim', parallelCapacity: 2, shiftStart: '08:00', shiftEnd: '18:00', workDays: [1, 2, 3, 4, 5] };

  it('counts booked minutes per Istanbul day against shift × places', () => {
    // Friday 9 Oct 2026, 09:00–12:00 Istanbul = 06:00–09:00 UTC
    const tasks = [{ workCenterCode: 'KESIM', segments: [{ start: '2026-10-09T06:00:00Z', end: '2026-10-09T09:00:00Z' }], late: true, workOrderId: 'w1' }];
    const [row] = dailyCapacity(tasks, [center], '2026-10-09', 3);
    expect(row.days[0]).toEqual({ day: '2026-10-09', available: 1200, booked: 180, load: 15 });
    expect(row.days[1]).toEqual({ day: '2026-10-10', available: 0, booked: 0, load: 0 });
    expect(row.lateJobs).toBe(1);
  });

  it('splits a segment that crosses midnight Istanbul', () => {
    const tasks = [{ workCenterCode: 'KESIM', segments: [{ start: '2026-10-12T20:00:00Z', end: '2026-10-12T22:00:00Z' }] }];
    const [row] = dailyCapacity(tasks, [center], '2026-10-12', 2);
    expect(row.days.map((d) => d.booked)).toEqual([60, 60]);
  });

  it('reads Istanbul calendar days', () => {
    expect(istanbulDay('2026-10-08T21:30:00Z')).toBe('2026-10-09');
  });
});

describe('cutting plan history', () => {
  it('orders plans and shows whether a re-plan wasted less', () => {
    const h = planHistory([
      { id: 'b', status: 'approved', version: 2, createdAt: '2026-10-09T10:00:00Z', result: { wastePercent: 6.24, bars: [1, 2, 3], newBars: 1 } },
      { id: 'a', status: 'cancelled', version: 2, createdAt: '2026-10-09T08:00:00Z', result: { wastePercent: 9.1, bars: [1, 2, 3, 4] } },
    ]);
    expect(h.map((r) => [r.id, r.n, r.wastePercent, r.bars, r.wasteDelta])).toEqual([['a', 1, 9.1, 4, null], ['b', 2, 6.2, 3, -2.9]]);
  });
});

describe('bill of materials recalculation', () => {
  it('only for a job not planned, started or produced', () => {
    expect(bomRecalcBlocker({ status: 'open', cutPlanId: null, producedQty: 0, startedOperations: 0 })).toBeNull();
    expect(bomRecalcBlocker({ status: 'open', cutPlanId: 'p', producedQty: 0, startedOperations: 0 })).toMatch(/Kesim planına/);
    expect(bomRecalcBlocker({ status: 'in_progress', cutPlanId: null, producedQty: 0, startedOperations: 1 })).toMatch(/rework/);
    expect(bomRecalcBlocker({ status: 'done', cutPlanId: null, producedQty: 1, startedOperations: 0 })).toMatch(/kapanmış/);
  });
});

describe('bar length options', () => {
  const params = { kerfMm: 4, trimStartMm: 10, trimEndMm: 10, minimumRemnantMm: 500, standardLengthMm: 6000 } as any;
  const demand = (lengthMm: number, quantity: number) => ({ itemId: 'p1', color: 'RAL 7016', lengthMm, quantity, workOrderId: 'w' });

  it('buys the length that wastes least for the pieces', () => {
    // 3200 mm pieces: two fit a 6500 bar (6500-20-8 ≥ 6400) but not a 6000 one.
    const chosen = chooseBarLengths([demand(3200, 4)], () => [6000, 6500, 7000], params).get('p1')!;
    expect(chosen.lengthMm).toBe(6500);
    expect(chosen.bars).toBe(2);
    expect(chosen.alternatives.map((a) => a.lengthMm)).toEqual([6500, 7000, 6000]);
  });

  it('never picks a bar the pieces do not fit', () => {
    const chosen = chooseBarLengths([demand(6800, 1)], () => [6000, 7000], params).get('p1')!;
    expect(chosen.lengthMm).toBe(7000);
  });
});
