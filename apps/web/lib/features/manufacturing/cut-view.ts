/**
 * What a cutting plan looks like on the shop floor: bars, their colour and length, the pieces cut
 * from them and what is left. Built from a stored plan by naming each field kept, so costs (unit
 * cost of a bar) and anything added to the plan later never reach a worker's screen.
 */
export type CutViewPiece = { lengthMm: number; workOrderId: string };
export type CutViewBar = {
  id: string;
  itemId: string;
  color: string;
  lengthMm: number;
  isRemnant: boolean;
  pieces: CutViewPiece[];
  remainingMm: number;
  reusable: boolean;
  lossMm: number;
};
export type CutView = { id: string; status: string; wastePercent: number | null; bars: CutViewBar[] };

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);

export function cutView(plan: { id: string; status: string; result: any }, visibleJobs?: Set<string>): CutView {
  const bars = Array.isArray(plan.result?.bars) ? plan.result.bars : [];
  return {
    id: plan.id,
    status: plan.status,
    wastePercent: plan.result?.wastePercent === undefined ? null : num(plan.result.wastePercent),
    bars: bars.map((b: any) => ({
      id: String(b.source?.id ?? ''),
      itemId: String(b.source?.itemId ?? ''),
      color: String(b.source?.color ?? ''),
      lengthMm: num(b.source?.lengthMm),
      isRemnant: Boolean(b.source?.isRemnant),
      // Pieces of jobs the viewer may not see keep their length but lose their work order.
      pieces: (Array.isArray(b.pieces) ? b.pieces : []).map((p: any) => {
        const id = String(p.workOrderId ?? '');
        return { lengthMm: num(p.lengthMm), workOrderId: !visibleJobs || visibleJobs.has(id) ? id : '' };
      }),
      remainingMm: num(b.remainingMm),
      reusable: Boolean(b.reusable),
      lossMm: num(b.lossMm),
    })),
  };
}
