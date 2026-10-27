import { NextRequest } from 'next/server';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { listQuotes } from '@/lib/features/fair/quotes.server';

export const dynamic = 'force-dynamic';

/** Configurator quote requests, newest first; ?status=&fair=<code>|web. */
export async function GET(req: NextRequest) {
  try {
    const p = req.nextUrl.searchParams;
    return redactedJson({ quotes: await listQuotes(await requireWorkOrderActor(), { status: p.get('status'), fair: p.get('fair') }) }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'fair-quotes');
  }
}
