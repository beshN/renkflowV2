import { NextRequest } from 'next/server';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { cancelInvoice, deleteDraft, getInvoice, issueInvoice } from '@/lib/features/finance/invoices.server';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    return redactedJson(await getInvoice(await requireWorkOrderActor(), id), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'invoices');
  }
}

/** { action: 'issue', issuedOn?, dueOn? } | { action: 'cancel', reason }. */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    requireSameOriginJson(req, 10_000);
    const { id } = await params;
    const actor = await requireWorkOrderActor();
    const { action, ...body } = (await req.json()) as Record<string, unknown>;
    if (action === 'issue') return redactedJson(await issueInvoice(actor, id, body), { headers: NO_STORE });
    if (action === 'cancel') { await cancelInvoice(actor, id, body); return redactedJson({ ok: true }, { headers: NO_STORE }); }
    return recordError(new SyntaxError('action'), 'invoices');
  } catch (e) {
    return recordError(e, 'invoices');
  }
}

/** Delete a draft (an issued invoice is cancelled instead). */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    requireSameOriginJson(req, 1_000);
    const { id } = await params;
    await deleteDraft(await requireWorkOrderActor(), id);
    return redactedJson({ ok: true }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'invoices');
  }
}
