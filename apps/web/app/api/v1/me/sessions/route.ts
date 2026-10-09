import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { requireSameOrigin } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { listSessions, revokeAllSessions } from '@/lib/security/team.server';

export const dynamic = 'force-dynamic';

/** Your open sessions; the one you are using is marked. */
export async function GET() {
  try {
    const actor = await requireWorkOrderActor();
    const session = await auth();
    return NextResponse.json({ sessions: await listSessions(actor.tenantId, actor.userId, session?.sessionId ?? null) }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'me-sessions');
  }
}

/** Close all your sessions, this one included (you sign in again). */
export async function DELETE(req: NextRequest) {
  try {
    requireSameOrigin(req);
    const actor = await requireWorkOrderActor();
    await revokeAllSessions(actor, actor.userId, 'self');
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'me-sessions');
  }
}
