import { NextRequest } from 'next/server';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { listFairs, saveFair } from '@/lib/features/fair/fairs.server';

export const dynamic = 'force-dynamic';

/** Fairs with their design and quote counts. */
export async function GET() {
  try {
    return redactedJson({ fairs: await listFairs(await requireWorkOrderActor()) }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'fairs');
  }
}

export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 10_000);
    return redactedJson(await saveFair(await requireWorkOrderActor(), await req.json()), { status: 201, headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'fairs');
  }
}
