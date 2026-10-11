import { NextRequest,NextResponse } from 'next/server';
import { requireWorkOrderActor,WorkOrderApiError } from '@/lib/features/work-orders/security';
import { assistantSnapshot } from '@/lib/ai/workspace';
import { aiAvailable } from '@/lib/ai/service';
import { modelEnabledFor } from '@/lib/ai/gate.server';
const cache=new Map<string,{expires:number,value:unknown}>();
export async function GET(req:NextRequest) {
 try {
  const a=await requireWorkOrderActor(),path=(req.nextUrl.searchParams.get('path')||'/dashboard').slice(0,240),key=[a.tenantId,a.userId,a.role,path].join(':');
  let entry=cache.get(key);
  if(!entry || entry.expires<Date.now()) {
   const snapshot=await assistantSnapshot(a,path);
   entry={expires:Date.now()+30000,value:{insights:snapshot.insights,fingerprint:snapshot.fingerprint,generatedAt:snapshot.data.generatedAt,unavailable:snapshot.data.unavailable,modelEnabled:await modelEnabledFor(a.tenantId,aiAvailable())}};
   if(cache.size>200)cache.clear();cache.set(key,entry);
  }
  return NextResponse.json(entry.value,{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){if(e instanceof WorkOrderApiError)return NextResponse.json({error:e.message},{status:e.status});console.error('[Insights]',e instanceof Error?e.message:'failed');return NextResponse.json({error:'Operasyon özeti alınamadı.'},{status:503});}
}
