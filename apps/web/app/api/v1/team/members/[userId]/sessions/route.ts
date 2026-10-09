import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSameOrigin } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { listSessions, requireTeamManager, revokeAllSessions } from '@/lib/security/team.server';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ userId: string }> };

/** A member's open sessions (for the team manager). */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const actor = await requireWorkOrderActor();
    await requireTeamManager(actor);
    const { userId } = await params;
    z.string().uuid().parse(userId);
    return NextResponse.json({ sessions: await listSessions(actor.tenantId, userId, null) }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'team-sessions');
  }
}

/** Close every session of a member. */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    requireSameOrigin(req);
    const actor = await requireWorkOrderActor();
    const { userId } = await params;
    z.string().uuid().parse(userId);
    await revokeAllSessions(actor, userId, 'admin');
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'team-sessions');
  }
}
