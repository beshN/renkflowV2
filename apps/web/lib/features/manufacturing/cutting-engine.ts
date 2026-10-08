import { colorKey } from "../colors/color-spec";
import { z } from "zod";
export const CuttingParametersSchema = z.object({
  kerfMm: z.number().nonnegative().finite().max(20),
  trimStartMm: z.number().nonnegative().finite().max(1000),
  trimEndMm: z.number().nonnegative().finite().max(1000),
  minimumRemnantMm: z.number().nonnegative().finite(),
  standardLengthMm: z.number().positive().finite().default(6000),
});
export type CuttingParameters = z.infer<typeof CuttingParametersSchema>;
/** Per-profile values; anything left out falls back to the firm's values. */
export const ItemCuttingParametersSchema = CuttingParametersSchema.partial();
export type ItemCuttingParameters = z.infer<typeof ItemCuttingParametersSchema>;
export type CutOptions = {
  /** Profile (item) id → values that differ from the firm's, e.g. a thicker saw for one profile. */
  itemParameters?: Record<string, ItemCuttingParameters>;
};
export type CutDemand = {
  itemId: string;
  color: string;
  lengthMm: number;
  quantity: number;
  workOrderId: string;
  orderItemId?: string;
};
export type CutSource = {
  id: string;
  itemId: string;
  color: string;
  lengthMm: number;
  unitCost: number;
  currency?:string|null;
  isRemnant: boolean;
};
export type CutBar = {
  source: CutSource;
  pieces: Array<{
    lengthMm: number;
    workOrderId: string;
    orderItemId?: string;
  }>;
  usedMm: number;
  remainingMm: number;
  reusable: boolean;
  lossMm: number;
};
type Strategy = "best-fit" | "length-mix";
const mm = (n: number) => Math.round(n * 1000); // Integer micrometres avoid floating-point fit errors.
// Bars and pieces of one colour group together however its name is spelled.
const groupKey = (itemId: string, color: string) => itemId + "\u0000" + colorKey(color);
export function optimizeCuts(
  demand: CutDemand[],
  sources: CutSource[],
  raw: CuttingParameters,
  options: CutOptions = {},
) {
  const parameters = CuttingParametersSchema.parse(raw);
  const overrides = new Map(
    Object.entries(options.itemParameters ?? {}).map(([itemId, value]) => [
      itemId,
      ItemCuttingParametersSchema.parse(value),
    ]),
  );
  const resolved = new Map<string, { kerf: number; trim: number; threshold: number; trimMm: number }>();
  /** The values for one profile, in micrometres. */
  const forItem = (itemId: string) => {
    let entry = resolved.get(itemId);
    if (!entry) {
      const p = { ...parameters, ...overrides.get(itemId) };
      entry = {
        kerf: mm(p.kerfMm),
        trim: mm(p.trimStartMm + p.trimEndMm),
        threshold: mm(p.minimumRemnantMm),
        trimMm: p.trimStartMm + p.trimEndMm,
      };
      resolved.set(itemId, entry);
    }
    return entry;
  };
  const pieces: CutDemand[] = [];
  for (const d of demand) {
    if (
      !Number.isInteger(d.quantity) ||
      d.quantity <= 0 ||
      !Number.isFinite(d.lengthMm) ||
      d.lengthMm <= 0
    )
      throw new Error("Kesim ihtiyacı geçersiz");
    if (pieces.length + d.quantity > 10000)
      throw new Error("Bir kesim havuzunda en fazla 10.000 parça");
    // One entry per physical piece, so anything left over is counted piece by piece.
    for (let i = 0; i < d.quantity; i++) pieces.push({ ...d, quantity: 1 });
  }
  if (new Set(sources.map((s) => s.id)).size !== sources.length)
    throw new Error("Kaynak çubuk tekrar ediyor");
  for (const s of sources)
    if (
      !Number.isFinite(s.lengthMm) ||
      s.lengthMm <= 0 ||
      !Number.isFinite(s.unitCost) ||
      s.unitCost < 0
    )
      throw new Error("Kaynak boyu veya maliyeti geçersiz");
  const ordered = [...pieces].sort(
    (a, b) =>
      b.lengthMm - a.lengthMm ||
      a.itemId.localeCompare(b.itemId) ||
      a.workOrderId.localeCompare(b.workOrderId),
  );
  /**
   * How well `source` would be used if opened for a piece needing `required` and then filled,
   * longest first, with the pieces still waiting in its group: the share of the bar left unfilled
   * (a 6 m and a 7 m bar compare fairly), then the share actually lost (a leftover long enough to
   * keep is not lost).
   */
  function score(source: CutSource, required: number, waiting: Array<[number, number]>) {
    const { kerf, trim, threshold } = forItem(source.itemId);
    const length = mm(source.lengthMm);
    let free = length - trim - required,
      cuts = 1;
    for (const [piece, count] of waiting) {
      if (free < piece + kerf) continue;
      const fit = Math.min(count, Math.floor(free / (piece + kerf)));
      free -= fit * (piece + kerf);
      cuts += fit;
    }
    const lost = trim + cuts * kerf + (free > 0 && free >= threshold ? 0 : free);
    return { unfilled: (trim + cuts * kerf + free) / length, lost: lost / length };
  }
  function pack(strategy: Strategy, remnantFirst: boolean) {
    // Unused stock per profile and colour, bundled by kind (length, remnant or not) in the pass's
    // preferred order; opening a bar looks at each kind once, not at every bar in stock.
    type Kind = { lengthMm: number; isRemnant: boolean; items: CutSource[]; next: number };
    const bars: CutBar[] = [],
      unusedByGroup = new Map<string, Kind[]>();
    for (const source of [...sources].sort(
      (a, b) =>
        (remnantFirst ? Number(b.isRemnant) - Number(a.isRemnant) : 0) ||
        a.lengthMm - b.lengthMm ||
        a.id.localeCompare(b.id),
    )) {
      const key = groupKey(source.itemId, source.color);
      const kinds = unusedByGroup.get(key) ?? [];
      const last = kinds[kinds.length - 1];
      if (last && last.lengthMm === source.lengthMm && last.isRemnant === source.isRemnant) last.items.push(source);
      else kinds.push({ lengthMm: source.lengthMm, isRemnant: source.isRemnant, items: [source], next: 0 });
      unusedByGroup.set(key, kinds);
    }
    // Pieces not placed yet, per profile and colour, by length (longest first), for the look-ahead.
    const waiting = new Map<string, Map<number, number>>();
    if (strategy === "length-mix")
      for (const piece of ordered) {
        const group = waiting.get(groupKey(piece.itemId, piece.color)) ?? new Map<number, number>();
        const length = mm(piece.lengthMm);
        group.set(length, (group.get(length) ?? 0) + 1);
        waiting.set(groupKey(piece.itemId, piece.color), group);
      }
    const openBars = new Map<string, CutBar[]>();
    const unfulfilled: CutDemand[] = [];
    for (const piece of ordered) {
      const { kerf, trim, trimMm } = forItem(piece.itemId);
      const required = mm(piece.lengthMm) + kerf;
      const group = waiting.get(groupKey(piece.itemId, piece.color));
      if (group) {
        const left = (group.get(mm(piece.lengthMm)) ?? 1) - 1;
        if (left > 0) group.set(mm(piece.lengthMm), left);
        else group.delete(mm(piece.lengthMm));
      }
      // Best fit: the open bar of this profile and colour with the least room that still fits.
      const open = openBars.get(groupKey(piece.itemId, piece.color)) ?? [];
      let bar: CutBar | undefined;
      for (const candidate of open) {
        if (mm(candidate.remainingMm) < required) continue;
        if (
          !bar ||
          candidate.remainingMm < bar.remainingMm ||
          (candidate.remainingMm === bar.remainingMm && candidate.source.id < bar.source.id)
        )
          bar = candidate;
      }
      if (!bar) {
        const kinds = (unusedByGroup.get(groupKey(piece.itemId, piece.color)) ?? []).filter(
          (k) => k.next < k.items.length && mm(k.lengthMm) - trim >= required,
        );
        let chosen: Kind | undefined;
        if (strategy === "best-fit") chosen = kinds[0];
        else {
          // K8: try each distinct bar length once and open the one this group fills best.
          const queue = [...(group ?? new Map<number, number>())].sort((a, b) => b[0] - a[0]);
          let best = { unfilled: Infinity, lost: Infinity };
          for (const kind of kinds) {
            const next = score(kind.items[kind.next], required, queue);
            // Ties keep the earlier kind: remnants first in that pass, then the shorter bar.
            if (next.unfilled < best.unfilled - 1e-9 || (Math.abs(next.unfilled - best.unfilled) <= 1e-9 && next.lost < best.lost - 1e-9)) {
              best = next;
              chosen = kind;
            }
          }
        }
        if (!chosen) {
          unfulfilled.push(piece);
          continue;
        }
        const source = chosen.items[chosen.next++];
        bar = {
          source,
          pieces: [],
          usedMm: trimMm,
          remainingMm: (mm(source.lengthMm) - trim) / 1000,
          reusable: false,
          lossMm: trimMm,
        };
        bars.push(bar);
        open.push(bar);
        openBars.set(groupKey(piece.itemId, piece.color), open);
      }
      bar.pieces.push({
        lengthMm: piece.lengthMm,
        workOrderId: piece.workOrderId,
        orderItemId: piece.orderItemId,
      });
      bar.usedMm = (mm(bar.usedMm) + required) / 1000;
      bar.remainingMm = (mm(bar.remainingMm) - required) / 1000;
      bar.lossMm = (mm(bar.lossMm) + kerf) / 1000;
    }
    for (const b of bars) {
      b.reusable = mm(b.remainingMm) >= forItem(b.source.itemId).threshold && b.remainingMm > 0;
      if (!b.reusable) b.lossMm = (mm(b.lossMm) + mm(b.remainingMm)) / 1000;
    }
    const newBars = bars.filter((b) => !b.source.isRemnant),
      wasteMm = bars.reduce((sum, b) => sum + mm(b.lossMm), 0) / 1000,
      newMaterialMm = newBars.reduce((sum, b) => sum + mm(b.source.lengthMm), 0) / 1000;
    return {
      bars,
      unfulfilled,
      newBars: newBars.length,
      wasteMm,
      newMaterialMm,
      algorithm: `${strategy}${remnantFirst ? "+remnant-first" : ""}`,
    };
  }
  // Fewest missing pieces, then fewest new bars opened, then least new material taken from stock
  // (remnants are used up before a longer bar), then least material lost.
  const variants = [
      pack("best-fit", true),
      pack("best-fit", false),
      pack("length-mix", true),
      pack("length-mix", false),
    ],
    ranked = [...variants].sort(
      (a, b) =>
        a.unfulfilled.length - b.unfulfilled.length ||
        a.newBars - b.newBars ||
        mm(a.newMaterialMm) - mm(b.newMaterialMm) ||
        mm(a.wasteMm) - mm(b.wasteMm),
    ),
    best = ranked[0];
  const inputMm = best.bars.reduce((sum, b) => sum + mm(b.source.lengthMm), 0) / 1000,
    reusableMm = best.bars.reduce(
      (sum, b) => sum + (b.reusable ? mm(b.remainingMm) : 0),
      0,
    ) / 1000;
  return {
    bars: best.bars,
    unfulfilled: best.unfulfilled,
    newBars: best.newBars,
    wasteMm: best.wasteMm,
    newMaterialMm: best.newMaterialMm,
    parameters,
    itemParameters: Object.fromEntries(overrides),
    inputMm,
    reusableMm,
    wastePercent: inputMm ? (best.wasteMm / inputMm) * 100 : 0,
    algorithm: best.algorithm,
    /** Every layout that was compared, so the choice can be checked. */
    alternatives: variants.map((v) => ({
      algorithm: v.algorithm,
      unfulfilled: v.unfulfilled.length,
      newBars: v.newBars,
      wasteMm: v.wasteMm,
      newMaterialMm: v.newMaterialMm,
    })),
    optimalityProven: false,
  };
}

