import { redactedJson } from '@/lib/security/field-access.server';
import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { ROUTE_ROLES } from '@/lib/auth/permissions';
import { requireWorkOrderActor, WorkOrderApiError } from '@/lib/features/work-orders/security';

export async function GET(req: NextRequest) {
  try {
    const actor = await requireWorkOrderActor();
    // Shipments carry customer names; same roles as the /shipments screen.
    if (!(ROUTE_ROLES['/shipments'] ?? []).includes(actor.role)) throw new WorkOrderApiError('Sevkiyat kayıtlarına erişim yetkiniz yok', 403);
    
    const rows = await sql`
      SELECT 
        s.id,
        s.shipment_number,
        s.customer_name,
        s.status,
        s.carrier,
        s.tracking_number,
        s.scheduled_date,
        s.created_at,
        (
          SELECT json_agg(json_build_object(
            'product_name', si.product_name,
            'quantity', si.quantity
          ))
          FROM shipment_items si
          WHERE si.shipment_id = s.id
        ) as items
      FROM shipments s
      WHERE s.tenant_id = ${actor.tenantId}
      ORDER BY s.created_at DESC
      LIMIT 100
    `;

    return redactedJson({
      success: true,
      data: rows
    });
  } catch (error) {
    if (error instanceof WorkOrderApiError) {
      return redactedJson({ error: error.message }, { status: error.status });
    }
    return redactedJson({ error: 'Internal Server Error' }, { status: 500 });
  }
}
