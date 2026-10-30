/**
 * "Fire avı": the cut list's little game. The player packs the same pieces onto bars by hand and is
 * then compared with the firm's own cutting engine on exactly the same pieces and values. Pure and
 * local: nothing here reads or writes a plan, stock or the server.
 *
 * Waste is counted the way the engine counts it (cutting-engine.ts): every piece takes its length
 * plus one saw kerf, the trims are lost, and what is left on a bar is lost only when it is shorter
 * than the shortest usable remnant. Waste % is lost material over the length of the bars opened.
 */
import { CUTTING_DEFAULTS } from '../manufacturing/cutting-defaults';
import { optimizeCuts, type CutDemand, type CutSource } from '../manufacturing/cutting-engine';

export type ScrapParams = {
  barMm: number;
  kerfMm: number;
  trimStartMm: number;
  trimEndMm: number;
  minimumRemnantMm: number;
};

export type ScrapPart = { id: string; lengthMm: number };

export type ScrapScore = { bars: number; wasteMm: number; inputMm: number; wastePercent: number };

export type ScrapVerdict = 'beat' | 'match' | 'behind';

export const SCRAP_BEST_KEY = 'renkflow.scrap.best';
export const MAX_PARTS = 14;

export const DEFAULT_SCRAP_PARAMS: ScrapParams = Object.freeze({
  barMm: CUTTING_DEFAULTS.standardLengthMm,
  kerfMm: CUTTING_DEFAULTS.kerfMm,
  trimStartMm: CUTTING_DEFAULTS.trimStartMm,
  trimEndMm: CUTTING_DEFAULTS.trimEndMm,
  minimumRemnantMm: CUTTING_DEFAULTS.minimumRemnantMm,
});

// Integer micrometres, as in the engine, so a piece that fits exactly is never refused by rounding.
const um = (n: number) => Math.round(n * 1000);

/** Room left on a bar after its pieces, each with one kerf, and both trims. */
export function remainingMm(pieces: number[], p: ScrapParams) {
  const used = pieces.reduce((sum, len) => sum + um(len) + um(p.kerfMm), 0);
  return (um(p.barMm) - um(p.trimStartMm + p.trimEndMm) - used) / 1000;
}

/** A piece fits when the room left still takes its length plus one kerf (the engine's rule). */
export function canPlace(pieces: number[], lengthMm: number, p: ScrapParams) {
  return um(remainingMm(pieces, p)) >= um(lengthMm) + um(p.kerfMm);
}

/** Material lost on one opened bar: trims, a kerf per piece and a leftover too short to keep. */
export function barWasteMm(pieces: number[], p: ScrapParams) {
  if (!pieces.length) return 0;
  const left = um(remainingMm(pieces, p));
  const keep = left > 0 && left >= um(p.minimumRemnantMm);
  return (um(p.trimStartMm + p.trimEndMm) + pieces.length * um(p.kerfMm) + (keep ? 0 : left)) / 1000;
}

/** Bars used and waste for a layout; empty bars are not opened and do not count. */
export function scoreLayout(bars: number[][], p: ScrapParams): ScrapScore {
  const opened = bars.filter((b) => b.length);
  const wasteUm = opened.reduce((sum, b) => sum + um(barWasteMm(b, p)), 0);
  const inputUm = opened.length * um(p.barMm);
  return { bars: opened.length, wasteMm: wasteUm / 1000, inputMm: inputUm / 1000, wastePercent: inputUm ? (wasteUm / inputUm) * 100 : 0 };
}

/** The real engine on the same pieces, with as many fresh bars as it could ever need. */
export function systemScore(parts: ScrapPart[], p: ScrapParams): ScrapScore {
  const demand: CutDemand[] = parts.map((part) => ({ itemId: 'oyun', color: '', lengthMm: part.lengthMm, quantity: 1, workOrderId: part.id }));
  const sources: CutSource[] = parts.map((_, i) => ({ id: `oyun-${String(i).padStart(3, '0')}`, itemId: 'oyun', color: '', lengthMm: p.barMm, unitCost: 0, isRemnant: false }));
  const plan = optimizeCuts(demand, sources, { kerfMm: p.kerfMm, trimStartMm: p.trimStartMm, trimEndMm: p.trimEndMm, minimumRemnantMm: p.minimumRemnantMm, standardLengthMm: p.barMm });
  if (plan.unfulfilled.length) throw new Error('Parça profile sığmıyor');
  return { bars: plan.bars.length, wasteMm: plan.wasteMm, inputMm: plan.inputMm, wastePercent: plan.wastePercent };
}

