import type {
  CutBar,
  CuttingParameters,
} from "../manufacturing/cutting-engine";
/** Retain other orders' bar assignments and piece order; only remove cuts that never happened. */
export function remainingSharedBars(
  bars: CutBar[],
  removed: Set<string>,
  consumed: Set<string>,
  parameters: CuttingParameters,
  itemParameters: Record<string, Partial<CuttingParameters>> = {},
) {
  return bars.flatMap((bar) => {
    if (consumed.has(bar.source.id)) return [];
    const pieces = bar.pieces.filter((p) => !removed.has(p.workOrderId));
    if (!pieces.length) return [];
    const p = { ...parameters, ...itemParameters[bar.source.itemId] },
      round = (n: number) => Math.round(n * 1000) / 1000;
    const cuts = pieces.reduce((n, p) => n + p.lengthMm, 0),
      kerf = pieces.length * p.kerfMm,
      trim = p.trimStartMm + p.trimEndMm;
    const remainingMm = round(bar.source.lengthMm - cuts - kerf - trim);
    if (remainingMm < 0) throw new Error("Ortak kesim ölçüleri uyuşmuyor");
    const reusable = remainingMm > 0 && remainingMm >= p.minimumRemnantMm;
    return [
      {
        ...bar,
        pieces,
        usedMm: round(cuts + kerf + trim),
        remainingMm,
        reusable,
        lossMm: round(kerf + trim + (reusable ? 0 : remainingMm)),
      },
    ];
  });
}
