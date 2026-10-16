import 'server-only';
import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { assertCompanyHostTenant } from '@/lib/features/company/host.server';
import {
  WorkOrderApiError,
  type WorkOrderActor,
} from '@/lib/features/work-orders/security';
import { OperationCommandSchema } from '@/lib/features/manufacturing/platform-contract';
import { stationChecks } from './checklists.server';
import { stationCookieName } from './contract';
export const stationHash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export type StationDevice = {
  id: string;
  tenant_id: string;
  name: string;
  kind: 'warehouse' | 'cutting' | 'assembly' | 'packing';
  work_center_code: string | null;
  warehouse_id: string | null;
  instruction_ids: string[];
  checklist_labels: string[];
  version: number;
  created_by: string;
  token_hash: string;
};
export function secureStationCookie(req: NextRequest) {
  return req.nextUrl.protocol === 'https:';
}
/** The random device secret exists only in a host-only HttpOnly cookie. It never grants a member session. */
export async function stationDevice(req: NextRequest): Promise<StationDevice> {
  const token = req.cookies.get(
    stationCookieName(secureStationCookie(req)),
  )?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token))
    throw new WorkOrderApiError(
      'Bu tablet henüz bir istasyona bağlanmadı.',
      401,
    );
  const [device] =
    await sql`SELECT d.* FROM station_devices d JOIN tenant_members m ON m.tenant_id=d.tenant_id AND m.user_id=d.created_by WHERE d.token_hash=${stationHash(token)} AND d.revoked_at IS NULL AND d.expires_at>now() AND m.role IN('owner','admin') AND (to_jsonb(m)->>'deactivated_at') IS NULL`;
  if (!device)
    throw new WorkOrderApiError(
      'Tablet bağlantısı iptal edildi veya süresi doldu. Yöneticiyle yeniden eşleştirin.',
      401,
    );
  await assertCompanyHostTenant(
    device.tenant_id,
    req.headers.get('host') || req.nextUrl.host,
  );
  await sql`UPDATE station_devices SET last_seen_at=now() WHERE id=${device.id} AND tenant_id=${device.tenant_id} AND (last_seen_at IS NULL OR last_seen_at<now()-interval '1 minute')`;
  return device as StationDevice;
}
export function stationActor(device: StationDevice): WorkOrderActor {
  if (!device.work_center_code)
    throw new WorkOrderApiError('Bu tablet üretim işlemi yapamaz.', 403);
  return {
    userId: device.created_by,
    tenantId: device.tenant_id,
    role: 'worker',
    station: {
      deviceId: device.id,
      tokenHash: device.token_hash,
      version: device.version,
      workCenterCode: device.work_center_code,
    },
  };
}
/** Recheck inside the production transaction, BEFORE idempotent replay and operation mutation. */
export async function assertStationOperation(
  tx: any,
  a: WorkOrderActor,
  action: string,
  raw: unknown,
) {
  if (!a.station) return;
  if (action !== 'operation')
    throw new WorkOrderApiError(
      'Tablet yalnız kendi istasyon işlerini yapabilir.',
      403,
    );
  const d = OperationCommandSchema.parse(raw);
  if (
    !['start', 'pause', 'complete', 'note'].includes(d.action) ||
    d.additionalMaterials.length
  )
    throw new WorkOrderApiError(
      'Bu işlem için yetkili personel ekranını kullanın.',
      403,
    );
  const [device] =
    await tx`SELECT s.* FROM station_devices s JOIN tenant_members m ON m.tenant_id=s.tenant_id AND m.user_id=s.created_by WHERE s.id=${a.station.deviceId} AND s.tenant_id=${a.tenantId} AND s.created_by=${a.userId} AND s.token_hash=${a.station.tokenHash} AND s.version=${a.station.version} AND s.work_center_code=${a.station.workCenterCode} AND s.revoked_at IS NULL AND s.expires_at>now() AND s.kind<>'warehouse' AND m.role IN('owner','admin') AND (to_jsonb(m)->>'deactivated_at') IS NULL FOR SHARE OF s,m`;
  if (!device)
    throw new WorkOrderApiError(
      'Tablet yetkisi veya istasyon ataması değişti. Yenileyin.',
      403,
    );
  const [op] =
    await tx`SELECT * FROM production_operations WHERE tenant_id=${a.tenantId} AND id=${d.operationId} AND work_center_code=${device.work_center_code}`;
  if (!op) throw new WorkOrderApiError('İş bu istasyona ait değil.', 404);
}

export async function requireStationChecklist(
  tx: any,
  a: WorkOrderActor,
  op: any,
) {
  if (!a.station) return;
  const [device] =
    await tx`SELECT * FROM station_devices WHERE tenant_id=${a.tenantId} AND id=${a.station.deviceId}`;
  const checks = await stationChecks(tx, device, op);
  if (checks.some((c) => !c.checked))
    throw new WorkOrderApiError(
      'Tamamlamadan önce istasyon kontrol listesini doldurun.',
      409,
    );
}
