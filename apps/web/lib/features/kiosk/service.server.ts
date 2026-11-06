import 'server-only';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { requireCap } from '@/lib/features/field/common.server';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { productionCommand } from '@/lib/features/manufacturing/platform.service';

export async function requireKioskAccess(a: WorkOrderActor) {
  if (!['worker', 'owner', 'admin', 'office'].includes(a.role) || a.station)
    throw new WorkOrderApiError('Kiosk için üretim yetkisi gerekli', 403);
  await requireCap(a, 'production', 'edit', 'Kiosk');
}

// Operations, rather than job-level assignment, are authoritative for the existing command.
export async function kioskJobs(a: WorkOrderActor) {
  await requireKioskAccess(a);
  return sql`SELECT p.id,p.name,p.status,p.version,p.planned_qty,p.completed_qty,
    p.active_seconds,p.active_since,p.quality_checks,w.title,w.production_uom AS unit,
    o.order_number
    FROM production_operations p
    JOIN work_orders w ON w.id=p.work_order_id AND w.tenant_id=p.tenant_id AND w.tenant_id=${a.tenantId}
    JOIN orders o ON o.id=w.order_id AND o.tenant_id=w.tenant_id AND o.tenant_id=${a.tenantId}
    WHERE p.tenant_id=${a.tenantId} AND p.assigned_to=${a.userId}
    AND p.status IN ('waiting','ready','running','paused','blocked')
    AND w.status NOT IN ('done','cancelled')
    ORDER BY w.created_at,p.position`;
}

const Command = z.object({
  commandId: z.string().uuid(), operationId: z.string().uuid(),
  version: z.number().int().positive(), action: z.enum(['start','pause','complete']),
  quantity: z.number().int().positive().optional(),
});
export async function kioskCommand(a: WorkOrderActor, raw: unknown) {
  await requireKioskAccess(a);
  const d = Command.parse(raw);
  const [assigned] = await sql`SELECT p.id FROM production_operations p
    JOIN work_orders w ON w.id=p.work_order_id AND w.tenant_id=p.tenant_id AND w.tenant_id=${a.tenantId}
    WHERE p.tenant_id=${a.tenantId} AND p.id=${d.operationId} AND p.assigned_to=${a.userId}
    AND w.status NOT IN ('done','cancelled')`;
  if (!assigned) throw new WorkOrderApiError('Açık iş size atanmadı', 403);
  // Narrow even a production manager to worker assignment checks inside the existing
  // locked transaction. requireCap still reads the real membership and custom grants.
  return productionCommand({ ...a, role: 'worker' }, {
    commandId: d.commandId, action: 'operation',
    data: { operationId: d.operationId, version: d.version, action: d.action, quantity: d.quantity },
  });
}
