import { NextRequest } from 'next/server';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { priceSuggestionFor } from '@/lib/ai/insight/price.server';

export const dynamic = 'force-dynamic';

/** Price hint with its evidence for one line (?family&widthMm&projectionMm[&price][&matrixUnitPrice]). Read only. */
export async function GET(req: NextRequest) {
  try {
    const actor = await requireWorkOrderActor();
    return redactedJson(await priceSuggestionFor(actor, Object.fromEntries(req.nextUrl.searchParams)), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'ai-price');
  }
}
