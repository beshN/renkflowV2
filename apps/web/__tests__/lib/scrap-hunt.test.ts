/**
 * "Fire avı" on the cut list: placement with kerf, waste counted the way the cutting engine counts
 * it, and the comparison with the engine on the same pieces.
 */
import { optimizeCuts } from '@/lib/features/manufacturing/cutting-engine';
import { CUTTING_DEFAULTS } from '@/lib/features/manufacturing/cutting-defaults';
import {
  DEFAULT_SCRAP_PARAMS, MAX_PARTS, barWasteMm, canPlace, nextBest, paramsFrom, partsFromPlan,
  randomParts, remainingMm, rng, scoreLayout, systemScore, verdict, type ScrapParams,
} from '@/lib/features/spells/scrap-hunt';

const P: ScrapParams = { barMm: 6000, kerfMm: 4, trimStartMm: 0, trimEndMm: 0, minimumRemnantMm: 500 };

describe('placement', () => {
  it('uses the app defaults (6000 mm bar, its kerf and remnant)', () => {
    expect(DEFAULT_SCRAP_PARAMS.barMm).toBe(CUTTING_DEFAULTS.standardLengthMm);
    expect(DEFAULT_SCRAP_PARAMS.kerfMm).toBe(CUTTING_DEFAULTS.kerfMm);
    expect(DEFAULT_SCRAP_PARAMS.minimumRemnantMm).toBe(CUTTING_DEFAULTS.minimumRemnantMm);
  });

  it('counts one kerf per piece and the trims in the room left', () => {
    expect(remainingMm([], P)).toBe(6000);
    expect(remainingMm([2000, 1500], P)).toBe(6000 - 2004 - 1504);
    expect(remainingMm([1000], { ...P, trimStartMm: 10, trimEndMm: 15 })).toBe(6000 - 25 - 1004);
  });

  it('fits a piece only when its length plus kerf is still free', () => {
    expect(canPlace([2996], 2996, P)).toBe(true); // 6000 - 3000 = 3000 = 2996 + 4
    expect(canPlace([2996], 2997, P)).toBe(false);
    expect(canPlace([], 5996, P)).toBe(true);
    expect(canPlace([], 5997, P)).toBe(false);
    expect(canPlace([1000.1], 4995.9, { ...P, kerfMm: 2 })).toBe(true); // no floating-point refusal
  });
});

describe('waste', () => {
  it('keeps a leftover at or above the shortest remnant and loses a shorter one', () => {
    expect(barWasteMm([5000], P)).toBe(4); // 996 left ≥ 500: kept, not lost
    expect(barWasteMm([2000], P)).toBe(4);
    expect(barWasteMm([5600], P)).toBe(4 + 396); // 396 < 500: lost
    expect(barWasteMm([], P)).toBe(0);
  });

  it('scores only opened bars', () => {
    const s = scoreLayout([[5600], [2000, 2000], []], P);
    expect(s.bars).toBe(2);
    expect(s.inputMm).toBe(12000);
    expect(s.wasteMm).toBe(400 + 8);
    expect(s.wastePercent).toBeCloseTo((408 / 12000) * 100, 10);
  });
});

