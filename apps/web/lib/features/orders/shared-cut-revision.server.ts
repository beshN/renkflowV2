import "server-only";
import {
  WorkOrderApiError,
  type WorkOrderActor,
} from "../work-orders/security";
import { remainingSharedBars } from "./shared-cut-revision";
const fail = (message: string): never => {
  throw new WorkOrderApiError(message, 409);
};
/** Move uncut source reservations to a successor. Actual cuts and the original plan stay intact. */
export async function releaseRevisionCutPlans(
  tx: any,
  a: WorkOrderActor,
  ids: string[],
  ack: Array<{ planId: string; version: number }>,
  revisionId: string,
) {
  const plans =
    await tx`SELECT * FROM cutting_plans WHERE tenant_id=${a.tenantId} AND work_order_ids&&${ids}::uuid[] AND status IN('approved','completed') FOR UPDATE`;
  const shared = plans.filter((p: any) =>
    p.work_order_ids.some((id: string) => !ids.includes(id)),
  );
  if (
    ack.length !== shared.length ||
    new Set(ack.map((x) => x.planId)).size !== ack.length ||
    shared.some(
      (p: any) =>
        !ack.some((x) => x.planId === p.id && x.version === p.version),
    )
  )
    fail("Ortak kesim planlarının güncel etkisini ayrıca kabul edin.");
  const successors: any[] = [];
  for (const plan of plans) {
    if (plan.rework_ids?.length)
      fail("Açık yeniden işleme kesimini önce sonuçlandırın.");
    const consumed =
      await tx`SELECT lot_id FROM cutting_plan_sources WHERE tenant_id=${a.tenantId} AND plan_id=${plan.id} AND consumed=true`;
    const pending =
      await tx`SELECT l.* FROM cutting_plan_sources s JOIN stock_lots l ON l.id=s.lot_id AND l.tenant_id=s.tenant_id WHERE s.tenant_id=${a.tenantId} AND s.plan_id=${plan.id} AND s.consumed=false FOR UPDATE OF l`;
    const otherIds = plan.work_order_ids.filter(
      (id: string) => !ids.includes(id),
    );
    const bars = remainingSharedBars(
      plan.result.bars,
      new Set(ids),
      new Set(consumed.map((s: any) => s.lot_id)),
      plan.parameters,
      plan.result.itemParameters,
    );
    if (
      bars.some(
        (b) =>
          !pending.some(
            (l: any) =>
              l.id === b.source.id &&
              l.status === "reserved" &&
              Math.abs(Number(l.remaining_qty) * 1000 - b.source.lengthMm) <
                0.001,
          ),
      )
    )
      fail("Ortak plandaki fiziksel çubukların rezervasyonu değişti.");
    // Only unconsumed reservations are released; original consumed records remain in history.
    await tx`UPDATE stock_reservation_lines SET released_qty=reserved_qty-consumed_qty WHERE tenant_id=${a.tenantId} AND reservation_id IN(SELECT id FROM stock_reservations WHERE tenant_id=${a.tenantId} AND idempotency_key=${"cut-plan:" + plan.id})`;
    await tx`UPDATE stock_reservations SET status='released',updated_at=now() WHERE tenant_id=${a.tenantId} AND idempotency_key=${"cut-plan:" + plan.id}`;
    await tx`DELETE FROM cutting_plan_sources WHERE tenant_id=${a.tenantId} AND plan_id=${plan.id} AND consumed=false`;
    await tx`UPDATE stock_lots SET status='available',updated_at=now() WHERE tenant_id=${a.tenantId} AND id=ANY(${pending.filter((l: any) => !bars.some((b) => b.source.id === l.id)).map((l: any) => l.id)}::uuid[])`;
    if (plan.status === "approved")
      await tx`UPDATE cutting_plans SET status='cancelled',version=version+1 WHERE tenant_id=${a.tenantId} AND id=${plan.id}`;
    if (!otherIds.length) continue;
    // Existing completed pieces of other orders keep their old plan/run references.
    const otherJobs =
      await tx`SELECT id,order_id,technical_revision_id,status,cut_plan_id FROM work_orders WHERE tenant_id=${a.tenantId} AND id=ANY(${otherIds}::uuid[]) FOR UPDATE`;
    if (
      otherJobs.length !== otherIds.length ||
      otherJobs.some(
        (j: any) => j.status === "cancelled" || j.cut_plan_id !== plan.id,
      )
    )
      fail("Ortak plandaki diğer üretim listeleri değişti.");
    if (!bars.length) {
      // No future cut remains. Actual parts still point to the historical plan.
      continue;
    }
    const inputMm = bars.reduce((n, b) => n + b.source.lengthMm, 0),
      wasteMm = bars.reduce((n, b) => n + b.lossMm, 0);
    const result = {
      ...plan.result,
      bars,
      unfulfilled: [],
      stockProblems: [],
      inputMm,
      wasteMm,
      wastePercent: inputMm ? (wasteMm / inputMm) * 100 : null,
      reusableMm: bars.reduce(
        (n, b) => n + (b.reusable ? b.remainingMm : 0),
        0,
      ),
      newBars: bars.filter((b) => !b.source.isRemnant).length,
      newMaterialMm: bars.reduce(
        (n, b) => n + (b.source.isRemnant ? 0 : b.source.lengthMm),
        0,
      ),
      purchase: { lines: [], tooLong: [] },
      alternatives: [],
      algorithm: "retained-bar-assignments",
      parentPlanId: plan.id,
      technicalRevisionId: revisionId,
    };
    const demand = bars.flatMap((b) =>
      b.pieces.map((p) => ({
        ...p,
        itemId: b.source.itemId,
        color: b.source.color,
        quantity: 1,
      })),
    );
    const [next] =
      await tx`INSERT INTO cutting_plans(tenant_id,status,work_order_ids,demand,parameters,result,created_by,approved_by,approved_at,idempotency_key) VALUES(${a.tenantId},'approved',${otherIds},${JSON.stringify(demand)}::text::jsonb,${JSON.stringify(plan.parameters)}::text::jsonb,${JSON.stringify(result)}::text::jsonb,${a.userId},${a.userId},now(),${"revision-successor:" + revisionId + ":" + plan.id}) RETURNING id`;
    const [reservation] =
      await tx`INSERT INTO stock_reservations(tenant_id,work_order_id,idempotency_key,created_by) VALUES(${a.tenantId},${otherIds[0]},${"cut-plan:" + next.id},${a.userId}) RETURNING id`;
    for (const bar of bars) {
      const lot = pending.find((l: any) => l.id === bar.source.id)!;
      await tx`INSERT INTO cutting_plan_sources(tenant_id,plan_id,lot_id) VALUES(${a.tenantId},${next.id},${lot.id})`;
      await tx`INSERT INTO stock_reservation_lines(tenant_id,reservation_id,item_id,warehouse_id,lot_id,reserved_qty) VALUES(${a.tenantId},${reservation.id},${lot.item_id},${lot.warehouse_id},${lot.id},${lot.remaining_qty})`;
    }
    await tx`UPDATE work_orders SET cut_plan_id=${next.id},revision=revision+1 WHERE tenant_id=${a.tenantId} AND id=ANY(${otherIds}::uuid[])`;
    await tx`UPDATE production_parts SET cut_plan_id=${next.id} WHERE tenant_id=${a.tenantId} AND cut_plan_id=${plan.id} AND work_order_id=ANY(${otherIds}::uuid[]) AND state='planned'`;
    successors.push({
      previousPlanId: plan.id,
      planId: next.id,
      workOrderIds: otherIds,
    });
  }
  return successors;
}
