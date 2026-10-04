import {remainingOperationMinutes} from './scheduler';
export type HistoricalCenter = {code:string;samples:number;units:number;activeSeconds:number;cycleSeconds:number;waitingSeconds:number;reworkAttempts:number;throughput24h:number};
const n=(v:unknown)=>Number(v || 0);
/** Frontiers count physical WIP once per job, not once for every future operation. */
export function calculateProductionMetrics(operations:any[],centers:any[],history:HistoricalCenter[],schedule:{tasks:any[];blocked:any[]},orders:any[],now:number){
 const frontier=new Map<string,any>();
 for(const op of operations){const old=frontier.get(op.work_order_id);if(!old || old.position>op.position)frontier.set(op.work_order_id,op);}
 const current=[...frontier.values()];
 const metrics=centers.map(center=>{
  const pending=operations.filter(o=>o.work_center_code===center.code),wip=current.filter(o=>o.work_center_code===center.code),running=wip.filter(o=>o.status==='running'),queue=wip.filter(o=>o.status!=='running');
  const baseline=history.find(h=>h.code===center.code);
  const remaining=(op:any)=>remainingOperationMinutes({plannedMinutes:n(op.planned_minutes),setupMinutes:n(op.setup_minutes),plannedQty:n(op.planned_qty),completedQty:n(op.completed_qty),activeSeconds:n(op.active_seconds),baselineSeconds:n(op.planning_baseline_seconds),activeSince:op.active_since ? new Date(op.active_since).toISOString():null},now);
  const workloadMinutes=wip.reduce((s,o)=>s+remaining(o),0);
  const minutes=(v:string)=>{const [h,m]=v.split(':').map(Number);return h*60+m;};
  const shiftCapacityMinutes=(minutes(center.shift_end)-minutes(center.shift_start))*center.parallel_capacity;
  const queueWaitSeconds=queue.reduce((max,o)=>Math.max(max,o.ready_at?Math.max(0,(now-Date.parse(o.ready_at))/1000):0),0);
  const taskIds=new Set(wip.map(o=>o.id));
  const waitingStarts=schedule.tasks.filter(t=>taskIds.has(t.id));
  const estimatedQueueMinutes=waitingStarts.length ? Math.max(0,...waitingStarts.map(t=>(Date.parse(t.start)-now)/60000)) : null;
  const enoughHistory=!!baseline && baseline.samples>=5;
  const highLoad=shiftCapacityMinutes>0 && workloadMinutes/shiftCapacityMinutes>=1;
  const abnormalWait=enoughHistory && queueWaitSeconds>Math.max(1800,baseline.waitingSeconds*2);
  const excessiveQueue=queue.length>=Math.max(3,center.parallel_capacity*3);
  const bottleneck=queue.length>0 && (highLoad || (abnormalWait && excessiveQueue));
  const blockers=schedule.blocked.filter(o=>pending.some(p=>p.id===o.id));
  return {code:center.code,name:center.name,capacity:center.parallel_capacity,queueLength:queue.length,pendingOperations:pending.length,wipJobs:wip.length,wipQuantity:wip.reduce((s,o)=>s+Math.max(0,n(o.planned_qty)-n(o.completed_qty)),0),running:running.length,blocked:queue.filter(o=>o.status==='blocked').length,materialWaiting:queue.filter(o=>o.reservation_status!=='transferred').length,activeSeconds:wip.reduce((s,o)=>s+n(o.active_seconds)+(o.active_since?Math.max(0,(now-Date.parse(o.active_since))/1000):0),0),maxWaitingSeconds:queueWaitSeconds,workloadMinutes,shiftCapacityMinutes,loadRatio:shiftCapacityMinutes>0?workloadMinutes/shiftCapacityMinutes:0,estimatedQueueMinutes,baseline:baseline || null,baselineReliable:enoughHistory,throughput24h:baseline?.throughput24h || 0,reworkRate:baseline?.samples ? baseline.reworkAttempts/baseline.samples : null,bottleneck,reason:bottleneck?(highLoad?'Mevcut WIP bir vardiyalık kapasiteyi aşıyor':'Bekleme geçmiş normalin en az iki katında ve kuyruk kapasiteye göre yüksek'):blockers.length?'Malzeme, kaynak veya kalite engeli var':'Kapasite içinde',recommendedAction:bottleneck?(queue.some(o=>o.status==='blocked')?'Önce kalite/üretim engellerini çözün; sonra kapasiteyi yeniden planlayın':'Uygun makine/ekip atamasını ve vardiya kapasitesini kontrol ederek çizelgeyi yeniden önerin'):blockers.length?'Engel gerekçelerini çözerek çizelgeyi yeniden hesaplayın':'Mevcut çizelgeyi izleyin',affectedOrderIds:[...new Set(wip.map(o=>o.order_id))]};
 });
 const predictions=orders.map(order=>{
  const ops=operations.filter(o=>o.order_id===order.id),ids=new Set(ops.map(o=>o.id)),planned=schedule.tasks.filter(t=>ids.has(t.id));
  const reasons=[...new Set(schedule.blocked.filter(t=>ids.has(t.id)).map(t=>t.blockedReason))];
  if(n(order.unplanned_lines)>0)reasons.push('Siparişin bazı kalemleri üretim emri bekliyor');
  const complete=n(order.unplanned_lines)===0 && !ops.length;
  const estimatedCompletion=reasons.length || planned.length!==ops.length ? null : complete ? null : new Date(Math.max(...planned.map(t=>Date.parse(t.end)))).toISOString();
  const due=order.delivery_date?Date.parse((order.delivery_date instanceof Date ? order.delivery_date.toISOString() : String(order.delivery_date)).slice(0,10)+'T23:59:59+03:00'):null;
  return {orderId:order.id,orderNumber:order.order_number,estimatedCompletion,delayMinutes:estimatedCompletion && due ? Math.max(0,(Date.parse(estimatedCompletion)-due)/60000):null,overdue:!!due && due<now && !complete,blockedReasons:reasons,status:complete?'production_complete':estimatedCompletion?'estimated':'blocked',bottlenecks:metrics.filter(c=>c.bottleneck && c.affectedOrderIds.includes(order.id)).map(c=>c.code)};
 });
 return {generatedAt:new Date(now).toISOString(),baselineWindowDays:30,centers:metrics.sort((a,b)=>Number(b.bottleneck)-Number(a.bottleneck)||b.loadRatio-a.loadRatio),predictions,overdueCount:predictions.filter(p=>p.overdue).length,wipJobs:current.length,algorithm:schedule};
}
