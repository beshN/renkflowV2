import "server-only";
import {buildSchedule,remainingOperationMinutes} from "./scheduler";
const num=(v:unknown)=>Number(v || 0);

export async function schedulingSnapshot(tx:any,tenantId:string){
  const operations=await tx`SELECT p.*,w.priority,w.due_at,w.reservation_status,w.material_ready_at,w.revision AS job_revision,w.order_id,o.delivery_date AS order_delivery_date FROM production_operations p JOIN work_orders w ON w.id=p.work_order_id AND w.tenant_id=p.tenant_id JOIN orders o ON o.id=w.order_id AND o.tenant_id=w.tenant_id WHERE p.tenant_id=${tenantId} AND w.recipe_id IS NOT NULL AND p.status NOT IN('done','cancelled') AND w.status NOT IN('done','cancelled') ORDER BY p.id`;
  const centers=await tx`SELECT * FROM work_centers WHERE tenant_id=${tenantId} AND active=true ORDER BY id`;
  const resources=await tx`SELECT * FROM production_resources WHERE tenant_id=${tenantId} AND active=true ORDER BY id`;
  return {operations,centers,resources};
}
export function scheduleSnapshot(inputs:{operations:any[];centers:any[];resources:any[]},startsAt:string,asOf=Date.now()){
  const calendar=(r:any)=>({code:r.code,parallelCapacity:r.parallel_capacity,shiftStart:r.shift_start,shiftEnd:r.shift_end,workDays:r.work_days,maintenance:r.maintenance,machineRequired:r.machine_required,teamRequired:r.team_required});
  return buildSchedule(inputs.operations.map(r=>({id:r.id,workOrderId:r.work_order_id,position:r.position,workCenterCode:r.work_center_code,minutes:remainingOperationMinutes({plannedMinutes:num(r.planned_minutes),setupMinutes:num(r.setup_minutes),plannedQty:num(r.planned_qty),completedQty:num(r.completed_qty),activeSeconds:num(r.active_seconds),baselineSeconds:num(r.planning_baseline_seconds),activeSince:r.active_since ? new Date(r.active_since).toISOString() : null},asOf),setupMinutes:num(r.setup_minutes),running:r.status==='running',priority:r.priority,dueAt:r.order_delivery_date ? new Date((r.order_delivery_date instanceof Date ? r.order_delivery_date.toISOString() : String(r.order_delivery_date)).slice(0,10)+"T23:59:59+03:00").toISOString() : r.due_at ? new Date(r.due_at).toISOString() : undefined,materialReady:r.reservation_status==='transferred',materialReadyAt:r.material_ready_at ? new Date(r.material_ready_at).toISOString() : undefined,assignedTo:r.assigned_to || undefined,machineId:r.machine_id || undefined,teamId:r.team_id || undefined,blockedReason:r.status==='blocked'?'Operasyon kalite / üretim engeli çözülmeli':undefined})),inputs.centers.map(calendar),startsAt,inputs.resources.map(r=>({...calendar(r),id:r.id,kind:r.kind,userId:r.user_id,memberIds:r.member_ids,workCenterCodes:r.work_center_codes})));
}
