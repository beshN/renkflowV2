import 'server-only';
import {WorkOrderApiError,type WorkOrderActor} from '../work-orders/security';
/** Allocate only existing, available lots; remaining legacy stock is explicitly untracked. Caller posts the lines in the same transaction. */
export async function allocateMaterialLots(tx:any,a:WorkOrderActor,job:any,item:any,quantity:number,reworkId?:string){
 const lots=await tx`SELECT * FROM stock_lots WHERE tenant_id=${a.tenantId} AND item_id=${item.id} AND warehouse_id=${job.source_warehouse_id} AND status='available' AND remaining_qty>0 ORDER BY created_at,id FOR UPDATE`;
 const legacy=await tx`SELECT b.location_id,GREATEST(0,b.quantity-COALESCE((SELECT SUM(l.remaining_qty)FROM stock_lots l WHERE l.tenant_id=b.tenant_id AND l.item_id=b.item_id AND l.warehouse_id=${job.source_warehouse_id} AND COALESCE(l.location_id,u.id)=b.location_id),0))AS untracked_qty FROM warehouse_location_balances b JOIN warehouse_locations u ON u.tenant_id=b.tenant_id AND u.warehouse_id=${job.source_warehouse_id} AND u.location_type='unassigned' JOIN warehouse_locations loc ON loc.id=b.location_id AND loc.tenant_id=b.tenant_id WHERE b.tenant_id=${a.tenantId} AND b.item_id=${item.id} AND loc.warehouse_id=${job.source_warehouse_id} AND b.quantity>0 ORDER BY loc.code,b.location_id FOR UPDATE OF b`;
 const lines:any[]=[];let remaining=quantity;
 for(const lot of lots){
  if(remaining<=0.000001)break;const qty=Math.min(remaining,Number(lot.remaining_qty));remaining=Number((remaining-qty).toFixed(6));
  await tx`UPDATE stock_lots SET remaining_qty=remaining_qty-${qty},status=CASE WHEN remaining_qty-${qty}<=0.000001 THEN 'consumed' ELSE 'available' END,updated_at=now()WHERE tenant_id=${a.tenantId} AND id=${lot.id}`;
  const cost=lot.metadata.unitCost ?? null,currency=lot.metadata.currency || null;
  await tx`INSERT INTO work_order_material_lots(tenant_id,work_order_id,rework_id,item_id,lot_id,quantity,uom,unit_cost,currency,method)VALUES(${a.tenantId},${job.id},${reworkId || null},${item.id},${lot.id},${qty},${item.stock_uom},${cost},${currency},'physical_lot')`;
  lines.push({itemId:item.id,warehouseId:job.source_warehouse_id,lotId:lot.id,quantityDelta:-qty,uom:item.stock_uom,unitCost:cost===null?undefined:Number(cost),metadata:{workOrderId:job.id,reworkId:reworkId || null,currency,materialLotId:lot.id}});
 }
 for(const shelf of legacy){
  if(remaining<=0.000001)break;
  const qty=Math.min(remaining,Number(shelf.untracked_qty));if(qty<=0)continue;remaining=Number((remaining-qty).toFixed(6));
  await tx`INSERT INTO work_order_material_lots(tenant_id,work_order_id,rework_id,item_id,quantity,uom,method)VALUES(${a.tenantId},${job.id},${reworkId || null},${item.id},${qty},${item.stock_uom},'legacy_untracked')`;
  lines.push({itemId:item.id,warehouseId:job.source_warehouse_id,quantityDelta:-qty,uom:item.stock_uom,metadata:{locationId:shelf.location_id,workOrderId:job.id,reworkId:reworkId || null,traceability:'legacy_untracked'}});
 }
 if(remaining>0.000001)throw new WorkOrderApiError('İzlenebilir kullanılabilir malzeme stoğu yetersiz; rezerve lotlar tüketilmez',409);
 return lines;
}
export async function qualityContext(tx:any,a:WorkOrderActor,job:any,op:any){
 const allocations=await tx`SELECT l.item_id,l.lot_id,l.quantity,l.uom,l.method,l.rework_id,s.lot_number FROM work_order_material_lots l LEFT JOIN stock_lots s ON s.id=l.lot_id AND s.tenant_id=l.tenant_id WHERE l.tenant_id=${a.tenantId} AND l.work_order_id=${job.id} ORDER BY l.created_at,l.id`;
 const plans=await tx`SELECT id,result FROM cutting_plans WHERE tenant_id=${a.tenantId} AND status='completed' AND ${job.id}=ANY(work_order_ids)`;
 const profiles=plans.flatMap((p:any)=>p.result.bars.filter((b:any)=>b.pieces.some((piece:any)=>piece.workOrderId===job.id)).map((b:any)=>({itemId:b.source.itemId,lotId:b.source.id,cutBatchId:p.id,quantity:b.pieces.filter((piece:any)=>piece.workOrderId===job.id).reduce((s:number,piece:any)=>s+piece.lengthMm/1000,0),uom:'m',method:'physical_lot'})));
 const materialLots=[...profiles,...allocations.map((l:any)=>({itemId:l.item_id,lotId:l.lot_id,lotNumber:l.lot_number,quantity:Number(l.quantity),uom:l.uom,method:l.method,reworkId:l.rework_id}))];
 const tracked=new Set(materialLots.map(l=>l.itemId));
 const untrackedItems=(job.bom_snapshot?.materials || []).filter((m:any)=>!tracked.has(m.itemId)).map((m:any)=>m.itemId);
 return {orderId:job.order_id,workOrderId:job.id,operationId:op.id,attempt:op.attempt,recipeId:job.recipe_id,recipeCode:job.bom_snapshot?.recipeCode,recipeVersion:job.bom_snapshot?.recipeVersion,productId:job.production_item_id,employeeId:a.userId,assignedEmployeeId:op.assigned_to,machineId:op.machine_id,teamId:op.team_id,workCenterCode:op.work_center_code,materialLots,untrackedItems,traceability:untrackedItems.length || allocations.some((l:any)=>!l.lot_id)?'partial':'linked',recordedAt:new Date().toISOString()};
}
