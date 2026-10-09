import { NextRequest, NextResponse } from 'next/server';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { allReasonCodes, productionDepthAvailable, saveReasonCode } from '@/lib/features/production/depth.server';

export const dynamic = 'force-dynamic';

/** The firm's scrap, rework and delay reasons. */
export async function GET() {
  try {
    return NextResponse.json({ available: await productionDepthAvailable(), reasons: await allReasonCodes(await requireWorkOrderActor()) }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'production-reasons');
  }
}

export async function PUT(req: NextRequest) {
  try {
    requireSameOriginJson(req, 2_000);
    return NextResponse.json({ available: true, reasons: await saveReasonCode(await requireWorkOrderActor(), await req.json()) }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'production-reasons');
  }
}
