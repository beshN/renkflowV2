import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { setMemberActive, updateMember } from '@/lib/security/team.server';
import { ASSIGNABLE_ROLES } from '@/lib/security/team-rules';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ userId: string }> };

const Body = z.object({
  role: z.enum(ASSIGNABLE_ROLES).optional(),
  accessRole: z.string().trim().max(80).nullable().optional(),
  active: z.boolean().optional(),
}).strict();

/** Change a member's role, access role or status (deactivate keeps their records). */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    requireSameOriginJson(req, 10_000);
    const actor = await requireWorkOrderActor();
    const { userId } = await params;
    z.string().uuid().parse(userId);
    const body = Body.parse(await req.json());
    if (body.role !== undefined || body.accessRole !== undefined) await updateMember(actor, userId, { role: body.role, accessRole: body.accessRole === undefined ? undefined : body.accessRole || null });
    if (body.active !== undefined) await setMemberActive(actor, userId, body.active);
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'team-member');
  }
}
