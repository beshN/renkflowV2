import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { vehicleRoute } from '@/lib/features/fleet/fleet.server';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ id: string }> };

/** ?day=YYYY-MM-DD (Istanbul day): points, distance, stops, km. */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const vehicleId = z.string().uuid().parse((await params).id);
    const day = req.nextUrl.searchParams.get('day') ?? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date());
    return redactedJson(await vehicleRoute(await requireWorkOrderActor(), vehicleId, day), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'vehicle-route');
  }
}
