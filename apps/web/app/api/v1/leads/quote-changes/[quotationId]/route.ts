import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { measureChangesForQuote } from '@/lib/features/field/leads.server';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ quotationId: string }> };

/** Survey measures changed since this quote was made (the quote screen warns). */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const quotationId = z.string().uuid().parse((await params).quotationId);
    return redactedJson({ changes: await measureChangesForQuote(await requireWorkOrderActor(), quotationId) }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'quote-changes');
  }
}