/**
 * Bars to buy for pieces no stock bar could take: the same engine packs them onto bars of each
 * profile's standard length. Pieces longer than a standard bar are listed apart; buying will not help.
 */
export function planPurchase(
  unfulfilled: CutDemand[],
  standardLengthMm: (itemId: string) => number,
  raw: CuttingParameters,
  options: CutOptions = {},
) {
  if (!unfulfilled.length) return { lines: [], tooLong: [] as CutDemand[] };
  const counts = new Map<string, { itemId: string; color: string; pieces: number }>();
  for (const piece of unfulfilled) {
    const key = groupKey(piece.itemId, piece.color);
    const entry = counts.get(key) ?? { itemId: piece.itemId, color: piece.color, pieces: 0 };
    entry.pieces += piece.quantity;
    counts.set(key, entry);
  }
  const virtual: CutSource[] = [];
  for (const { itemId, color, pieces } of counts.values()) {
    const lengthMm = standardLengthMm(itemId);
    for (let i = 0; i < pieces; i++)
      virtual.push({ id: `buy:${itemId}:${color}:${i}`, itemId, color, lengthMm, unitCost: 0, isRemnant: false });
  }
  const plan = optimizeCuts(unfulfilled, virtual, raw, options);
  const lines = [...counts.values()]
    .map(({ itemId, color }) => {
      const bars = plan.bars.filter((b) => b.source.itemId === itemId && colorKey(b.source.color) === colorKey(color));
      return { itemId, color, lengthMm: standardLengthMm(itemId), bars: bars.length, pieces: bars.reduce((sum, b) => sum + b.pieces.length, 0) };
    })
    .filter((line) => line.bars > 0);
  return { lines, tooLong: plan.unfulfilled };
}
