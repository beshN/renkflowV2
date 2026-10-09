import 'server-only';
import { createHash } from 'node:crypto';
import { sql } from '@/lib/db';
import { type FieldActor } from '@/lib/features/field/service';
import { WorkOrderApiError, requireWorkOrderPermission } from '@/lib/features/work-orders/security';
import { canTransitionWorkOrderStatus, type WorkOrderStatus } from '@/lib/features/work-orders/status';
import { normalizeBlockedReasonCategory, normalizeBlockedReasonDetail, validateBlockedReasonForStatus } from '@/lib/features/work-orders/blocked-reason';
import { productionCommand } from '@/lib/features/manufacturing/platform.service';
import { OperationCommandSchema } from '@/lib/features/manufacturing/platform-contract';
import { validateMobileDTO } from './contract';

export type SyncInput = { idempotencyKey: string; kind: 'operation'|'checklist'|'comment'|'transition'|'scrap'|'delay'|'installation'; installationId?:string; workOrderId?: string; data: Record<string,unknown> };
export class MobileConflict extends WorkOrderApiError {
  constructor(message: string, public canRetry: boolean) { super(message,409); }
}
export function requestHash(value: unknown): string {
  const canonical = (v: unknown): unknown => Array.isArray(v) ? v.map(canonical) : v && typeof v==='object' ? Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,canonical(x)])) : v;
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
async function receiptLock(tx: any,a: FieldActor,key: string,hash: string) {
  await tx`SELECT pg_advisory_xact_lock(hashtextextended(${a.tenantId+':'+a.userId+':'+key},0))`;
  const [old] = await tx`SELECT request_hash,response FROM mobile_receipts WHERE tenant_id=${a.tenantId} AND user_id=${a.userId} AND command_id=${key}`;
  if (old && old.request_hash!==hash) throw new MobileConflict('Bu işlem kimliği başka bir kayıtta kullanılmış.',false);
  return old;
}
async function requireSchema() {
  const [row] = await sql`SELECT to_regclass('public.mobile_receipts') IS NOT NULL AS present`;
  if (!row?.present) throw new WorkOrderApiError('Çevrimdışı eşitleme sunucuda henüz etkin değil.',503);
}
export async function syncCommand(a: FieldActor,raw: unknown) {
  const input = validateMobileDTO('SyncInput',raw) as SyncInput;
  if (!(input.kind==='installation' ? a.mobileAccess?.installations.edit : a.mobileAccess?.production.edit)) throw new WorkOrderApiError('Üretim düzenleme yetkiniz yok.',403);
  await requireSchema();
  const hash = requestHash(input),key=input.idempotencyKey;
  if(input.kind==='installation') return sql.begin(async(tx:any)=> {
    const old=await receiptLock(tx,a,key,hash);if(old?.response) return old.response;
    const [available]=await tx`SELECT to_regclass('public.installations') IS NOT NULL AS present`;
    if(!available?.present) throw new WorkOrderApiError('Montaj modülü sunucuda henüz etkin değil.',503);
    const [row]=await tx`SELECT id,status,version,issues FROM installations WHERE tenant_id=${a.tenantId} AND id=${input.installationId!} AND (${a.role!=='worker'} OR ${a.userId}::uuid=ANY(crew)) FOR UPDATE`;
    if(!row) throw new WorkOrderApiError('Montaj bulunamadı veya ekibinize atanmamış.',404);
    if(['done','cancelled'].includes(row.status)) throw new MobileConflict('Montaj kapatılmış. İşlem uygulanamaz.',false);
    const d=input.data;
    if(Number(row.version)!==d.expectedVersion) throw new MobileConflict('Montaj sunucuda değişmiş. Yenileyip kaydı inceleyin.',false);
    if(d.action==='checklist') {
      if(typeof d.completed!=='boolean' || typeof d.itemId!=='string') throw new WorkOrderApiError('Kontrol öğesi ve durumu gerekli.',400);
      const found=await tx`UPDATE record_checklist_items SET done_at=${d.completed?new Date():null},done_by=${d.completed?a.userId:null} WHERE tenant_id=${a.tenantId} AND entity_type='installation' AND entity_id=${row.id} AND id=${d.itemId} RETURNING id`;
      if(!found.length) throw new WorkOrderApiError('Montaj kontrolü bulunamadı.',404);
    } else if(d.action==='issue') {
      if(!['missing','damage'].includes(String(d.kind)) || typeof d.text!=='string' || d.text.trim().length<3) throw new WorkOrderApiError('Eksik/hasar türü ve açıklaması gerekli.',400);
      const issues=[...(row.issues||[]),{kind:d.kind,text:d.text.trim(),at:new Date().toISOString(),by:a.userId}];
      await tx`UPDATE installations SET issues=${JSON.stringify(issues)}::text::jsonb WHERE tenant_id=${a.tenantId} AND id=${row.id}`;
    } else {
      const next=d.action==='start' ? 'in_progress' : 'done';
      if(d.action==='start' && row.status!=='planned' || d.action==='complete' && row.status!=='in_progress') throw new MobileConflict('Bu montaj durumu artık uygulanamaz.',false);
      await tx`UPDATE installations SET status=${next},started_at=CASE WHEN ${next==='in_progress'} THEN coalesce(started_at,now()) ELSE started_at END,completed_at=${next==='done'?new Date():null} WHERE tenant_id=${a.tenantId} AND id=${row.id}`;
    }
    await tx`UPDATE installations SET version=version+1,updated_at=now() WHERE tenant_id=${a.tenantId} AND id=${row.id}`;
    const accepted={accepted:true};
    await tx`INSERT INTO mobile_receipts(tenant_id,user_id,command_id,request_hash,response) VALUES(${a.tenantId},${a.userId},${key},${hash},${JSON.stringify(accepted)}::text::jsonb)`;
    return accepted;
  });
  if (input.kind==='operation') {
    // Bind the key in a short transaction, then release its connection. The production service
    // owns its own atomic ledger; nesting transactions here would exhaust the Vercel pool.
    const cached = await sql.begin(async (tx:any)=> {
      const old=await receiptLock(tx,a,key,hash);
      if (old?.response) return old.response;
      if (!old) await tx`INSERT INTO mobile_receipts(tenant_id,user_id,command_id,request_hash) VALUES(${a.tenantId},${a.userId},${key},${hash})`;
      return null;
    });
    if (cached) return cached;
    let result;
    try { result=await productionCommand(a,{commandId:key,action:'operation',data:OperationCommandSchema.parse(input.data)}); }
    catch(e) {
      if(e instanceof WorkOrderApiError && e.status===409) {
        const [op] = await sql`SELECT p.status,p.assigned_to,w.status AS job_status FROM production_operations p JOIN work_orders w ON w.id=p.work_order_id AND w.tenant_id=p.tenant_id WHERE p.tenant_id=${a.tenantId} AND p.id=${String(input.data.operationId)}`;
        const retry=Boolean(op && !['done','cancelled'].includes(op.job_status) && op.status!=='done' && (a.role!=='worker'||op.assigned_to===a.userId));
        throw new MobileConflict(e.message,retry);
      }
      throw e;
    }
    const accepted={accepted:true,qualityRejected:result.qualityRejected===true};
    await sql`UPDATE mobile_receipts SET response=${JSON.stringify(accepted)}::text::jsonb WHERE tenant_id=${a.tenantId} AND user_id=${a.userId} AND command_id=${key} AND request_hash=${hash}`;
    return accepted;
  }
  return sql.begin(async (tx:any)=> {
    const old=await receiptLock(tx,a,key,hash);
    if(old?.response) return old.response;
    const [job]=await tx`SELECT * FROM work_orders WHERE tenant_id=${a.tenantId} AND id=${input.workOrderId!}
      AND (${a.role!=='worker'} OR assigned_to=${a.userId} OR EXISTS(SELECT 1 FROM production_operations p WHERE p.tenant_id=${a.tenantId} AND p.work_order_id=work_orders.id AND p.assigned_to=${a.userId})) FOR UPDATE`;
    if(!job) throw new WorkOrderApiError('İş emri bulunamadı veya size atanmamış.',404);
    if(['done','cancelled'].includes(job.status)) throw new MobileConflict('İş emri kapatılmış. İşlem uygulanamaz.',false);
    const d=input.data;
    let eventType: string;
    let payload: Record<string,unknown>;
    if(input.kind==='comment') {
      requireWorkOrderPermission(a,'comment');
      const [comment]=await tx`INSERT INTO work_order_comments(tenant_id,work_order_id,body,created_by) VALUES(${a.tenantId},${job.id},${String(d.body).trim()},${a.userId}) RETURNING id`;
      eventType='work_order.comment_added'; payload={commentId:comment.id};
    } else if(input.kind==='checklist') {
      requireWorkOrderPermission(a,'checklist');
      const [item]=await tx`SELECT id,completed FROM work_order_checklist_items WHERE tenant_id=${a.tenantId} AND work_order_id=${job.id} AND id=${String(d.itemId)} FOR UPDATE`;
      if(!item) throw new WorkOrderApiError('Kontrol öğesi bulunamadı.',404);
      if(item.completed!==d.expectedCompleted) throw new MobileConflict('Kontrol öğesi sunucuda değişmiş.',true);
      await tx`UPDATE work_order_checklist_items SET completed=${Boolean(d.completed)},completed_at=${d.completed?new Date():null},completed_by=${d.completed?a.userId:null},updated_at=now() WHERE tenant_id=${a.tenantId} AND id=${item.id}`;
      eventType='work_order.checklist_toggled';payload={itemId:item.id,completed:d.completed};
    } else if(input.kind==='scrap' || input.kind==='delay') {
      const [available]=await tx`SELECT to_regclass('public.production_reason_codes') IS NOT NULL AS codes,to_regclass('public.production_scrap_events') IS NOT NULL AS scrap,to_regclass('public.production_delays') IS NOT NULL AS delay`;
      if(!available?.codes || !available[input.kind]) throw new WorkOrderApiError('Fire/gecikme modülü sunucuda henüz etkin değil.',503);
      const [reason]=await tx`SELECT label FROM production_reason_codes WHERE tenant_id=${a.tenantId} AND kind=${input.kind} AND code=${String(d.reasonCode)} AND active=true`;
      if(!reason) throw new WorkOrderApiError('Neden kodu kapatılmış veya geçersiz. Kaydı inceleyin.',400);
      if(input.kind==='scrap') {
        if(d.operationId && !(await tx`SELECT id FROM production_operations WHERE tenant_id=${a.tenantId} AND id=${String(d.operationId)} AND work_order_id=${job.id} AND (${a.role!=='worker'} OR assigned_to=${a.userId})`).length) throw new WorkOrderApiError('Operasyon bu işe veya size ait değil.',403);
        for(const url of (d.photos||[]) as string[]) {
          const id=url.split('/').pop();
          if(!url.startsWith(`/api/v1/production/files/${a.tenantId}/`) || !(await tx`SELECT id FROM production_files WHERE tenant_id=${a.tenantId} AND work_order_id=${job.id} AND id::text=${id||''}`).length) throw new WorkOrderApiError('Fotoğraf bu işe ait değil.',400);
        }
        await tx`INSERT INTO production_scrap_events(tenant_id,work_order_id,operation_id,quantity,reason_code,note,photos,created_by) VALUES(${a.tenantId},${job.id},${d.operationId||null},${Number(d.quantity)},${String(d.reasonCode)},${d.note||null},${JSON.stringify(d.photos||[])}::text::jsonb,${a.userId})`;
        eventType='scrap_recorded';payload={reasonCode:d.reasonCode,quantity:d.quantity};
      } else {
        if((await tx`SELECT id FROM production_delays WHERE tenant_id=${a.tenantId} AND work_order_id=${job.id} AND resolved_at IS NULL`).length) throw new MobileConflict('Bu işte açık gecikme var. Yeni kayıt uygulanamaz.',false);
        await tx`INSERT INTO production_delays(tenant_id,work_order_id,reason_code,note,created_by) VALUES(${a.tenantId},${job.id},${String(d.reasonCode)},${d.note||null},${a.userId})`;
        eventType='delay_reported';payload={reasonCode:d.reasonCode};
        // Notification metadata contains no note, customer identity or price. Same web event kind.
        await tx`INSERT INTO notifications(id,user_id,tenant_id,type,title,message,data,channels)
          SELECT 'ntf_'||gen_random_uuid()::text,user_id,${a.tenantId},'order:delayed','Üretimde gecikme','Saha ekibi gecikme bildirdi.',${JSON.stringify({entityType:'work_order',entityId:job.id})}::text::jsonb,'["in_app"]'::jsonb FROM tenant_members m WHERE tenant_id=${a.tenantId} AND role IN('owner','admin') AND user_id<>${a.userId} AND (to_jsonb(m)->>'deactivated_at') IS NULL AND NOT EXISTS(SELECT 1 FROM notification_preferences p WHERE p.user_id=m.user_id AND p.in_app->>'order:delayed'='false')`;
      }
    } else {
      requireWorkOrderPermission(a,'transition');
      if(job.recipe_id) throw new MobileConflict('Üretim emrini operasyon adımları üzerinden ilerletin.',false);
      if(['done','cancelled'].includes(String(d.status))) requireWorkOrderPermission(a,'close');
      if(new Date(job.updated_at).toISOString()!==d.expectedUpdatedAt) throw new MobileConflict('İş emri sunucuda değişmiş.',true);
      if(!canTransitionWorkOrderStatus(job.status as WorkOrderStatus,d.status as WorkOrderStatus)) throw new MobileConflict('Bu durum geçişi artık uygulanamaz.',false);
      const category=d.status==='blocked'?normalizeBlockedReasonCategory(String(d.blockedReasonCategory||'')):null;
      const detail=d.status==='blocked'?normalizeBlockedReasonDetail(String(d.blockedReasonDetail||'')):null;
      try { validateBlockedReasonForStatus(String(d.status),category,detail); } catch { throw new WorkOrderApiError('Gecikme nedeni ve en az 5 karakter açıklama gerekli.',400); }
      await tx`UPDATE work_orders SET status=${String(d.status)},blocked_reason_category=${category},blocked_reason_detail=${detail},blocked_at=${d.status==='blocked'?new Date():null},completed_at=${d.status==='done'?new Date():null},updated_at=now() WHERE tenant_id=${a.tenantId} AND id=${job.id}`;
      eventType='work_order.updated';payload={fromStatus:job.status,toStatus:d.status};
    }
    await tx`INSERT INTO work_order_events(tenant_id,work_order_id,event_type,payload,created_by) VALUES(${a.tenantId},${job.id},${eventType},${JSON.stringify({...payload,mobileCommandId:key})}::text::jsonb,${a.userId})`;
    const accepted={accepted:true};
    await tx`INSERT INTO mobile_receipts(tenant_id,user_id,command_id,request_hash,response) VALUES(${a.tenantId},${a.userId},${key},${hash},${JSON.stringify(accepted)}::text::jsonb)`;
    return accepted;
  });
}
