import { redactedJson } from '@/lib/security/field-access.server';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor, WorkOrderApiError } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import {
  approveDiscount, createApprovalLink, decisionTrail, discountState, expireDueQuotes, quoteHistory, reviseQuote, salesAvailable, saveTemplateFromQuote,
} from '@/lib/features/sales/quotes.server';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ id: string }> };
const READERS = ['owner', 'admin', 'office', 'accountant'];

/** Quote depth for its screen: revisions with diffs, discount position, customer decision and link. */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const actor = await requireWorkOrderActor();
    if (!READERS.includes(actor.role)) throw new WorkOrderApiError('Teklif görme yetkiniz yok', 403);
    const id = z.string().uuid().parse((await params).id);
    if (!(await salesAvailable())) return redactedJson({ available: false }, { headers: NO_STORE });
    await expireDueQuotes(actor.tenantId);
    const [history, discount, decision] = await Promise.all([quoteHistory(actor, id), discountState(actor.tenantId, id), decisionTrail(actor, id)]);
    return redactedJson({ available: true, history, discount, decision }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'quote-sales');
  }
}

const Command = z.discriminatedUnion('action', [
  z.object({ action: z.literal('revise'), reason: z.string().max(1000) }),
  z.object({ action: z.literal('approve_discount'), expectedPercent: z.number().min(0).max(100).optional() }),
  z.object({ action: z.literal('approval_link') }),
  z.object({ action: z.literal('save_template'), name: z.string().max(80) }),
]);

export async function POST(req: NextRequest, { params }: Params) {
  try {
    requireSameOriginJson(req, 20_000);
    const actor = await requireWorkOrderActor();
    const id = z.string().uuid().parse((await params).id);
    const c = Command.parse(await req.json());
    const result =
      c.action === 'revise' ? await reviseQuote(actor, id, c.reason)
      : c.action === 'approve_discount' ? await approveDiscount(actor, id, c.expectedPercent)
      : c.action === 'approval_link' ? await createApprovalLink(actor, id)
      : await saveTemplateFromQuote(actor, id, c.name);
    return redactedJson(result, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'quote-sales');
  }
}
