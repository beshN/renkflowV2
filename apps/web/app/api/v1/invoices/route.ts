import { NextRequest } from 'next/server';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { createInvoiceDraft, listInvoices } from '@/lib/features/finance/invoices.server';

export const dynamic = 'force-dynamic';

/** Invoices of the firm (?status=draft|issued|cancelled). Finance roles only. */
export async function GET(req: NextRequest) {
  try {
    const actor = await requireWorkOrderActor();
    return redactedJson({ invoices: await listInvoices(actor, req.nextUrl.searchParams.get('status')) }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'invoices');
  }
}

/** A draft invoice from an order: { orderId, lines: [{ orderItemId, quantity }], extra?, vatPercent?, notes? }. */
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 50_000);
    const { orderId, ...body } = (await req.json()) as Record<string, unknown>;
    if (typeof orderId !== 'string') return recordError(new SyntaxError('orderId'), 'invoices');
    return redactedJson(await createInvoiceDraft(await requireWorkOrderActor(), orderId, body), { status: 201, headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'invoices');
  }
}
