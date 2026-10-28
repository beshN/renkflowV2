import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { sql } from '@/lib/db';
import { confirmMfaSetup, disableMfa, getMfaState, MfaError, startMfaSetup } from '@/lib/features/auth/mfa.server';
import { requireSameOrigin } from '@/lib/features/manufacturing/http-security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { consumeRateLimit, getClientIp, rateLimitResponse } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('start') }),
  z.object({ action: z.literal('confirm'), code: z.string().trim().min(6).max(20) }),
  z.object({ action: z.literal('disable'), code: z.string().trim().min(6).max(20) }),
]);

/** Your two-step sign-in status. */
export async function GET() {
  try {
    const actor = await requireWorkOrderActor({ allowDuringMfaSetup: true });
    return NextResponse.json(await getMfaState(sql, actor.userId), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'me-mfa');
  }
}

/** start → secret and QR code; confirm → turns it on, returns recovery codes once; disable. */
export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);
    const actor = await requireWorkOrderActor({ allowDuringMfaSetup: true });
    // Code guesses count against the same budget as password guesses.
    const limit = await consumeRateLimit('loginAccount', `mfa:${actor.userId}`);
    if (!limit.allowed) return rateLimitResponse(limit);
    const body = Body.parse(await req.json());
    if (body.action === 'start') {
      const session = await auth();
      const setup = await startMfaSetup(sql, { userId: actor.userId, email: session?.user?.email || actor.userId });
      return NextResponse.json(setup, { headers: NO_STORE });
    }
    if (body.action === 'confirm') {
      const recoveryCodes = await confirmMfaSetup(sql, { userId: actor.userId, tenantId: actor.tenantId, code: body.code });
      return NextResponse.json({ enabled: true, recoveryCodes }, { headers: NO_STORE });
    }
    await disableMfa(sql, { userId: actor.userId, tenantId: actor.tenantId, code: body.code });
    return NextResponse.json({ enabled: false }, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof MfaError) return NextResponse.json({ error: e.message }, { status: 400, headers: NO_STORE });
    return recordError(e, 'me-mfa');
  }
}
