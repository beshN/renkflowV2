import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSameOrigin } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { revokeSession } from '@/lib/security/team.server';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ id: string }> };

/** Close one session (yours, or a member's when you manage the team). */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    requireSameOrigin(req);
    const actor = await requireWorkOrderActor();
    const { id } = await params;
    z.string().uuid().parse(id);
    await revokeSession(actor, id);
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'me-sessions');
  }
}
