import { NextRequest } from 'next/server';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { paintDispatches } from '@/lib/features/manufacturing/paint-dispatch.server';
import { redactedJson } from '@/lib/security/field-access.server';
import { NO_STORE, recordError } from '@/lib/features/records/http';
export async function GET(req: NextRequest) {
  try {
    return redactedJson({ data: await paintDispatches(await requireWorkOrderActor(), req.nextUrl.searchParams.get('status')) }, { headers: NO_STORE });
  } catch (e) { return recordError(e, 'paint-dispatches'); }
}
