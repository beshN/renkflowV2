import { NextRequest } from 'next/server';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { assignableJobs, createVehicle, fleetHealthSummary, fleetLive, listVehicles } from '@/lib/features/fleet/fleet.server';

export const dynamic = 'force-dynamic';

/** Fleet cards; ?view=live (last positions) | health (dashboard card) | jobs (assignable jobs). Owner/admin only. */
export async function GET(req: NextRequest) {
  try {
    const actor = await requireWorkOrderActor();
    const view = req.nextUrl.searchParams.get('view');
    if (view === 'live') return redactedJson(await fleetLive(actor), { headers: NO_STORE });
    if (view === 'health') return redactedJson(await fleetHealthSummary(actor), { headers: NO_STORE });
    if (view === 'jobs') return redactedJson(await assignableJobs(actor), { headers: NO_STORE });
    return redactedJson({ vehicles: await listVehicles(actor) }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'vehicles');
  }
}

export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 10_000);
    return redactedJson(await createVehicle(await requireWorkOrderActor(), await req.json()), { status: 201, headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'vehicles');
  }
}
