import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { getFairRequest } from '@/lib/features/fair/requests.server';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ id: string }> };

/** One fair request with its product previews. */
export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return recordError(new SyntaxError('id'), 'fair-request');
    return redactedJson({ request: await getFairRequest(await requireWorkOrderActor(), id) }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'fair-request');
  }
}
