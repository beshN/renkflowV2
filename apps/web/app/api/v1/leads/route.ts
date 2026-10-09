import { NextRequest } from 'next/server';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { createLead, leadReport, listLeads } from '@/lib/features/field/leads.server';

export const dynamic = 'force-dynamic';

/** The lead pipeline; ?report=1&from=&to= gives the conversion report instead. */
export async function GET(req: NextRequest) {
  try {
    const actor = await requireWorkOrderActor();
    const p = req.nextUrl.searchParams;
    if (p.get('report') === '1') return redactedJson(await leadReport(actor, p.get('from') || undefined, p.get('to') || undefined), { headers: NO_STORE });
    return redactedJson({ leads: await listLeads(actor) }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'leads');
  }
}

export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 20_000);
    return redactedJson(await createLead(await requireWorkOrderActor(), await req.json()), { status: 201, headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'leads');
  }
}
