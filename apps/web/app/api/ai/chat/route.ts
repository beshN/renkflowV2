import { NextRequest, NextResponse } from 'next/server';
import { tenantPersonalNames } from '@/lib/ai/known-names';
import { z, ZodError } from 'zod';
import { getAIService } from '@/lib/ai/service';
import { assistantSnapshot, searchAssistant } from '@/lib/ai/workspace';
import { safeAssistantHref } from '@/lib/ai/assistant-contract';
import { requireWorkOrderActor, WorkOrderApiError } from '@/lib/features/work-orders/security';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { hasPermission } from '@/lib/features/auth/permissions';
import { consumeRateLimit, rateLimitHeaders } from '@/lib/security/rate-limit';
import { assistantAccess, assistantRouteAllowed } from '@/lib/ai/workspace-access.server';
import { can } from '@/lib/security/access-matrix';
import { ModelBlockedError } from '@/lib/ai/policy';
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
  const answer=await getAIService().assist(body.message,{currentPath:path},snapshot.data,body.history,(category,query)=>searchAssistant(actor,category,query),{tenantId:actor.tenantId,userId:actor.userId,feature:body.mode==='proactive'?'assistant.proactive':'assistant.chat'},knownNames);
  const access=await assistantAccess(actor);
  const actions=(body.mode==='proactive'?[]:answer.actions).slice(0,3).filter(action=>{
   if(action.kind==='navigate') {const href=safeAssistantHref(action.href);return !!href && assistantRouteAllowed(access,new URL(href,'https://internal.invalid').pathname);}
   if(action.kind==='orderNote')return hasPermission(actor.role,'orders.edit') && can(access,'orders','edit') && actor.role!=='worker';
   return hasPermission(actor.role,'orders.create') && can(access,'orders','create') && can(access,'production','view') && ['owner','admin','office'].includes(actor.role);
  });
  return NextResponse.json({success:true,response:answer.answer,suggestions:answer.suggestions.slice(0,4),actions,toolsUsed:Object.keys(snapshot.data).filter(k=>Array.isArray(snapshot.data[k]) && !['unavailable'].includes(k)),confidence:null},{headers:{'Cache-Control':'private, no-store'}});
 } catch(error) {
  if(error instanceof WorkOrderApiError)return NextResponse.json({error:error.message},{status:error.status});
  if(error instanceof ModelBlockedError)return NextResponse.json({error:error.message,code:error.block},{status:409});
  if(error instanceof ZodError || error instanceof SyntaxError)return NextResponse.json({error:'Mesaj bilgilerini kontrol edip yeniden deneyin.'},{status:400});
  console.error('[Assistant]',error instanceof Error?error.message:'failed');
  return NextResponse.json({error:'Asistan şu anda yanıt veremiyor. Operasyon önerileri ve uygulama ekranları kullanılabilir.'},{status:503});
 }
}
export const maxDuration=60;
