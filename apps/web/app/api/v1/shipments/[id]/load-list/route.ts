import { sql } from '@/lib/db';
import { redactedJson } from '@/lib/security/field-access.server';
import { requireWorkOrderActor, WorkOrderApiError } from '@/lib/features/work-orders/security';
import { readShipmentLoadList } from '@/lib/features/shipments/load-list';
import { z } from 'zod';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireWorkOrderActor();
    const { id } = await context.params;
    if (!z.uuid().safeParse(id).success) throw new WorkOrderApiError('Geçersiz sevkiyat', 400);
    const data = await readShipmentLoadList(sql, actor, id);
    return redactedJson({ success: true, data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return redactedJson({ error: error instanceof WorkOrderApiError ? error.message : 'Yükleme listesi alınamadı' },
      { status: error instanceof WorkOrderApiError ? error.status : 500 });
  }
}
