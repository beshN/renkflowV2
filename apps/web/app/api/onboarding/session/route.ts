import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { sql } from '@/lib/db';
import {
  CompleteOnboardingStepInputSchema,
  completeOnboardingStep,
  getOnboardingSession,
  OnboardingActor,
} from '@/lib/features/onboarding/service';
import { z } from 'zod';

const ALLOWED_UPDATE_ROLES = new Set(['owner', 'admin', 'office']);

async function resolveOnboardingActor(requireWriteAccess: boolean): Promise<OnboardingActor> {
  const session = await auth();
  if (!session?.user?.id || !session.user.tenantId) {
    throw new Error('UNAUTHORIZED');
  }

  const membershipResult = await sql`
    SELECT role
    FROM tenant_members
    WHERE tenant_id = ${session.user.tenantId}
      AND user_id = ${session.user.id}
    LIMIT 1
  `;
  const membershipRows = membershipResult as Array<{ role: string }>;
  const membership = membershipRows[0];
  if (!membership) {
    throw new Error('UNAUTHORIZED');
  }

  if (requireWriteAccess && !ALLOWED_UPDATE_ROLES.has(membership.role)) {
    throw new Error('FORBIDDEN');
  }

  return {
    tenantId: session.user.tenantId,
    userId: session.user.id,
    role: membership.role,
  };
}

function mapActorError(error: unknown): NextResponse | null {
  if (!(error instanceof Error)) return null;
  if (error.message === 'UNAUTHORIZED') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (error.message === 'FORBIDDEN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

export async function GET() {
  try {
    const actor = await resolveOnboardingActor(false);
    const data = await getOnboardingSession(actor.tenantId, actor.userId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const mapped = mapActorError(error);
    if (mapped) return mapped;

    console.error('Onboarding session fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await resolveOnboardingActor(true);
    const body = await request.json();
    const parsed = CompleteOnboardingStepInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }

    const data = await completeOnboardingStep(actor, parsed.data);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const mapped = mapActorError(error);
    if (mapped) return mapped;

    console.error('Onboarding step completion error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
