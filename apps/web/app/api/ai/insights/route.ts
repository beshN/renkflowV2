import { NextRequest,NextResponse } from 'next/server';
import { requireWorkOrderActor,WorkOrderApiError } from '@/lib/features/work-orders/security';
import { assistantSnapshot } from '@/lib/ai/workspace';
import { aiAvailable } from '@/lib/ai/service';
import { modelEnabledFor } from '@/lib/ai/gate.server';
export async function GET(req:NextRequest) {
 try {
  const a=await requireWorkOrderActor(),path=(req.nextUrl.searchParams.get('path')||'/dashboard').slice(0,240);
  const snapshot=await assistantSnapshot(a,path);
  return NextResponse.json({insights:snapshot.insights,fingerprint:snapshot.fingerprint,generatedAt:snapshot.data.generatedAt,unavailable:snapshot.data.unavailable,modelEnabled:await modelEnabledFor(a.tenantId,aiAvailable())},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){if(e instanceof WorkOrderApiError)return NextResponse.json({error:e.message},{status:e.status});console.error('[Insights]',e instanceof Error?e.message:'failed');return NextResponse.json({error:'Operasyon özeti alınamadı.'},{status:503});}
}
