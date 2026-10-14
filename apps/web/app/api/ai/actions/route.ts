import { assistantFormHref } from '@/lib/ai/assistant-form-drafts';
import { NextRequest,NextResponse } from 'next/server';
import { z,ZodError } from 'zod';
import { createHash } from 'node:crypto';
import { AssistantActionSchema,safeAssistantHref } from '@/lib/ai/assistant-contract';
import { DocumentExtractionSchema } from '@/lib/ai/extraction';
import { sql,withTransaction } from '@/lib/db';
import { hasPermission,canAccessRoute } from '@/lib/features/auth/permissions';
import { requireWorkOrderActor,WorkOrderApiError } from '@/lib/features/work-orders/security';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { resolveMemberAccess } from '@/lib/security/member-access.server';
import { can } from '@/lib/security/access-matrix';
const schema=z.object({commandId:z.uuid(),action:AssistantActionSchema});
export async function POST(req:NextRequest) {
 try {
  requireSameOriginJson(req,100000);const a=await requireWorkOrderActor(),text=await req.text();if(Buffer.byteLength(text)>100000)throw new WorkOrderApiError('İstek çok büyük',413);
  const access=await resolveMemberAccess(a.userId,a.tenantId);if(!access||access.deactivated)throw new WorkOrderApiError('Etkin firma üyeliği gerekli.',403);
  const {commandId,action}=schema.parse(JSON.parse(text));
  if(action.kind==='navigate') {const href=safeAssistantHref(action.href);if(!href || !canAccessRoute(a.role,new URL(href,'https://internal.invalid').pathname))throw new WorkOrderApiError('Bu ekran mevcut rolünüz için kullanılamıyor.',403);return NextResponse.json({href});}
  if (action.kind === 'warehouseDraft' || action.kind === 'attendanceDraft') {
    const href = assistantFormHref(action.kind, action.note);
    if (!href) throw new WorkOrderApiError('Form bilgileri geçersiz.', 400);
    if (action.kind === 'warehouseDraft' && (!['owner','admin'].includes(a.role) || !can(access,'inventory','edit'))) throw new WorkOrderApiError('Depo oluşturma yetkisi gerekli.',403);
    if (action.kind === 'attendanceDraft') {
      if (!hasPermission(a.role,'finance.employees.edit') || !can(access,'finance','edit')) throw new WorkOrderApiError('Çalışan devam kaydı düzenleme yetkisi gerekli.',403);
      const employeeId = new URL(href, 'https://internal.invalid').searchParams.get('employeeId');
      if (!(await sql`SELECT id FROM employees WHERE tenant_id=${a.tenantId} AND id=${employeeId}`).length) throw new WorkOrderApiError('Çalışan bulunamadı.',404);
    }
    return NextResponse.json({ href, message: 'Form hazırlandı. Bilgileri inceleyip kaydedin.' }, {headers:{'Cache-Control':'private, no-store'}});
  }
  const hash=createHash('sha256').update(JSON.stringify({kind:'assistant',action})).digest('hex');
  const result=await withTransaction(async(tx:any)=>{
   await tx`SELECT pg_advisory_xact_lock(hashtextextended(${a.tenantId},0))`;
   const [old]=await tx`SELECT * FROM production_commands WHERE tenant_id=${a.tenantId} AND command_id=${commandId}`;
   if(old){if(old.actor_id!==a.userId || old.request_hash!==hash)throw new WorkOrderApiError('İşlem kimliği farklı içerikle kullanılamaz.',409);return typeof old.result==='string'?JSON.parse(old.result):old.result;}
   let result;
   if(action.kind==='orderNote') {
    if(a.role==='worker' || !hasPermission(a.role,'orders.edit') || !can(access,'orders','edit'))throw new WorkOrderApiError('Sipariş notu eklemek için düzenleme yetkisi gerekir.',403);
    const id=z.uuid().parse(action.orderId),note=z.string().trim().min(1).max(2000).parse(action.note);
    const [order]=await tx`SELECT id FROM orders WHERE tenant_id=${a.tenantId} AND id=${id} FOR SHARE`;
    if(!order)throw new WorkOrderApiError('Sipariş bulunamadı.',404);
    await tx`INSERT INTO activity_logs(tenant_id,entity_type,entity_id,action,actor_id,note)VALUES(${a.tenantId},'order',${id},'note_added',${a.userId},${note})`;
    result={href:'/orders/'+id,message:'Not sipariş geçmişine eklendi.'};
   }else {
    if(!['owner','admin','office'].includes(a.role) || !hasPermission(a.role,'orders.create') || !can(access,'orders','create'))throw new WorkOrderApiError('Sipariş taslağı oluşturma yetkisi gerekir.',403);
    const draft=DocumentExtractionSchema.parse(action.draft);if(!draft.items.length || draft.items.length>100)throw new WorkOrderApiError('Taslakta 1–100 ürün kalemi olmalı.',400);
    const [saved]=await tx`INSERT INTO intake_drafts(tenant_id,source,source_id,extracted_data,warnings,created_by)VALUES(${a.tenantId},'assistant',${commandId},${JSON.stringify(draft)}::text::jsonb,${JSON.stringify(draft.warnings)}::text::jsonb,${a.userId})RETURNING id`;
    result={href:'/production/intake/'+saved.id,message:'Sipariş taslağı hazır. Kalemleri inceleyip onaylayabilirsiniz.'};
   }
   await tx`INSERT INTO production_commands(tenant_id,command_id,actor_id,request_hash,result)VALUES(${a.tenantId},${commandId},${a.userId},${hash},${JSON.stringify(result)}::text::jsonb)`;
   return result;
  });
  return NextResponse.json(result,{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){if(e instanceof WorkOrderApiError)return NextResponse.json({error:e.message},{status:e.status});if(e instanceof ZodError || e instanceof SyntaxError)return NextResponse.json({error:'Önerilen işlem bilgileri eksik veya geçersiz.'},{status:400});console.error('[Assistant action]',e instanceof Error?e.message:'failed');return NextResponse.json({error:'İşlem tamamlanamadı. Aynı öneri üzerinden yeniden deneyebilirsiniz.'},{status:503});}
}
