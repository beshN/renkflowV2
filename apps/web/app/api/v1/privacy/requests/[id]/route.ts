import { NextRequest } from 'next/server';
import { redactedJson } from '@/lib/security/field-access.server';
import { sql } from '@/lib/db';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { closeRequest } from '@/lib/features/privacy/subject.server';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

/** { status: 'completed' | 'rejected', resolution } closes an open request. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    requireSameOriginJson(req, 20_000);
    await closeRequest(sql, await requireWorkOrderActor(), (await params).id, await req.json());
    return redactedJson({ ok: true }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'privacy-requests');
  }
}
