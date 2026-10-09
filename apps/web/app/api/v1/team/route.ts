import { NextResponse } from 'next/server';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { listInvites, listRoles, listTeam, requireTeamManager } from '@/lib/security/team.server';

export const dynamic = 'force-dynamic';

/** Team screen: members, roles and open invites. Owners and admins only. */
export async function GET() {
  try {
    const actor = await requireWorkOrderActor();
    await requireTeamManager(actor);
    const [members, roles, invites] = await Promise.all([listTeam(actor), listRoles(actor), listInvites(actor)]);
    return NextResponse.json({ members, roles, invites, me: actor.userId, myRole: actor.role }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'team');
  }
}
