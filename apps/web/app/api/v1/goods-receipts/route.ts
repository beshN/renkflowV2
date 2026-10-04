import { NextResponse } from 'next/server';
import { requireWorkOrderActor, WorkOrderApiError } from '@/lib/features/work-orders/security';
import { procurementReceipts } from '@/lib/features/manufacturing/purchasing.service';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { return NextResponse.json({ success:true,data:await procurementReceipts(await requireWorkOrderActor()) },{ headers:{ 'Cache-Control':'no-store' } }); }
  catch (e) { return NextResponse.json({ error:e instanceof WorkOrderApiError ? e.message : 'Kayıtlar alınamadı' },{ status:e instanceof WorkOrderApiError ? e.status : 500 }); }
}
