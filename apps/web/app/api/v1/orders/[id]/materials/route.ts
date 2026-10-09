import { NextRequest, NextResponse } from 'next/server';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { orderMaterialStatus } from '@/lib/features/stock/depth.server';

export const dynamic = 'force-dynamic';

/** What the order's configured lines need against free stock, with incoming purchases. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return NextResponse.json(await orderMaterialStatus(await requireWorkOrderActor(), (await params).id), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'order-materials');
  }
}
