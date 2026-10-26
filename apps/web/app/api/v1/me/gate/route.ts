import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { PRIVACY_NOTICE_VERSION, TERMS_VERSION } from '@/lib/features/auth/legal-consent';
import { legalConsentRequired } from '@/lib/features/auth/legal-consent.server';
import { mfaSetupRequiredFor } from '@/lib/features/auth/mfa-policy.server';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';

export const dynamic = 'force-dynamic';

/**
 * What the workspace must ask before it opens: the legal texts not yet accepted, and two-step
 * sign-in the firm requires but this member has not set up. Both read false when the columns
 * (migration 078) are not there yet, so the workspace never blocks on them.
 */
export async function GET() {
  try {
    const actor = await requireWorkOrderActor();
    const [consentRequired, mfaSetupRequired] = await Promise.all([
      legalConsentRequired(sql, actor.userId),
      mfaSetupRequiredFor(sql, { userId: actor.userId, tenantId: actor.tenantId, role: actor.role }),
    ]);
    return NextResponse.json({ consentRequired, mfaSetupRequired, termsVersion: TERMS_VERSION, privacyNoticeVersion: PRIVACY_NOTICE_VERSION }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'me-gate');
  }
}
