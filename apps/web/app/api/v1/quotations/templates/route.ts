import { redactedJson } from '@/lib/security/field-access.server';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { deleteTemplate, listTemplates } from '@/lib/features/sales/quotes.server';

export const dynamic = 'force-dynamic';

/** Quote templates: lines, notes and terms to start a new quote from. */
export async function GET() {
  try {
    return redactedJson({ templates: await listTemplates(await requireWorkOrderActor()) }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'quote-templates');
  }
}

export async function DELETE(req: NextRequest) {
  try {
    requireSameOriginJson(req, 1_000);
    const actor = await requireWorkOrderActor();
    await deleteTemplate(actor, z.string().uuid().parse(req.nextUrl.searchParams.get('id')));
    return redactedJson({ templates: await listTemplates(actor) }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'quote-templates');
  }
}
