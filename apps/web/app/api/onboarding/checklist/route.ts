import { NextResponse } from 'next/server';
import { AuthenticationError, getServerUserContext } from '@/lib/features/auth/serverAuth';
import { canSeeChecklist } from '@/lib/features/onboarding/checklist';
import { getOnboardingChecklist } from '@/lib/features/onboarding/checklist.server';

/** GET /api/onboarding/checklist: the dashboard "Kurulum" card. Owners and admins only; others get null. */
export async function GET() {
  try {
    const { tenantId, role } = await getServerUserContext();
    if (!canSeeChecklist(role)) return NextResponse.json({ data: null });
    const data = await getOnboardingChecklist(tenantId);
    return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof AuthenticationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Onboarding checklist error:', error);
    return NextResponse.json({ data: null }, { status: 500 });
  }
}
