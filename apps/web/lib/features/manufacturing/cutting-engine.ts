import { z } from "zod";
export const CuttingParametersSchema = z.object({
  kerfMm: z.number().nonnegative().finite().max(20),
  trimStartMm: z.number().nonnegative().finite().max(1000),
  trimEndMm: z.number().nonnegative().finite().max(1000),
  minimumRemnantMm: z.number().nonnegative().finite(),
  standardLengthMm: z.number().positive().finite().default(6000),
});
export type CuttingParameters = z.infer<typeof CuttingParametersSchema>;
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
const mm = (n: number) => Math.round(n * 1000); // Integer micrometres avoid floating-point fit errors.
export function optimizeCuts(
  demand: CutDemand[],
  sources: CutSource[],
  raw: CuttingParameters,
) {
  const parameters = CuttingParametersSchema.parse(raw),
    kerf = mm(parameters.kerfMm),
    trim = mm(parameters.trimStartMm + parameters.trimEndMm),
    threshold = mm(parameters.minimumRemnantMm);
  const pieces: demandPiece[] = [];
  type demandPiece = CutDemand;
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
    for (let i = 0; i < d.quantity; i++) pieces.push(d);
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
  function pack(remnantFirst: boolean) {
    const bars: CutBar[] = [],
      unused = [...sources].sort(
        (a, b) =>
          (remnantFirst ? Number(b.isRemnant) - Number(a.isRemnant) : 0) ||
          a.lengthMm - b.lengthMm ||
          a.id.localeCompare(b.id),
      );
    const unfulfilled: CutDemand[] = [];
    for (const piece of ordered) {
      const required = mm(piece.lengthMm) + kerf;
      const candidates = bars
        .filter(
          (b) =>
            b.source.itemId === piece.itemId &&
            b.source.color === piece.color &&
            mm(b.remainingMm) >= required,
        )
        .sort(
          (a, b) =>
            a.remainingMm - b.remainingMm ||
            a.source.id.localeCompare(b.source.id),
        );
      let bar = candidates[0];
      if (!bar) {
        const index = unused.findIndex(
          (s) =>
            s.itemId === piece.itemId &&
            s.color === piece.color &&
            mm(s.lengthMm) - trim >= required,
        );
        if (index < 0) {
          unfulfilled.push(piece);
          continue;
        }
        const source = unused.splice(index, 1)[0];
        bar = {
          source,
          pieces: [],
          usedMm: parameters.trimStartMm + parameters.trimEndMm,
          remainingMm: (mm(source.lengthMm) - trim) / 1000,
          reusable: false,
          lossMm: parameters.trimStartMm + parameters.trimEndMm,
        };
        bars.push(bar);
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
      b.reusable = mm(b.remainingMm) >= threshold && b.remainingMm > 0;
      if (!b.reusable) b.lossMm = (mm(b.lossMm) + mm(b.remainingMm)) / 1000;
    }
    const newBars = bars.filter((b) => !b.source.isRemnant).length,
      wasteMm = bars.reduce((sum, b) => sum + b.lossMm, 0);
    return { bars, unfulfilled, newBars, wasteMm };
  }
  const variants = [pack(true), pack(false)].sort(
      (a, b) =>
        a.unfulfilled.length - b.unfulfilled.length ||
        a.newBars - b.newBars ||
        a.wasteMm - b.wasteMm,
    ),
    best = variants[0];
  const inputMm = best.bars.reduce((sum, b) => sum + b.source.lengthMm, 0),
    reusableMm = best.bars.reduce(
      (sum, b) => sum + (b.reusable ? b.remainingMm : 0),
      0,
    );
  return {
    ...best,
    parameters,
    inputMm,
    reusableMm,
    wastePercent: inputMm ? (best.wasteMm / inputMm) * 100 : 0,
    algorithm: "deterministic-best-fit-2-pass",
    optimalityProven: false,
  };
}
