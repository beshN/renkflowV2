import { NextRequest } from 'next/server';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { getQuote, setQuoteStatus } from '@/lib/features/fair/quotes.server';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f-]{36}$/i;

/** One quote request with its design previews. */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    if (!UUID.test(id)) return recordError(new SyntaxError('id'), 'fair-quote');
    return redactedJson({ quote: await getQuote(await requireWorkOrderActor(), id) }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'fair-quote');
  }
}

/** { status }: new → reviewing → quoted → sent → accepted / rejected. */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    requireSameOriginJson(req, 2_000);
    const { id } = await params;
    if (!UUID.test(id)) return recordError(new SyntaxError('id'), 'fair-quote');
    await setQuoteStatus(await requireWorkOrderActor(), id, await req.json());
    return redactedJson({ ok: true }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'fair-quote');
  }
}
