import { NextRequest } from 'next/server';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { createOrderFromFoy } from '@/lib/features/foy/service.server';

export const dynamic = 'force-dynamic';

/** The reviewed föy, approved by the user, becomes an order (the PDF is attached when storage is on). */
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 4_400_000);
    const actor = await requireWorkOrderActor();
    return redactedJson(await createOrderFromFoy(actor, await req.json()), { status: 201, headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'foy-order');
  }
}
