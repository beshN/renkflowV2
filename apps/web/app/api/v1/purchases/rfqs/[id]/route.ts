import { redactedJson } from '@/lib/security/field-access.server';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { awardRfq, cancelRfq, recordRfqResponse } from '@/lib/features/stock/depth.server';

export const dynamic = 'force-dynamic';
const Command = z.object({ action: z.enum(['response', 'award', 'cancel']) }).passthrough();

/** { action: 'response', supplierId, prices, … } | { action: 'award', supplierId, version } | { action: 'cancel' } */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSameOriginJson(req, 50_000);
    const actor = await requireWorkOrderActor();
    const { id } = await params;
    const { action, ...body } = Command.parse(await req.json());
    const result = action === 'response' ? await recordRfqResponse(actor, id, body) : action === 'award' ? await awardRfq(actor, id, body) : await cancelRfq(actor, id);
    return redactedJson(result, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'rfq');
  }
}
