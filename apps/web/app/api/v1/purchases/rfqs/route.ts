import { NextRequest, NextResponse } from 'next/server';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { createRfq, listRfqs } from '@/lib/features/stock/depth.server';

export const dynamic = 'force-dynamic';

/** Requests for quotation with the suppliers' answers compared. */
export async function GET() {
  try {
    return NextResponse.json(await listRfqs(await requireWorkOrderActor()), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'rfqs');
  }
}

export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 50_000);
    return NextResponse.json(await createRfq(await requireWorkOrderActor(), await req.json()), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'rfqs');
  }
}
