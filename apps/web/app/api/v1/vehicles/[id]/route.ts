import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { addVehicleEntry, createDevice, getVehicle, updateVehicle } from '@/lib/features/fleet/fleet.server';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ id: string }> };
const id = async (params: Params['params']) => z.string().uuid().parse((await params).id);

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    return redactedJson(await getVehicle(await requireWorkOrderActor(), await id(params)), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'vehicle');
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    requireSameOriginJson(req, 10_000);
    const actor = await requireWorkOrderActor();
    const vehicleId = await id(params);
    await updateVehicle(actor, vehicleId, await req.json());
    return redactedJson(await getVehicle(actor, vehicleId), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'vehicle');
  }
}

/** { type: 'document'|'maintenance'|'fuel'|'assignment', ... } or { type: 'device', label } (the token is shown once). */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    requireSameOriginJson(req, 20_000);
    const actor = await requireWorkOrderActor();
    const vehicleId = await id(params);
    const body = (await req.json()) as { type?: string; label?: string };
    if (body.type === 'device') return redactedJson(await createDevice(actor, vehicleId, { label: body.label }), { status: 201, headers: NO_STORE });
    return redactedJson(await addVehicleEntry(actor, vehicleId, body), { status: 201, headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'vehicle');
  }
}