/** One decimal, as the cut list shows it. */
export const roundPercent = (n: number) => Math.round(n * 10) / 10;

/**
 * Bars first, as the engine ranks its own layouts (one bar more is never better, even when its
 * leftover is long enough to keep), then waste % at the precision the screen shows.
 */
export function verdict(player: ScrapScore, system: ScrapScore): ScrapVerdict {
  if (player.bars !== system.bars) return player.bars < system.bars ? 'beat' : 'behind';
  const a = roundPercent(player.wastePercent), b = roundPercent(system.wastePercent);
  return a < b ? 'beat' : a === b ? 'match' : 'behind';
}

/** Small, seedable generator so a test (or a replay) gets the same pieces. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/** 6–14 pieces between 300 and 2800 mm, in 5 mm steps, longest first. */
export function randomParts(random: () => number = Math.random): ScrapPart[] {
  const count = 6 + Math.floor(random() * 9);
  return Array.from({ length: count }, () => 300 + Math.round((random() * 2500) / 5) * 5)
    .sort((a, b) => b - a)
    .map((lengthMm, i) => ({ id: `p${i + 1}`, lengthMm }));
}

/**
 * Pieces from a real plan: at most MAX_PARTS, spread evenly over the list, only those a fresh bar
 * can take. Fewer than two usable pieces is not a game; a random set is used instead.
 */
export function partsFromPlan(lengths: number[], p: ScrapParams, random: () => number = Math.random): ScrapPart[] {
  const usable = lengths.filter((len) => Number.isFinite(len) && len > 0 && canPlace([], len, p));
  if (usable.length < 2) return randomParts(random);
  const step = usable.length / Math.min(MAX_PARTS, usable.length);
  const picked = Array.from({ length: Math.min(MAX_PARTS, usable.length) }, (_, i) => usable[Math.floor(i * step)]);
  return picked.sort((a, b) => b - a).map((lengthMm, i) => ({ id: `p${i + 1}`, lengthMm }));
}

/** Plan values (kerf, trims, remnant, bar) with the app's defaults for anything missing. */
export function paramsFrom(raw?: Partial<{ kerfMm: unknown; trimStartMm: unknown; trimEndMm: unknown; minimumRemnantMm: unknown; standardLengthMm: unknown }> | null): ScrapParams {
  const n = (v: unknown, fallback: number, positive = false) => {
    const x = Number(v);
    return v === null || v === undefined || v === '' || !Number.isFinite(x) || x < 0 || (positive && x <= 0) ? fallback : x;
  };
  return {
    barMm: n(raw?.standardLengthMm, DEFAULT_SCRAP_PARAMS.barMm, true),
    kerfMm: Math.min(20, n(raw?.kerfMm, DEFAULT_SCRAP_PARAMS.kerfMm)),
    trimStartMm: n(raw?.trimStartMm, DEFAULT_SCRAP_PARAMS.trimStartMm),
    trimEndMm: n(raw?.trimEndMm, DEFAULT_SCRAP_PARAMS.trimEndMm),
    minimumRemnantMm: n(raw?.minimumRemnantMm, DEFAULT_SCRAP_PARAMS.minimumRemnantMm),
  };
}

/** Lowest waste % kept so far, only from rounds that used no more bars than the system. */
export function nextBest(previous: number | null, player: ScrapScore, system: ScrapScore) {
  if (player.bars > system.bars) return previous;
  const value = roundPercent(player.wastePercent);
  return previous === null || value < previous ? value : previous;
}

export function message(v: ScrapVerdict) {
  if (v === 'beat') return 'Sistemi geçtiniz. Kesim istasyonu sizi bekliyor.';
  if (v === 'match') return 'Sistemle başa baş. Usta işi bir yerleşim.';
  return 'Sistem bu sefer önde. Bir tur daha deneyin.';
}
