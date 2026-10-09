import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { setDeviceActive } from '@/lib/features/fleet/fleet.server';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ id: string; deviceId: string }> };

/** { active } — a lost or replaced device is turned off (its token stops working). */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    requireSameOriginJson(req, 1_000);
    const p = await params;
    const { active } = z.object({ active: z.boolean() }).strict().parse(await req.json());
    await setDeviceActive(await requireWorkOrderActor(), z.string().uuid().parse(p.id), z.string().uuid().parse(p.deviceId), active);
    return redactedJson({ ok: true }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'vehicle-device');
  }
}
