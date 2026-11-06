import { reportServerError } from '@/lib/observability/report-server-error';
import { redactedJson } from '@/lib/security/field-access.server';
import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { readShipmentList } from '@/lib/features/shipments/list';
import { ROUTE_ROLES } from '@/lib/auth/permissions';
import { requireWorkOrderActor, WorkOrderApiError } from '@/lib/features/work-orders/security';

export async function GET(req: NextRequest) {
  try {
    const actor = await requireWorkOrderActor();
    // Shipments carry customer names; same roles as the /shipments screen.
    if (!(ROUTE_ROLES['/shipments'] ?? []).includes(actor.role)) throw new WorkOrderApiError('Sevkiyat kayıtlarına erişim yetkiniz yok', 403);
    
    const rows = await readShipmentList(sql, actor);

    return redactedJson({
      success: true,
      data: rows
    });
  } catch (error) {
    if (error instanceof WorkOrderApiError) {
      return redactedJson({ error: error.message }, { status: error.status });
    }
    await reportServerError("app/api/v1/shipments/route:GET", error);
    return redactedJson({ error: 'Internal Server Error' }, { status: 500 });
  }
}
