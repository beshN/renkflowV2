import { assistantFormHref } from '@/lib/ai/assistant-form-drafts';
import { assistantModelInfo } from '@/lib/ai/model-info';
import { NextRequest, NextResponse } from 'next/server';
import { tenantPersonalNames } from '@/lib/ai/known-names';
import { z, ZodError } from 'zod';
import { getAIService } from '@/lib/ai/service';
import { assistantSnapshot, searchAssistant } from '@/lib/ai/workspace';
import { safeAssistantHref } from '@/lib/ai/assistant-contract';
import { requireWorkOrderActor, WorkOrderApiError } from '@/lib/features/work-orders/security';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { canAccessRoute, hasPermission } from '@/lib/features/auth/permissions';
import { consumeRateLimit, rateLimitHeaders } from '@/lib/security/rate-limit';
import { ModelBlockedError } from '@/lib/ai/policy';
import { routeRequirement } from '@/lib/security/access-matrix';
const input=z.object({message:z.string().trim().min(1).max(2000),mode:z.enum(['chat','proactive']).default('chat'),context:z.object({currentPath:z.string().max(240).optional()}).optional(),history:z.array(z.object({role:z.enum(['user','assistant']),content:z.string().max(4000)})).max(20).default([]),search:z.string().max(160).optional()});
export async function POST(req:NextRequest) {
 try {
  requireSameOriginJson(req,100000);
  const actor=await requireWorkOrderActor();
  const limit=await consumeRateLimit('assistant',actor.tenantId+':'+actor.userId);
  if(!limit.allowed) return NextResponse.json({error:'Kısa bir ara verip yeniden deneyin.'},{status:429,headers:rateLimitHeaders(limit)});
  const text=await req.text();if(Buffer.byteLength(text)>100000)throw new WorkOrderApiError('İstek çok büyük',413);
  const body=input.parse(JSON.parse(text)),path=body.context?.currentPath || '/dashboard';
  const query=body.search || body.message.match(/\bRF[-\s]?\d+\b/i)?.[0] || '';
  const [snapshot,knownNames]=await Promise.all([assistantSnapshot(actor,path,query),tenantPersonalNames(actor.tenantId)]);
  const searched=new Set<string>();
  const answer=await getAIService().assist(body.message,{currentPath:path},snapshot.data,body.history,(category,query)=>{searched.add(category);return searchAssistant(actor,category,query);},{tenantId:actor.tenantId,userId:actor.userId,feature:body.mode==='proactive'?'assistant.proactive':'assistant.chat'},knownNames);
  const actions=(body.mode==='proactive'?[]:answer.actions).slice(0,3).filter(action=>{
   const permissions=snapshot.data.access?.permissions??{};
   if(action.kind==='navigate') {const href=safeAssistantHref(action.href);if(!href)return false;const pathname=new URL(href,'https://internal.invalid').pathname,need=routeRequirement(pathname,'GET');return canAccessRoute(actor.role,pathname)&&(!need||permissions[need.module]?.includes(need.action)||need.orCreate&&permissions[need.module]?.includes('create'));}
   if(action.kind==='warehouseDraft')return ['owner','admin'].includes(actor.role) && permissions.inventory?.includes('edit') && Boolean(assistantFormHref(action.kind,action.note));
   if(action.kind==='attendanceDraft')return hasPermission(actor.role,'finance.employees.edit') && permissions.finance?.includes('edit') && Boolean(assistantFormHref(action.kind,action.note));
   if(action.kind==='orderNote')return hasPermission(actor.role,'orders.edit') && actor.role!=='worker' && permissions.orders?.includes('edit');
   return hasPermission(actor.role,'orders.create') && ['owner','admin','office'].includes(actor.role) && permissions.orders?.includes('create');
  });
  return NextResponse.json({success:true,model:assistantModelInfo(answer.modelUsed),response:answer.answer,suggestions:answer.suggestions.slice(0,4),actions,toolsUsed:[...new Set([...Object.keys(snapshot.data).filter(k=>Array.isArray(snapshot.data[k]) && !['unavailable'].includes(k)),...searched])],context:{generatedAt:snapshot.data.generatedAt,scope:snapshot.data.scope},confidence:null},{headers:{'Cache-Control':'private, no-store'}});
 } catch(error) {
  if(error instanceof WorkOrderApiError)return NextResponse.json({error:error.message},{status:error.status});
  if(error instanceof ModelBlockedError)return NextResponse.json({error:error.message,code:error.block},{status:409});
  if(error instanceof ZodError || error instanceof SyntaxError)return NextResponse.json({error:'Mesaj bilgilerini kontrol edip yeniden deneyin.'},{status:400});
  console.error('[Assistant]',error instanceof Error?error.message:'failed');
  return NextResponse.json({error:'Asistan şu anda yanıt veremiyor. Operasyon önerileri ve uygulama ekranları kullanılabilir.'},{status:503});
 }
}
export const maxDuration=60;
