import { NextRequest } from 'next/server';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { listTickets, openTicket, ticketReport } from '@/lib/features/field/service.server';

export const dynamic = 'force-dynamic';

/** Service tickets (?status=), or ?report=1 for resolution times and recurring issues. */
export async function GET(req: NextRequest) {
  try {
    const actor = await requireWorkOrderActor();
    const p = req.nextUrl.searchParams;
    if (p.get('report') === '1') return redactedJson(await ticketReport(actor), { headers: NO_STORE });
    return redactedJson({ tickets: await listTickets(actor, p.get('status')) }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'service');
  }
}

export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 20_000);
    return redactedJson(await openTicket(await requireWorkOrderActor(), await req.json()), { status: 201, headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'service');
  }
}
