import { NextRequest } from 'next/server';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { saveFair } from '@/lib/features/fair/fairs.server';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    requireSameOriginJson(req, 10_000);
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return recordError(new SyntaxError('id'), 'fairs');
    return redactedJson(await saveFair(await requireWorkOrderActor(), await req.json(), id), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'fairs');
  }
}
