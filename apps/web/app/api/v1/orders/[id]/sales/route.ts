import { redactedJson } from '@/lib/security/field-access.server';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { decideChange, orderSales, proposeChange, recordDelivery, setPaymentPlan, setPromisedDate } from '@/lib/features/sales/orders.server';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ id: string }> };

/** The order's commercial depth: promise vs actual, lines with deliveries, payment plan, change requests. */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    return redactedJson(await orderSales(await requireWorkOrderActor(), (await params).id), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'order-sales');
  }
}

const Command = z.object({ action: z.enum(['promise', 'delivery', 'plan', 'change', 'decide']), changeId: z.string().uuid().optional() }).passthrough();

export async function POST(req: NextRequest, { params }: Params) {
  try {
    requireSameOriginJson(req, 100_000);
    const actor = await requireWorkOrderActor();
    const { id } = await params;
    const { action, changeId, ...body } = Command.parse(await req.json());
    const result =
      action === 'promise' ? await setPromisedDate(actor, id, body)
      : action === 'delivery' ? await recordDelivery(actor, id, body)
      : action === 'plan' ? await setPaymentPlan(actor, id, body)
      : action === 'change' ? await proposeChange(actor, id, body)
      : await decideChange(actor, id, z.string().uuid().parse(changeId), body);
    return redactedJson(result, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'order-sales');
  }
}
