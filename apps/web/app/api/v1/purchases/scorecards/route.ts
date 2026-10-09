import { NextResponse } from 'next/server';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { supplierScorecards } from '@/lib/features/stock/depth.server';

export const dynamic = 'force-dynamic';

/** Supplier scores (on time, rejects, lead time) and price history per item. */
export async function GET() {
  try {
    return NextResponse.json(await supplierScorecards(await requireWorkOrderActor()), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'scorecards');
  }
}
