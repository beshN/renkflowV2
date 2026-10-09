import { NextRequest } from 'next/server';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { fleetSettings, saveFleetSettings } from '@/lib/features/fleet/fleet.server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return redactedJson(await fleetSettings(await requireWorkOrderActor()), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'fleet-settings');
  }
}

/** { retentionDays: number | null } — null keeps positions forever. */
export async function PUT(req: NextRequest) {
  try {
    requireSameOriginJson(req, 1_000);
    return redactedJson(await saveFleetSettings(await requireWorkOrderActor(), await req.json()), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'fleet-settings');
  }
}
