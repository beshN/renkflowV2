import { redactedJson } from '@/lib/security/field-access.server';
import { sql } from '@/lib/db';
import { requireWorkOrderActor,WorkOrderApiError } from '@/lib/features/work-orders/security';
import { requireProcurementRead } from '@/lib/features/manufacturing/purchasing.service';
export const dynamic='force-dynamic';
export async function GET() {
  try {
    const actor=await requireWorkOrderActor();requireProcurementRead(actor);const t=actor.tenantId;
    const [lots,losses,totals]=await Promise.all([
      sql`SELECT l.id,l.lot_number,l.status,l.remaining_qty,l.metadata,i.name,i.sku,i.weight_per_meter_kg,w.name AS warehouse_name FROM stock_lots l JOIN inventory_items i ON i.id=l.item_id AND i.tenant_id=l.tenant_id JOIN warehouses w ON w.id=l.warehouse_id AND w.tenant_id=l.tenant_id WHERE l.tenant_id=${t} AND w.warehouse_type='REUSABLE_REMNANTS' AND l.remaining_qty>0 ORDER BY l.created_at DESC LIMIT 500`,
      sql`SELECT c.*,l.lot_number,i.name,i.sku FROM cutting_losses c JOIN stock_lots l ON l.id=c.lot_id AND l.tenant_id=c.tenant_id JOIN inventory_items i ON i.id=l.item_id AND i.tenant_id=l.tenant_id WHERE c.tenant_id=${t} ORDER BY c.created_at DESC LIMIT 300`,
      sql`SELECT COALESCE(SUM(weight_kg),0)AS weight_kg,COALESCE(SUM(cost),0)AS cost,COUNT(*)AS loss_count FROM cutting_losses WHERE tenant_id=${t}`,
    ]);
    return redactedJson({data:{lots,losses,totals:totals[0]}},{headers:{'Cache-Control':'no-store'}});
  } catch(e) {return redactedJson({error:e instanceof WorkOrderApiError?e.message:'Hurda ve artık kayıtları alınamadı'},{status:e instanceof WorkOrderApiError?e.status:503});}
}
