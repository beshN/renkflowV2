import 'server-only';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { requireCap } from '../field/common.server';
import { WorkOrderApiError, type WorkOrderActor } from '../work-orders/security';
import { requireCommercialApproval } from '../orders/quote-file.server';
import { syncDailyStages } from './daily-progress.server';
const ids = z.array(z.uuid()).min(1).max(10000).refine(v => new Set(v).size === v.length, 'Tekrarlanan parça');
const Create = z.object({ partIds: ids, supplierId: z.uuid(), expectedReturnDate: z.iso.date().optional(), note: z.string().trim().max(4000).optional() }).strict();
const Return = z.object({ dispatchId: z.uuid(), parts: z.array(z.discriminatedUnion('outcome', [
  z.object({ partId: z.uuid(), outcome: z.literal('returned') }).strict(),
  z.object({ partId: z.uuid(), outcome: z.literal('rejected'), rejectReason: z.string().trim().min(1).max(4000) }).strict(),
])).min(1).max(10000).refine(v => new Set(v.map(p => p.partId)).size === v.length, 'Tekrarlanan parça') }).strict();
function fail(message: string, status = 409): never { throw new WorkOrderApiError(message, status); }
export async function requirePaintDispatchAccess(a: WorkOrderActor, action: 'view' | 'edit') {
  const access = await requireCap(a, 'production', action, 'Boyahane sevkiyatı');
  if (!['owner', 'admin', 'office'].includes(access.base)) fail('Boyahane sevkiyatı yetkiniz yok', 403);
}
/** Called inside productionCommand's tenant lock, transaction and replay ledger. */
export async function executePaintDispatch(tx: any, a: WorkOrderActor, action: string, raw: unknown, commandId: string) {
  const t = a.tenantId;
  if (!['paint.dispatch.create', 'paint.dispatch.return'].includes(action)) fail('Geçersiz sevkiyat komutu', 400);
  const create = action === 'paint.dispatch.create' ? Create.parse(raw) : null;
  const ret = create ? null : Return.parse(raw);
  const partIds = create ? create.partIds : ret!.parts.map(p => p.partId);
  let dispatch: any;
  if (create) {
    const [supplier] = await tx`SELECT id FROM suppliers WHERE tenant_id=${t} AND id=${create.supplierId}`;
    if (!supplier) fail('Tedarikçi bulunamadı', 404);
  } else {
    [dispatch] = await tx`SELECT * FROM paint_dispatches WHERE tenant_id=${t} AND id=${ret!.dispatchId} FOR UPDATE`;
    if (!dispatch) fail('Sevkiyat bulunamadı', 404);
    if (dispatch.status === 'closed') fail('Sevkiyat kapalı');
    const members = await tx`SELECT part_id FROM paint_dispatch_parts WHERE tenant_id=${t} AND dispatch_id=${dispatch.id} AND part_id=ANY(${partIds}::uuid[]) AND outcome='sent' FOR UPDATE`;
    if (members.length !== partIds.length) fail('Parça bu sevkiyatta dönüş beklemiyor');
  }
  const parts = await tx`SELECT * FROM production_parts WHERE tenant_id=${t} AND id=ANY(${partIds}::uuid[]) ORDER BY id FOR UPDATE`;
  if (parts.length !== partIds.length) fail('Parça bulunamadı', 404);
  if (parts.some((p: any) => p.state !== (create ? 'paint_waiting' : 'paint_sent'))) fail('Parça durumu bu işlem için uygun değil');
  if (create) {
    if (!parts[0].target_color?.trim() || parts.some((p: any) => p.target_color !== parts[0].target_color)) fail('Bütün parçaların hedef rengi aynı olmalı');
    const open = await tx`SELECT part_id FROM paint_dispatch_parts WHERE tenant_id=${t} AND part_id=ANY(${partIds}::uuid[]) AND outcome='sent'`;
    if (open.length) fail('Parça açık sevkiyatta');
  }
  const jobs = [...new Set<string>(parts.map((p: any) => p.work_order_id))];
  // Same commercial/current revision and blocked-return rules as recordPartProgress.
  for (const id of jobs) {
    const [job] = await tx`SELECT * FROM work_orders WHERE tenant_id=${t} AND id=${id} FOR UPDATE`;
    if (!job) fail('Üretim kaydı bulunamadı', 404);
    await requireCommercialApproval(tx, t, job.order_id);
    if (parts.some((p: any) => p.work_order_id === id && p.technical_revision_id !== job.technical_revision_id)) fail('Teknik sürüm değişti; güncel planı açın');
    const [revision] = await tx`SELECT status FROM order_technical_revisions WHERE tenant_id=${t} AND id=${job.technical_revision_id}`;
    if (revision?.status !== 'approved' && !(revision?.status === 'blocked' && ret)) fail('Teknik plan güncel değil');
  }
  if (create) {
    const [number] = await tx`SELECT COALESCE(MAX(dispatch_number),0)+1 AS next FROM paint_dispatches WHERE tenant_id=${t}`;
    [dispatch] = await tx`INSERT INTO paint_dispatches(tenant_id,dispatch_number,supplier_id,target_color,expected_return_date,note,created_by) VALUES(${t},${number.next},${create.supplierId},${parts[0].target_color},${create.expectedReturnDate ?? null},${create.note ?? null},${a.userId}) RETURNING *`;
    for (const id of partIds) await tx`INSERT INTO paint_dispatch_parts(tenant_id,dispatch_id,part_id) VALUES(${t},${dispatch.id},${id})`;
    await tx`UPDATE production_parts SET state='paint_sent',paint_sent_at=now(),paint_returned_at=NULL,updated_by=${a.userId} WHERE tenant_id=${t} AND id=ANY(${partIds}::uuid[])`;
  } else {
    for (const p of ret!.parts) {
      await tx`UPDATE paint_dispatch_parts SET outcome=${p.outcome},reject_reason=${p.outcome === 'rejected' ? p.rejectReason : null},returned_at=now() WHERE tenant_id=${t} AND dispatch_id=${dispatch.id} AND part_id=${p.partId}`;
      await tx`UPDATE production_parts SET state=${p.outcome === 'returned' ? 'paint_returned' : 'paint_waiting'},paint_returned_at=CASE WHEN ${p.outcome}='returned' THEN now() ELSE NULL END,updated_by=${a.userId} WHERE tenant_id=${t} AND id=${p.partId}`;
    }
    const [pending] = await tx`SELECT COUNT(*)::int AS n FROM paint_dispatch_parts WHERE tenant_id=${t} AND dispatch_id=${dispatch.id} AND outcome='sent'`;
    [dispatch] = await tx`UPDATE paint_dispatches SET status=${pending.n ? 'partially_returned' : 'closed'} WHERE tenant_id=${t} AND id=${dispatch.id} RETURNING *`;
  }
  for (const id of jobs) {
    await tx`INSERT INTO production_events(tenant_id,work_order_id,event_type,payload,actor_id) VALUES(${t},${id},${action},${JSON.stringify({ commandId, dispatchId: dispatch.id, partIds: parts.filter((p: any) => p.work_order_id === id).map((p: any) => p.id) })}::text::jsonb,${a.userId})`;
    await syncDailyStages(tx, t, id, a.userId);
  }
  return { id: dispatch.id, dispatchNumber: String(dispatch.dispatch_number), status: dispatch.status };
}
export async function paintDispatches(a: WorkOrderActor, rawStatus?: string | null) {
  await requirePaintDispatchAccess(a, 'view');
  const status = rawStatus == null ? null : z.enum(['open', 'partially_returned', 'closed']).parse(rawStatus);
  return sql`SELECT d.*,s.name AS supplier_name, COUNT(*)::int AS sent_count,
    COUNT(*) FILTER(WHERE p.outcome='returned')::int AS returned_count,
    COUNT(*) FILTER(WHERE p.outcome='rejected')::int AS rejected_count,
    COUNT(*) FILTER(WHERE p.outcome='sent')::int AS pending_count,
    CASE WHEN COUNT(b.weight_per_meter_kg)=COUNT(*) THEN SUM(b.length_mm/1000*b.weight_per_meter_kg) ELSE NULL END AS weight_kg,
    (d.status<>'closed' AND d.expected_return_date IS NOT NULL AND d.expected_return_date<CURRENT_DATE) AS overdue
    FROM paint_dispatches d JOIN suppliers s ON s.tenant_id=d.tenant_id AND s.id=d.supplier_id
    JOIN paint_dispatch_parts p ON p.tenant_id=d.tenant_id AND p.dispatch_id=d.id
    JOIN production_parts b ON b.tenant_id=p.tenant_id AND b.id=p.part_id
    WHERE d.tenant_id=${a.tenantId} AND (${status}::text IS NULL AND d.status IN ('open','partially_returned') OR d.status=${status})
    GROUP BY d.id,s.name ORDER BY d.dispatch_number DESC`;
}
