import { NextRequest, NextResponse } from 'next/server';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { barLengthOptions, saveBarLengthOptions } from '@/lib/features/production/depth.server';

export const dynamic = 'force-dynamic';

/** Bar lengths the firm can buy; purchase sizing picks the one that wastes least per profile. */
export async function GET() {
  try {
    return NextResponse.json(await barLengthOptions(await requireWorkOrderActor()), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'bar-lengths');
  }
}

export async function PUT(req: NextRequest) {
  try {
    requireSameOriginJson(req, 1_000);
    return NextResponse.json(await saveBarLengthOptions(await requireWorkOrderActor(), await req.json()), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'bar-lengths');
  }
}
