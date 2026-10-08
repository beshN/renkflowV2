import { NextResponse } from 'next/server';
import { requireWorkOrderActor, WorkOrderApiError } from '@/lib/features/work-orders/security';
import { stockThresholdWarnings } from '@/lib/features/inventory/thresholds';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

/** Items under their minimum stock, with what is ordered and whether a draft order can be suggested. */
export async function GET() {
  try {
    return NextResponse.json({ items: await stockThresholdWarnings(await requireWorkOrderActor()) }, { headers });
  } catch (e) {
    if (e instanceof WorkOrderApiError) return NextResponse.json({ error: e.message }, { status: e.status, headers });
    console.error('[stock thresholds]', e instanceof Error ? e.message : 'failed');
    return NextResponse.json({ error: 'Stok eşikleri alınamadı.' }, { status: 500, headers });
  }
}
