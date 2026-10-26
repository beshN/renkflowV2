import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { isMfaEnabled } from '@/lib/features/auth/mfa.server';
import { MfaPolicyError, readMfaPolicy, setMfaPolicy } from '@/lib/features/auth/mfa-policy.server';
import { requireSameOrigin } from '@/lib/features/manufacturing/http-security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';

export const dynamic = 'force-dynamic';

const Body = z.object({ requireForAdmins: z.boolean() });

/** The firm's two-step sign-in rule for owners and admins, and whether you may change it. */
export async function GET() {
  try {
    const actor = await requireWorkOrderActor();
    if (actor.role !== 'owner' && actor.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
    const policy = await readMfaPolicy(sql, actor.tenantId);
    return NextResponse.json({ ...policy, canEdit: actor.role === 'owner', ownMfaEnabled: await isMfaEnabled(sql, actor.userId) }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'tenant-mfa-policy');
  }
}

/** Owner only. Turning it on needs the owner's own two-step sign-in. */
export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);
    const actor = await requireWorkOrderActor();
    const body = Body.parse(await req.json());
    const policy = await setMfaPolicy(sql, { tenantId: actor.tenantId, actorId: actor.userId, actorRole: actor.role, enabled: body.requireForAdmins });
    return NextResponse.json(policy, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof MfaPolicyError) return NextResponse.json({ error: e.message }, { status: e.status, headers: NO_STORE });
    return recordError(e, 'tenant-mfa-policy');
  }
}
