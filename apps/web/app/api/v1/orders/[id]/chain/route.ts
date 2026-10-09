import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { orderChain } from '@/lib/features/field/service.server';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ id: string }> };

/** An order's chain: the lead behind it, its installations and sign-off, service tickets, warranty. */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const orderId = z.string().uuid().parse((await params).id);
    return redactedJson(await orderChain(await requireWorkOrderActor(), orderId), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'order-chain');
  }
}
