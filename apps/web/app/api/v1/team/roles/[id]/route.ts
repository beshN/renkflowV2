import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSameOrigin, requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { deleteRole, saveRole } from '@/lib/security/team.server';
import { RoleBody } from '../schema';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    requireSameOriginJson(req, 20_000);
    const actor = await requireWorkOrderActor();
    const { id } = await params;
    z.string().uuid().parse(id);
    await saveRole(actor, id, RoleBody.parse(await req.json()));
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'team-roles');
  }
}

/** Delete a custom role; its members fall back to their base role's preset. */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    requireSameOrigin(req);
    const actor = await requireWorkOrderActor();
    const { id } = await params;
    z.string().uuid().parse(id);
    await deleteRole(actor, id);
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'team-roles');
  }
}
