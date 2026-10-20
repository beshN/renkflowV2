import 'server-only';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { requireModuleAccess } from '@/lib/security/module-access.server';
import { recordAudit } from '@/lib/audit/audit-log';
import {
  WorkOrderApiError,
  type WorkOrderActor,
} from '@/lib/features/work-orders/security';
import { StationDefinitionSchema } from './contract';
import { stationHash } from './security.server';
async function manager(a: WorkOrderActor) {
  await requireModuleAccess(a, 'settings', 'edit');
  if (!['owner', 'admin'].includes(a.role))
    throw new WorkOrderApiError('Yönetici yetkisi gerekli.', 403);
}
export async function stationSettings(a: WorkOrderActor) {
  await manager(a);
  const devices =
    await sql`SELECT id,name,kind,work_center_code,warehouse_id,instruction_ids,checklist_labels,version,last_seen_at,expires_at,revoked_at,(token_hash IS NOT NULL AND revoked_at IS NULL AND expires_at>now()) AS paired FROM station_devices WHERE tenant_id=${a.tenantId} ORDER BY created_at DESC`;
  const centers =
    await sql`SELECT code,name FROM work_centers WHERE tenant_id=${a.tenantId} AND active ORDER BY name`;
  const warehouses =
    await sql`SELECT id,name FROM warehouses WHERE tenant_id=${a.tenantId} AND active ORDER BY name`;
  const documents =
    await sql`SELECT id,title FROM knowledge_documents WHERE tenant_id=${a.tenantId} AND visibility='company' AND NOT archived ORDER BY title`;
  return { devices, centers, warehouses, documents };
}
export async function manageStation(a: WorkOrderActor, raw: unknown) {
  await manager(a);
  const d = z
    .object({
      action: z.enum(['save', 'pair', 'revoke']),
      id: z.string().uuid().optional(),
      version: z.number().int().nonnegative(),
      definition: StationDefinitionSchema.optional(),
    })
    .parse(raw);
  return sql.begin(async (tx: any) => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${a.tenantId},0))`;
    const [old] = d.id
      ? await tx`SELECT * FROM station_devices WHERE tenant_id=${a.tenantId} AND id=${d.id} FOR UPDATE`
      : [];
    if (d.id && !old) throw new WorkOrderApiError('Tablet bulunamadı.', 404);
    if ((old?.version ?? 0) !== d.version)
      throw new WorkOrderApiError('Tablet ayarı değişti. Yenileyin.', 409);
    if (d.action === 'save') {
      const def = StationDefinitionSchema.parse(d.definition);
      if (
        def.workCenterCode &&
        !(
          await tx`SELECT id FROM work_centers WHERE tenant_id=${a.tenantId} AND code=${def.workCenterCode} AND active`
        ).length
      )
        throw new WorkOrderApiError('İş merkezi bulunamadı.', 404);
      if (
        def.warehouseId &&
        !(
          await tx`SELECT id FROM warehouses WHERE tenant_id=${a.tenantId} AND id=${def.warehouseId} AND active`
        ).length
      )
        throw new WorkOrderApiError('Depo bulunamadı.', 404);
      if (def.instructionIds.length) {
        const docs =
          await tx`SELECT id FROM knowledge_documents WHERE tenant_id=${a.tenantId} AND id=ANY(${def.instructionIds}::uuid[]) AND visibility='company' AND NOT archived`;
        if (docs.length !== new Set(def.instructionIds).size)
          throw new WorkOrderApiError(
            'Talimat yalnız tüm ekibe açık şirket belgelerinden seçilebilir.',
            403,
          );
      }
      let device;
      if (old) {
        [device] =
          await tx`UPDATE station_devices SET name=${def.name},kind=${def.kind},work_center_code=${def.workCenterCode},warehouse_id=${def.warehouseId},instruction_ids=${def.instructionIds},checklist_labels=${JSON.stringify(def.checklistLabels)}::text::jsonb,version=version+1,updated_at=now() WHERE tenant_id=${a.tenantId} AND id=${old.id} RETURNING id,version`;
      } else {
        [device] =
          await tx`INSERT INTO station_devices(tenant_id,name,kind,work_center_code,warehouse_id,instruction_ids,checklist_labels,created_by) VALUES(${a.tenantId},${def.name},${def.kind},${def.workCenterCode},${def.warehouseId},${def.instructionIds},${JSON.stringify(def.checklistLabels)}::text::jsonb,${a.userId}) RETURNING id,version`;
      }
      await recordAudit(tx, {
        tenantId: a.tenantId,
        actorId: a.userId,
        entityType: 'station_device',
        entityId: device.id,
        action: 'station_assigned',
        metadata: {
          kind: def.kind,
          workCenterCode: def.workCenterCode,
          warehouseId: def.warehouseId,
        },
      });
      return device;
    }
    if (!old)
      throw new WorkOrderApiError('Önce tablet kaydını oluşturun.', 400);
    const code = d.action === 'pair' ? randomBytes(16).toString('hex') : null;
    await tx`UPDATE station_devices SET token_hash=NULL,pairing_hash=${code ? stationHash(code) : null},pairing_expires_at=${code ? new Date(Date.now() + 10 * 60_000) : null},expires_at=NULL,revoked_at=${code ? null : new Date()},created_by=${a.userId},version=version+1,updated_at=now() WHERE tenant_id=${a.tenantId} AND id=${old.id}`;
    await recordAudit(tx, {
      tenantId: a.tenantId,
      actorId: a.userId,
      entityType: 'station_device',
      entityId: old.id,
      action: code ? 'station_pairing_issued' : 'station_revoked',
    });
    return { id: old.id, code, expiresIn: code ? 600 : null };
  });
}
