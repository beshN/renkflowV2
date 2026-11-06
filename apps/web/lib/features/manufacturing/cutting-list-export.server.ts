import 'server-only';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { WorkOrderApiError, requireWorkOrderPermission, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { cuttingListCsv, storedMillimetres, type CuttingCsvRow } from './cutting-list-csv';

/** Same office roles as cutPlanSheet; membership narrowing also applies. SELECT only. */
export async function exportCuttingList(actor: WorkOrderActor, id: string) {
  if (!['owner', 'admin', 'office'].includes(actor.role)) throw new WorkOrderApiError('Yönetim yetkisi gerekli', 403);
  requireWorkOrderPermission(actor, 'view');
  if (!z.string().uuid().safeParse(id).success) throw new WorkOrderApiError('Kesim planı bulunamadı', 404);
  const t = actor.tenantId;
  const [plan] = await sql`SELECT id,status,result FROM cutting_plans WHERE tenant_id=${t} AND id=${id}`;
  if (!plan) throw new WorkOrderApiError('Kesim planı bulunamadı', 404);
  // Text comparisons tolerate missing legacy IDs; every joined table is tenant constrained.
  const rows = await sql`
    SELECT b.position AS bar_position, p.position AS piece_position,
      b.value->'source'->'lengthMm' AS profile_length_mm, p.value->'lengthMm' AS piece_length_mm,
      b.value->'remainingMm' AS remaining_mm, i.profile_code, i.name AS profile_name, o.order_number
    FROM cutting_plans c
    CROSS JOIN LATERAL jsonb_array_elements(coalesce(c.result->'bars','[]'::jsonb)) WITH ORDINALITY b(value,position)
    CROSS JOIN LATERAL jsonb_array_elements(coalesce(b.value->'pieces','[]'::jsonb)) WITH ORDINALITY p(value,position)
    LEFT JOIN inventory_items i ON i.id::text=b.value->'source'->>'itemId' AND i.tenant_id=c.tenant_id AND i.tenant_id=${t}
    LEFT JOIN work_orders w ON w.id::text=p.value->>'workOrderId' AND w.tenant_id=c.tenant_id AND w.tenant_id=${t}
    LEFT JOIN orders o ON o.id=w.order_id AND o.tenant_id=w.tenant_id AND o.tenant_id=${t}
    WHERE c.tenant_id=${t} AND c.id=${id}
    ORDER BY b.position,p.position`;
  return cuttingListCsv(rows.map((r: Record<string, unknown>): CuttingCsvRow => ({
    orderNumber: r.order_number as string | null, profileCode: r.profile_code as string | null,
    profileName: r.profile_name as string | null, profileLengthMm: storedMillimetres(r.profile_length_mm),
    pieceLengthMm: storedMillimetres(r.piece_length_mm), remainingMm: storedMillimetres(r.remaining_mm),
    barPosition: Number(r.bar_position), piecePosition: Number(r.piece_position),
    parameterSource: plan.result?.parameterSource, status: plan.status,
  })));
}
