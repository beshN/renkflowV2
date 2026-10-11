import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSameOrigin } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { removeVehicleEntry } from '@/lib/features/fleet/fleet.server';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ id: string; type: string; entryId: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    requireSameOrigin(req);
    const p = await params;
    await removeVehicleEntry(await requireWorkOrderActor(), z.string().uuid().parse(p.id), p.type, z.string().uuid().parse(p.entryId));
    return redactedJson({ ok: true }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'vehicle-entry');
  }
}
