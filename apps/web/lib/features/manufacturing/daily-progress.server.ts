import "server-only";
import { stockProfileIdentity } from "./cut-list";

/** Physical parts keep their actual stock card, while compatible coats share one technical demand. */
export async function partGroups(tx: any, tenantId: string, jobId: string) {
  const rows =
    await tx`SELECT p.*,i.name,i.sku,i.profile_code,i.size_label,i.processed_states FROM production_parts p JOIN inventory_items i ON i.id=p.item_id AND i.tenant_id=p.tenant_id JOIN work_orders w ON w.id=p.work_order_id AND w.tenant_id=p.tenant_id AND w.technical_revision_id=p.technical_revision_id WHERE p.tenant_id=${tenantId} AND p.work_order_id=${jobId} ORDER BY CASE WHEN p.state='cut' THEN 0 ELSE 1 END,p.sequence FOR UPDATE OF p`;
  const groups = new Map<string, { parts: any[]; ready: any[] }>();
  for (const p of rows) {
    const key =
      stockProfileIdentity({
        id: p.item_id,
        name: p.name,
        sku: p.sku,
        profileCode: p.profile_code,
        sizeLabel: p.size_label,
        processedStates: p.processed_states,
        standardLengthMm: null,
      }) +
      "|" +
      p.length_mm;
    const group = groups.get(key) || { parts: [], ready: [] };
    group.parts.push(p);
    if (["cut", "paint_returned"].includes(p.state)) group.ready.push(p);
    groups.set(key, group);
  }
  return [...groups.values()];
}
/** Daily physical entries also update the retained recipe operations, without duplicate user entries. */
export async function syncDailyStages(
  tx: any,
  tenantId: string,
  jobId: string,
  actorId: string,
) {
  const [job] =
    await tx`SELECT id,technical_revision_id,planned_qty FROM work_orders WHERE tenant_id=${tenantId} AND id=${jobId}`;
  if (!job?.technical_revision_id) return;
  const groups = await partGroups(tx, tenantId, jobId);
  if (!groups.length) return;
  const planned = Number(job.planned_qty),
    units = (eligible: (p: any) => boolean) =>
      Math.min(
        planned,
        ...groups.map((g) =>
          Math.floor(
            (g.parts.filter(eligible).length * planned) / g.parts.length,
          ),
        ),
      );
  const cut = units((p) => !["planned", "scrapped"].includes(p.state)),
    ready = units((p) =>
      ["cut", "paint_returned", "assembled"].includes(p.state),
    ),
    painted = groups.every((g) => g.parts.every((p) => p.target_color == null));
  const operations =
    await tx`SELECT id,name,status,completed_qty,planned_qty,quality_checks FROM production_operations WHERE tenant_id=${tenantId} AND work_order_id=${jobId} ORDER BY position FOR UPDATE`;
  const changes = [];
  for (const op of operations) {
    const isCut = /kesim|cut/i.test(op.name),
      isPaint = /boya|paint/i.test(op.name);
    if ((!isCut && !isPaint) || ["cancelled"].includes(op.status)) continue;
    if (op.quality_checks?.length) {
      if (isPaint && painted && op.name !== "Boyalı parçaların kontrolü")
        await tx`UPDATE production_operations SET name='Boyalı parçaların kontrolü',reason='Uygun boyalı stok kullanılıyor; zorunlu kontroller korunur',version=version+1 WHERE tenant_id=${tenantId} AND id=${op.id}`;
      continue;
    }
    const quantity = isCut ? cut : painted ? planned : ready,
      status =
        quantity >= planned ? "done" : quantity > 0 ? "paused" : op.status;
    if (
      quantity < Number(op.completed_qty) ||
      (quantity === Number(op.completed_qty) && status === op.status)
    )
      continue;
    const reason = isCut
      ? "Fiziksel kesim kaydından güncellendi"
      : painted
        ? "Uygun boyalı stok; boya işlemi gerekmiyor"
        : "Parça bazında boya dönüşünden güncellendi";
    await tx`UPDATE production_operations SET completed_qty=${quantity},status=${status},active_since=NULL,completed_at=${status === "done" ? new Date() : null},reason=${reason},version=version+1,updated_at=now() WHERE tenant_id=${tenantId} AND id=${op.id}`;
    changes.push({ id: op.id, quantity, status, reason });
  }
  // A later step may process the ready subset. Earlier steps retain their remaining quantities.
  const ordered =
    await tx`SELECT id,status,completed_qty FROM production_operations WHERE tenant_id=${tenantId} AND work_order_id=${jobId} ORDER BY position`;
  for (let i = 1; i < ordered.length; i++) {
    const op = ordered[i],
      available = Math.min(
        ...ordered.slice(0, i).map((o: any) => Number(o.completed_qty)),
      );
    if (op.status === "waiting" && available > Number(op.completed_qty))
      await tx`UPDATE production_operations SET status='ready',ready_at=now(),version=version+1 WHERE tenant_id=${tenantId} AND id=${op.id}`;
  }
  if (changes.length)
    await tx`INSERT INTO production_events(tenant_id,work_order_id,event_type,payload,actor_id) VALUES(${tenantId},${jobId},'production.daily_progress',${JSON.stringify({ changes })}::text::jsonb,${actorId})`;
}
