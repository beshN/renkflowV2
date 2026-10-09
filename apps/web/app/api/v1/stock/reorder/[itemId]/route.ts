import { NextRequest, NextResponse } from 'next/server';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { saveReorderPolicy } from '@/lib/features/stock/depth.server';

export const dynamic = 'force-dynamic';

/** The item's reorder policy: minimum, maximum, lead time days, order multiple. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    requireSameOriginJson(req, 2_000);
    return NextResponse.json(await saveReorderPolicy(await requireWorkOrderActor(), (await params).itemId, await req.json()), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'stock-reorder');
  }
}
