import { NextRequest } from 'next/server';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { recordCollection } from '@/lib/features/finance/invoices.server';

export const dynamic = 'force-dynamic';

/** A collection on an order: { orderId, invoiceId?, amount, method, paidOn, reference?, chequeDueOn?, note? }. */
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 10_000);
    return redactedJson(await recordCollection(await requireWorkOrderActor(), await req.json()), { status: 201, headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'collections');
  }
}
