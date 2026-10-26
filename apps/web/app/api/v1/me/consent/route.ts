import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { hasLegalConsent, LEGAL_CONSENT_REQUIRED_MESSAGE, PRIVACY_NOTICE_VERSION, TERMS_VERSION } from '@/lib/features/auth/legal-consent';
import { recordLegalConsent } from '@/lib/features/auth/legal-consent.server';
import { requireSameOrigin } from '@/lib/features/manufacturing/http-security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { getClientIp } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

/** Records that you accepted the current Kullanım Koşulları and read the Aydınlatma Metni. */
export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);
    const actor = await requireWorkOrderActor();
    if (!hasLegalConsent(await req.json())) {
      return NextResponse.json({ error: LEGAL_CONSENT_REQUIRED_MESSAGE, code: 'consent_required' }, { status: 400, headers: NO_STORE });
    }
    const recorded = await recordLegalConsent(sql, { userId: actor.userId, ip: getClientIp(req.headers) });
    return NextResponse.json({ recorded, termsVersion: TERMS_VERSION, privacyNoticeVersion: PRIVACY_NOTICE_VERSION }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'me-consent');
  }
}