describe('comparison with the real optimizer', () => {
  it('uses the same waste definition: the engine’s own layout scores identically here', () => {
    const random = rng(7);
    for (let round = 0; round < 25; round++) {
      const parts = randomParts(random);
      const p = { ...P, kerfMm: [3, 4, 3.5][round % 3], trimStartMm: round % 2 ? 10 : 0, trimEndMm: round % 4 ? 5 : 0 };
      const plan = optimizeCuts(
        parts.map((x) => ({ itemId: 'x', color: '', lengthMm: x.lengthMm, quantity: 1, workOrderId: x.id })),
        parts.map((_, i) => ({ id: `b${String(i).padStart(3, '0')}`, itemId: 'x', color: '', lengthMm: p.barMm, unitCost: 0, isRemnant: false })),
        { kerfMm: p.kerfMm, trimStartMm: p.trimStartMm, trimEndMm: p.trimEndMm, minimumRemnantMm: p.minimumRemnantMm, standardLengthMm: p.barMm },
      );
      // Re-scoring the engine's bars with the game's rules gives the engine's numbers.
      const replay = scoreLayout(plan.bars.map((b) => b.pieces.map((x) => x.lengthMm)), p);
      expect(replay.bars).toBe(plan.bars.length);
      expect(replay.wasteMm).toBeCloseTo(plan.wasteMm, 6);
      expect(replay.inputMm).toBeCloseTo(plan.inputMm, 6);
      expect(replay.wastePercent).toBeCloseTo(plan.wastePercent, 6);
      // Per bar too: the engine's lossMm is the game's bar waste.
      for (const b of plan.bars) expect(barWasteMm(b.pieces.map((x) => x.lengthMm), p)).toBeCloseTo(b.lossMm, 6);
      // And systemScore is that very run.
      expect(systemScore(parts, p)).toEqual({ bars: plan.bars.length, wasteMm: plan.wasteMm, inputMm: plan.inputMm, wastePercent: plan.wastePercent });
    }
  });

  it('copying the system layout is a match; one bar fewer beats, one more is behind', () => {
    const parts = [2800, 2700, 2500, 1200, 900, 600].map((lengthMm, i) => ({ id: `p${i}`, lengthMm }));
    const system = systemScore(parts, P);
    expect(verdict(system, system)).toBe('match');
    expect(verdict({ ...system, bars: system.bars + 1, wastePercent: 0 }, system)).toBe('behind');
    expect(verdict({ ...system, bars: system.bars - 1 }, system)).toBe('beat');
    expect(verdict({ ...system, wastePercent: system.wastePercent - 1 }, system)).toBe('beat');
    expect(verdict({ ...system, wastePercent: system.wastePercent + 0.04 }, { ...system, wastePercent: system.wastePercent })).not.toBe('beat');
  });

  it('keeps the best only from rounds that did not open more bars than the system', () => {
    const sys = { bars: 2, wasteMm: 100, inputMm: 12000, wastePercent: 5 };
    expect(nextBest(null, { ...sys, wastePercent: 4.24 }, sys)).toBe(4.2);
    expect(nextBest(3, { ...sys, wastePercent: 4 }, sys)).toBe(3);
    expect(nextBest(3, { ...sys, bars: 3, wastePercent: 0.1 }, sys)).toBe(3);
  });
});

describe('piece sets', () => {
  it('draws 6–14 realistic pieces', () => {
    const random = rng(42);
    for (let i = 0; i < 200; i++) {
      const parts = randomParts(random);
      expect(parts.length).toBeGreaterThanOrEqual(6);
      expect(parts.length).toBeLessThanOrEqual(14);
      for (const x of parts) { expect(x.lengthMm).toBeGreaterThanOrEqual(300); expect(x.lengthMm).toBeLessThanOrEqual(2800); }
      expect(new Set(parts.map((x) => x.id)).size).toBe(parts.length);
    }
  });

  it('takes pieces from a real plan, capped, and only those a bar can take', () => {
    const lengths = [...Array.from({ length: 40 }, (_, i) => 400 + i * 50), 7000];
    const parts = partsFromPlan(lengths, P, rng(1));
    expect(parts.length).toBe(MAX_PARTS);
    expect(parts.every((x) => lengths.includes(x.lengthMm) && x.lengthMm < 6000)).toBe(true);
    expect(partsFromPlan([1200, 800], P).map((x) => x.lengthMm)).toEqual([1200, 800]);
    expect(partsFromPlan([7000], P, rng(3)).length).toBeGreaterThanOrEqual(6); // falls back to a random set
  });

  it('reads plan values with defaults for anything missing or invalid', () => {
    expect(paramsFrom(null)).toEqual(DEFAULT_SCRAP_PARAMS);
    expect(paramsFrom({ kerfMm: 4.5, standardLengthMm: 6500, minimumRemnantMm: '' })).toEqual({ ...DEFAULT_SCRAP_PARAMS, kerfMm: 4.5, barMm: 6500 });
    expect(paramsFrom({ standardLengthMm: 0, kerfMm: -1 })).toEqual(DEFAULT_SCRAP_PARAMS);
  });
});
