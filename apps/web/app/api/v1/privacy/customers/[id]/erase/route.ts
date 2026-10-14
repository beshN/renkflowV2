import { NextRequest } from 'next/server';
import { redactedJson } from '@/lib/security/field-access.server';
import { sql } from '@/lib/db';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { anonymizeCustomer } from '@/lib/features/privacy/subject.server';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

/** { confirmName, requestId? }: anonymises the customer's personal data (irreversible). */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    requireSameOriginJson(req, 5_000);
    return redactedJson(await anonymizeCustomer(sql, await requireWorkOrderActor(), (await params).id, await req.json()), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'privacy-erase');
  }
}
