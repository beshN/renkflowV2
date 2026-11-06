import 'server-only';
import {z} from 'zod';
import {sql} from '@/lib/db';
import {WorkOrderActor,WorkOrderApiError} from '../work-orders/security';
import {qualityCostByCurrency,reworkLaborSeconds} from './quality-intelligence';
const fail=(m:string,status=409):never=>{throw new WorkOrderApiError(m,status);};
const currency=z.enum(['TRY','EUR','USD','GBP']);
export async function executeQuality(tx:any,a:WorkOrderActor,action:string,data:Record<string,unknown>){
 if(action==='quality.cost-settings'){
  if(!['owner','admin'].includes(a.role))fail('Yönetici yetkisi gerekli',403);
  const d=z.object({revision:z.number().int().positive(),laborCostPerHour:z.number().nonnegative().finite().max(1000000).nullable(),laborCurrency:currency}).parse(data);
  const [existing]=await tx`SELECT quality_revision FROM manufacturing_preferences WHERE tenant_id=${a.tenantId}`;
  if(existing && existing.quality_revision!==d.revision)fail("Maliyet ayarı değişti; güncel kaydı açın");
  await tx`INSERT INTO manufacturing_preferences(tenant_id,labor_cost_per_hour,labor_currency)VALUES(${a.tenantId},${d.laborCostPerHour},${d.laborCurrency})ON CONFLICT(tenant_id)DO UPDATE SET labor_cost_per_hour=EXCLUDED.labor_cost_per_hour,labor_currency=EXCLUDED.labor_currency,quality_revision=manufacturing_preferences.quality_revision+1`;
  return {ok:true};
 }
 if(action!=='rework.resolve')fail('Kalite işlemi tanınmıyor',400);
 const d=z.object({id:z.string().uuid(),version:z.number().int().positive(),rootCause:z.string().trim().min(3).max(2000).nullable(),rootCauseStatus:z.enum(['confirmed','unconfirmed','unknown']),resolution:z.string().trim().min(5).max(2000),extraLaborMinutes:z.number().finite().nonnegative().max(100000).optional()}).parse(data);
 if(d.rootCauseStatus!=='unknown' && !d.rootCause)fail('Kök neden açıklaması gerekli',400);
 if(!['owner','admin','office','worker'].includes(a.role))fail('Rework yetkisi gerekli',403);
 const [row]=await tx`SELECT * FROM production_rework WHERE tenant_id=${a.tenantId} AND id=${d.id} FOR UPDATE`;
 if(!row)fail('Rework bulunamadı',404);
 if(row.version!==d.version || row.status!=='open')fail('Rework değişti veya zaten kapatıldı');
 if(a.role==='worker' && !(await tx`SELECT 1 FROM production_operations WHERE tenant_id=${a.tenantId} AND work_order_id=${row.work_order_id} AND assigned_to=${a.userId}`).length)fail('Bu üretim işi size atanmadı',403);
 const affectedIds=row.snapshot.map((o:any)=>o.id);
 const operations=await tx`SELECT * FROM production_operations WHERE tenant_id=${a.tenantId} AND id=ANY(${affectedIds}::uuid[])`;
 if(operations.length!==affectedIds.length || operations.some((o:any)=>o.status!=='done') || ['pending','approved'].includes(row.profile_status))fail('Yeniden işlem rotası ve kalite kapıları tamamlanmadan kapatılamaz');
 // Attribute labor to each incident's operation attempt, never to every later attempt on the job.
 const events=await tx`SELECT * FROM production_events WHERE tenant_id=${a.tenantId} AND work_order_id=${row.work_order_id} AND created_at>=${row.created_at} AND event_type IN('operation.complete','operation.rework') ORDER BY id`;
 let seconds=reworkLaborSeconds(row.snapshot,events);
 if(d.extraLaborMinutes!==undefined)seconds=d.extraLaborMinutes*60;
 const allocations=await tx`SELECT * FROM work_order_material_lots WHERE tenant_id=${a.tenantId} AND rework_id=${row.id}`;
 const components:Array<{label:string;amount:number|null;currency:string|null}>=allocations.map((m:any)=>({label:'Ek malzeme '+m.item_id,amount:m.unit_cost===null?null:Number(m.quantity)*Number(m.unit_cost),currency:m.currency}));
 const [plan]=row.cut_plan_id?await tx`SELECT * FROM cutting_plans WHERE tenant_id=${a.tenantId} AND id=${row.cut_plan_id} AND status='completed'`:[];
 if(row.profile_cuts?.length){
  for(const cut of row.profile_cuts){
   const bars=plan?.result.bars.filter((b:any)=>b.source.itemId===cut.itemId && b.pieces.some((p:any)=>p.workOrderId===row.work_order_id)) || [];
   const lengths=bars.flatMap((b:any)=>b.pieces.filter((p:any)=>p.workOrderId===row.work_order_id).map((p:any)=>({length:p.lengthMm,currency:b.source.currency || null,cost:b.source.unitCost})));
   const total=lengths.reduce((s:number,p:any)=>s+p.length,0);
   if(!total)components.push({label:'Ek profil '+cut.itemId,amount:null,currency:null});
   else for(const part of lengths)components.push({label:'Ek profil '+cut.itemId,amount:(part.length/total)*cut.lengthMm*cut.quantity/1000*part.cost,currency:part.currency});
  }
 }
 const rate=row.cost_snapshot.laborRate,rateCurrency=row.cost_snapshot.laborCurrency;
 if(seconds>0)components.push({label:'Ek işçilik',amount:rate===null || rate===undefined?null:seconds/3600*Number(rate),currency:rateCurrency || null});
 const cost=qualityCostByCurrency(components);
 const [closed]=await tx`UPDATE production_rework SET root_cause=${d.rootCause},root_cause_status=${d.rootCauseStatus},resolution=${d.resolution},status='resolved',version=version+1,extra_labor_seconds=${seconds},labor_method=${d.extraLaborMinutes===undefined?'operation_attempt_events':'operator_recorded'},cost_snapshot=${JSON.stringify({...row.cost_snapshot,...cost})}::text::jsonb,resolved_by=${a.userId},resolved_at=now()WHERE tenant_id=${a.tenantId} AND id=${row.id} RETURNING *`;
 return a.role==='worker'?{id:closed.id,status:closed.status,version:closed.version}:closed;
}
export async function qualityAnalytics(a:WorkOrderActor){
 if(!['owner','admin','office'].includes(a.role))fail('Kalite analitiği yönetim kapsamındadır',403);
 const t=a.tenantId;
 const [failures,operations,products,recipes,lots,coverage,costs,categories,scrap]=await Promise.all([
 sql`SELECT r->>'id'AS code,r->>'name'AS name,COUNT(*)::integer AS count FROM quality_inspections q CROSS JOIN LATERAL jsonb_array_elements(q.results)r WHERE q.tenant_id=${t} AND q.created_at>=now()-interval '90 days' AND r->>'passed'='false' GROUP BY r->>'id',r->>'name' ORDER BY count DESC`,
 sql`SELECT p.work_center_code,p.name,COUNT(*)::integer AS inspections,COUNT(*)FILTER(WHERE NOT q.passed)::integer AS failures FROM quality_inspections q JOIN production_operations p ON p.id=q.operation_id AND p.tenant_id=q.tenant_id WHERE q.tenant_id=${t} AND q.created_at>=now()-interval '90 days' GROUP BY p.work_center_code,p.name ORDER BY failures DESC`,
 sql`SELECT i.id,i.name,COUNT(*)::integer AS jobs,COUNT(*)FILTER(WHERE EXISTS(SELECT 1 FROM production_rework r WHERE r.tenant_id=w.tenant_id AND r.work_order_id=w.id))::integer AS reworked FROM work_orders w JOIN inventory_items i ON i.id=w.production_item_id AND i.tenant_id=w.tenant_id WHERE w.tenant_id=${t} AND w.recipe_id IS NOT NULL AND w.created_at>=now()-interval '90 days' GROUP BY i.id,i.name ORDER BY reworked DESC`,
 sql`SELECT w.recipe_id,w.bom_snapshot->>'recipeCode'AS code,w.bom_snapshot->>'recipeVersion'AS version,COUNT(*)::integer AS jobs,COUNT(*)FILTER(WHERE EXISTS(SELECT 1 FROM production_rework r WHERE r.tenant_id=w.tenant_id AND r.work_order_id=w.id))::integer AS reworked FROM work_orders w WHERE w.tenant_id=${t} AND w.recipe_id IS NOT NULL AND w.created_at>=now()-interval '90 days' GROUP BY w.recipe_id,w.bom_snapshot->>'recipeCode',w.bom_snapshot->>'recipeVersion' ORDER BY reworked DESC`,
 sql`SELECT l.id,l.lot_number,i.name AS material,COUNT(DISTINCT q.id)::integer AS inspections,COUNT(DISTINCT q.id)FILTER(WHERE NOT q.passed)::integer AS failures,COUNT(DISTINCT q.work_order_id)::integer AS jobs FROM quality_inspections q CROSS JOIN LATERAL jsonb_array_elements(COALESCE(q.context->'materialLots','[]'::jsonb))m JOIN stock_lots l ON l.id=(m->>'lotId')::uuid AND l.tenant_id=q.tenant_id JOIN inventory_items i ON i.id=l.item_id AND i.tenant_id=l.tenant_id WHERE q.tenant_id=${t} AND q.created_at>=now()-interval '90 days' GROUP BY l.id,l.lot_number,i.name ORDER BY failures DESC LIMIT 100`,
 sql`SELECT COUNT(*)::integer AS inspections,COUNT(*)FILTER(WHERE q.context->>'traceability'='linked')::integer AS linked,COUNT(*)FILTER(WHERE q.context->>'traceability' IS DISTINCT FROM 'linked')::integer AS incomplete FROM quality_inspections q WHERE q.tenant_id=${t} AND q.created_at>=now()-interval '90 days'`,
 sql`SELECT cost_snapshot,status FROM production_rework WHERE tenant_id=${t} AND created_at>=now()-interval '90 days'`,
 sql`SELECT reason_code,COUNT(*)::integer AS cases,COUNT(*)FILTER(WHERE status='resolved')::integer AS resolved,COUNT(*)FILTER(WHERE root_cause_status='confirmed')::integer AS confirmed,SUM(affected_qty)AS affected_quantity FROM production_rework WHERE tenant_id=${t} AND created_at>=now()-interval '90 days' GROUP BY reason_code ORDER BY cases DESC`,
 sql`SELECT i.id,i.name,i.stock_uom,SUM((m->>'scrapQty')::numeric)AS quantity FROM production_rework r CROSS JOIN LATERAL jsonb_array_elements(r.additional_materials)m JOIN inventory_items i ON i.id=(m->>'itemId')::uuid AND i.tenant_id=r.tenant_id WHERE r.tenant_id=${t} AND r.created_at>=now()-interval '90 days' AND (m->>'scrapQty')::numeric>0 GROUP BY i.id,i.name,i.stock_uom ORDER BY i.name`,
 ]);
 const totals:Record<string,number>={};let unknown=0;
 for(const row of costs){if(row.status!=='resolved'){unknown++;continue;}unknown+=Number(row.cost_snapshot.unknownComponents || 0);for(const [c,v]of Object.entries(row.cost_snapshot.totals || {}))totals[c]=Math.round(((totals[c] || 0)+Number(v))*100)/100;}
 return {windowDays:90,failures,operations,products,recipes,lots,categories,scrap,coverage:coverage[0],estimatedCost:a.role==='office'?null:{totals,unknownComponents:unknown,openCases:costs.filter((r:any)=>r.status==='open').length},causality:'Lot ve reçete karşılaştırmaları ilişki sinyalidir; doğrulanmış kök neden değildir.'};
}
