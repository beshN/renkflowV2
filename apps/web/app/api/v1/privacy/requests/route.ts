import { NextRequest } from 'next/server';
import { redactedJson } from '@/lib/security/field-access.server';
import { sql } from '@/lib/db';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { createRequest, listRequests } from '@/lib/features/privacy/subject.server';

export const dynamic = 'force-dynamic';

/** KVKK request register (owner/admin). */
export async function GET() {
  try {
    return redactedJson({ requests: await listRequests(sql, await requireWorkOrderActor()) }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'privacy-requests');
  }
}

export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 20_000);
    return redactedJson(await createRequest(sql, await requireWorkOrderActor(), await req.json()), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'privacy-requests');
  }
}
