import { optimizeCuts, planPurchase, type CutSource, type CuttingParameters } from '@/lib/features/manufacturing/cutting-engine';
import { CUTTING_DEFAULTS, cuttingEstimateNotice, firmCuttingParameters } from '@/lib/features/manufacturing/cutting-defaults';

// Every value is given here; nothing depends on a workshop's real settings.
const profile = '10000000-0000-4000-8000-000000000001', other = '10000000-0000-4000-8000-000000000002';
const params: CuttingParameters = { kerfMm: 3, trimStartMm: 0, trimEndMm: 0, minimumRemnantMm: 500, standardLengthMm: 6000 };
const bar = (id: string, lengthMm: number, opts: Partial<CutSource> = {}): CutSource => ({ id, itemId: profile, color: 'Antrasit', lengthMm, unitCost: 50, isRemnant: false, ...opts });
const pieces = (lengthMm: number, quantity: number, workOrderId = 'job', itemId = profile) => ({ itemId, color: 'Antrasit', lengthMm, quantity, workOrderId });
const balance = (r: ReturnType<typeof optimizeCuts>) => r.bars.flatMap((b) => b.pieces).reduce((s, p) => s + p.lengthMm, 0) + r.wasteMm + r.reusableMm;

describe('K8: bar length mix', () => {
  it('opens the bar length the pieces fill best instead of always the shortest', () => {
    // 3 × 2330 mm with 3 mm kerf needs 6999 mm: one 7 m bar holds all three, a 6 m bar only two.
    const stock = [bar('six-a', 6000), bar('six-b', 6000), bar('seven', 7000)];
    const r = optimizeCuts([pieces(2330, 3)], stock, params);
    expect(r.unfulfilled).toHaveLength(0);
    expect(r.bars.map((b) => b.source.id)).toEqual(['seven']);
    expect(r.newBars).toBe(1);
    expect(r.algorithm.startsWith('length-mix')).toBe(true);
    // The old shortest-bar layout is still compared and loses on bars opened.
    const shortest = r.alternatives.find((a) => a.algorithm === 'best-fit+remnant-first')!;
    expect(shortest.newBars).toBe(2);
    expect(r.inputMm).toBe(balance(r));
  });

  it('cuts several orders together and keeps a usable remnant before opening a new bar', () => {
    const stock = [bar('remnant', 1600, { isRemnant: true }), bar('six', 6000), bar('seven', 7000)];
    const r = optimizeCuts([pieces(1000, 1, 'job1'), pieces(2400, 2, 'job2'), pieces(1100, 1, 'job3')], stock, params);
    expect(r.unfulfilled).toHaveLength(0);
    expect(r.bars.some((b) => b.source.id === 'remnant')).toBe(true);
    expect(new Set(r.bars.flatMap((b) => b.pieces.map((p) => p.workOrderId)))).toEqual(new Set(['job1', 'job2', 'job3']));
    expect(r.inputMm).toBe(balance(r));
  });

  it('applies per-profile values over the firm values', () => {
    const stock = [bar('a', 6000), bar('b', 6000, { itemId: other })];
    const demand = [pieces(2000, 2, 'job'), pieces(2000, 2, 'job', other)];
    const r = optimizeCuts(demand, stock, params, { itemParameters: { [other]: { kerfMm: 10, trimStartMm: 20, trimEndMm: 20, minimumRemnantMm: 2000 } } });
    const firm = r.bars.find((b) => b.source.itemId === profile)!, special = r.bars.find((b) => b.source.itemId === other)!;
    expect(firm.remainingMm).toBe(6000 - 2 * 2003);
    expect(firm.reusable).toBe(true);
    expect(special.remainingMm).toBe(6000 - 40 - 2 * 2010);
    expect(special.reusable).toBe(false); // 1940 mm is under this profile's 2000 mm minimum
    expect(() => optimizeCuts(demand, stock, params, { itemParameters: { [other]: { kerfMm: -1 } } })).toThrow();
  });

  it('lists what is missing one piece at a time', () => {
    const r = optimizeCuts([pieces(2000, 4)], [bar('six', 6000)], params);
    expect(r.unfulfilled).toHaveLength(2);
    expect(r.unfulfilled.every((p) => p.quantity === 1)).toBe(true);
  });
});

describe('purchase need for missing pieces', () => {
  it('packs missing pieces onto standard bars and separates pieces longer than a bar', () => {
    const p = { ...params, trimStartMm: 5, trimEndMm: 5 };
    const missing = optimizeCuts([pieces(2000, 5), pieces(6500, 1)], [], p).unfulfilled;
    const need = planPurchase(missing, () => 6000, p);
    // 5990 mm usable per bar holds two 2003 mm cuts, so five pieces need three bars.
    expect(need.lines).toEqual([{ itemId: profile, color: 'Antrasit', lengthMm: 6000, bars: 3, pieces: 5 }]);
    expect(need.tooLong.map((x) => x.lengthMm)).toEqual([6500]);
  });

  it('uses each profile\'s own standard length', () => {
    const missing = optimizeCuts([pieces(2330, 3)], [], params).unfulfilled;
    expect(planPurchase(missing, () => 7000, params).lines[0]).toMatchObject({ lengthMm: 7000, bars: 1 });
    expect(planPurchase(missing, () => 6000, params).lines[0]).toMatchObject({ lengthMm: 6000, bars: 2 });
    expect(planPurchase([], () => 6000, params)).toEqual({ lines: [], tooLong: [] });
  });
});

describe('cutting defaults', () => {
  it('falls back to the existing defaults and says the plan is an estimate', () => {
    expect(CUTTING_DEFAULTS).toEqual({ kerfMm: 3, trimStartMm: 0, trimEndMm: 0, minimumRemnantMm: 500, standardLengthMm: 6000 });
    const none = firmCuttingParameters(null);
    expect(none).toEqual({ parameters: { ...CUTTING_DEFAULTS }, source: 'default' });
    expect(cuttingEstimateNotice(none.source)).toMatch(/Varsayılan değerler kullanıldı, atölyenize göre ayarlayın/);
  });

  it('distinguishes confirmed, entered-but-unconfirmed and legacy plans', () => {
    const row = { kerf_mm: '4', trim_start_mm: '10', trim_end_mm: '10', minimum_remnant_mm: '600', standard_length_mm: '6500' };
    expect(firmCuttingParameters({ ...row, cutting_confirmed: true })).toEqual({ parameters: { kerfMm: 4, trimStartMm: 10, trimEndMm: 10, minimumRemnantMm: 600, standardLengthMm: 6500 }, source: 'confirmed' });
    const unconfirmed = firmCuttingParameters({ ...row, cutting_confirmed: false });
    expect(unconfirmed.source).toBe('unconfirmed');
    expect(cuttingEstimateNotice(unconfirmed.source)).toMatch(/Doğrulanmamış/);
    expect(cuttingEstimateNotice('confirmed')).toBeNull();
    expect(cuttingEstimateNotice(undefined)).toBeNull();
  });
});
