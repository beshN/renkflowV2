import { NextRequest } from 'next/server';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { planCutListFromDoc } from '@/lib/features/manufacturing/cut-list.server';

export const dynamic = 'force-dynamic';

/** An order sheet that was already read → what to cut from which bar (stock, leftovers, scrap). Writes nothing. */
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 300_000);
    return redactedJson(await planCutListFromDoc(await requireWorkOrderActor(), await req.json()), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'cut-list');
  }
}
