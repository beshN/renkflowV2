import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireWorkOrderActor,WorkOrderApiError } from '@/lib/features/work-orders/security';
import { requireProcurementRead } from '@/lib/features/manufacturing/purchasing.service';
export const dynamic='force-dynamic';
export async function GET(){
 try{
  const a=await requireWorkOrderActor();requireProcurementRead(a);const t=a.tenantId;
  const [centers,losses,rework,jobs]=await Promise.all([
   sql`SELECT c.code,c.name,c.parallel_capacity,COUNT(p.id)FILTER(WHERE p.status='running')AS running,COUNT(p.id)FILTER(WHERE p.status IN('ready','paused','blocked'))AS queue,COUNT(p.id)FILTER(WHERE p.status='done')AS done,COALESCE(SUM(p.active_seconds+CASE WHEN p.active_since IS NOT NULL THEN GREATEST(0,EXTRACT(EPOCH FROM(now()-p.active_since))) ELSE 0 END),0)AS active_seconds FROM work_centers c LEFT JOIN production_operations p ON p.work_center_code=c.code AND p.tenant_id=c.tenant_id WHERE c.tenant_id=${t} AND c.active=true GROUP BY c.id ORDER BY queue DESC,c.code`,
   sql`SELECT COALESCE(SUM(weight_kg),0)AS weight_kg,COALESCE(SUM(cost),0)AS cost FROM cutting_losses WHERE tenant_id=${t}`,
   sql`SELECT COUNT(*)AS count,COALESCE(SUM(affected_qty),0)AS affected_qty,COALESCE(SUM(profile_scrap_kg),0)AS profile_scrap_kg FROM production_rework WHERE tenant_id=${t}`,
   sql`SELECT COUNT(*)FILTER(WHERE status NOT IN('done','cancelled'))AS wip,COUNT(*)FILTER(WHERE status='done')AS done,COALESCE(SUM(produced_qty),0)AS produced FROM work_orders WHERE tenant_id=${t} AND recipe_id IS NOT NULL`,
  ]);
  return NextResponse.json({data:{centers,losses:losses[0],rework:rework[0],jobs:jobs[0]}},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:e instanceof WorkOrderApiError?e.message:'Üretim raporu alınamadı'},{status:e instanceof WorkOrderApiError?e.status:503});}
}
