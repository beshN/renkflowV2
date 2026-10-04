import 'server-only';
import {sql} from '@/lib/db';
import {WorkOrderActor,WorkOrderApiError} from '../work-orders/security';
import {schedulingSnapshot,scheduleSnapshot} from './planning.service';
import {calculateProductionMetrics} from './analytics';
export async function productionAnalytics(actor:WorkOrderActor){
 if(!['owner','admin','office'].includes(actor.role))throw new WorkOrderApiError('Üretim analitiği yönetim kapsamındadır',403);
 return sql.begin(async(tx:any)=>{
  await tx`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`;
  const t=actor.tenantId,now=Date.now(),snapshot=await schedulingSnapshot(tx,t);
  const history=await tx`WITH completions AS (
   SELECT p.work_center_code AS code,e.work_order_id,e.operation_id,(e.payload->'before'->>'attempt')::integer AS attempt,
    SUM((e.payload->>'quantity')::numeric)AS units,
    SUM(GREATEST(0,(e.payload->'after'->>'active_seconds')::numeric-COALESCE((e.payload->'before'->>'planning_baseline_seconds')::numeric,0)))AS active_seconds,
    MIN(COALESCE((e.payload->'before'->>'ready_at')::timestamptz,e.created_at))AS ready_at,MAX(e.created_at)AS last_at,
    bool_or(e.payload->'after'->>'status'='done')AS finished,
    SUM(CASE WHEN e.created_at>=now()-interval '24 hours' THEN (e.payload->>'quantity')::numeric ELSE 0 END)AS throughput
   FROM production_events e JOIN production_operations p ON p.id=e.operation_id AND p.tenant_id=e.tenant_id
   WHERE e.tenant_id=${t} AND e.event_type='operation.complete' AND e.created_at>=now()-interval '30 days'
   GROUP BY p.work_center_code,e.work_order_id,e.operation_id,e.payload->'before'->>'attempt'
  ) SELECT code,COUNT(*)FILTER(WHERE finished)::integer AS samples,COALESCE(SUM(units),0)AS units,COALESCE(SUM(active_seconds),0)AS active_seconds,
   COALESCE(percentile_cont(0.5)WITHIN GROUP(ORDER BY GREATEST(0,extract(epoch FROM last_at-ready_at)))FILTER(WHERE finished),0)AS cycle_seconds,
   COALESCE(percentile_cont(0.5)WITHIN GROUP(ORDER BY GREATEST(0,extract(epoch FROM last_at-ready_at)-active_seconds))FILTER(WHERE finished),0)AS waiting_seconds,
   COUNT(*)FILTER(WHERE finished AND attempt>1)::integer AS rework_attempts,COALESCE(SUM(throughput),0)AS throughput FROM completions GROUP BY code`;
  const orders=await tx`SELECT o.id,o.order_number,o.delivery_date,
   (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id=o.id AND NOT EXISTS(SELECT 1 FROM work_orders w WHERE w.tenant_id=${t} AND w.order_item_id=oi.id AND w.status<>'cancelled'))AS unplanned_lines
   FROM orders o WHERE o.tenant_id=${t} AND o.status NOT IN('cancelled','delivered','completed','shipped') AND EXISTS(SELECT 1 FROM work_orders w WHERE w.tenant_id=${t} AND w.order_id=o.id AND w.recipe_id IS NOT NULL AND w.status<>'cancelled') ORDER BY o.delivery_date NULLS LAST,o.id`;
  const schedule=scheduleSnapshot(snapshot,new Date(now).toISOString(),now);
  return calculateProductionMetrics(snapshot.operations,snapshot.centers,history.map((h:any)=>({code:h.code,samples:Number(h.samples),units:Number(h.units),activeSeconds:Number(h.active_seconds),cycleSeconds:Number(h.cycle_seconds),waitingSeconds:Number(h.waiting_seconds),reworkAttempts:Number(h.rework_attempts),throughput24h:Number(h.throughput)})),schedule,orders,now);
 });
}
