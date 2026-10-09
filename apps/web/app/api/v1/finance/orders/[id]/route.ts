import { NextRequest } from 'next/server';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { orderBilling } from '@/lib/features/finance/invoices.server';

export const dynamic = 'force-dynamic';

/** An order's billing: left to invoice, invoices, collections, balance, estimated profit. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return redactedJson(await orderBilling(await requireWorkOrderActor(), id), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'finance-order');
  }
}
