import { NextRequest } from 'next/server';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { consumeRateLimit, rateLimitHeaders } from '@/lib/security/rate-limit';
import { analyzeFoy } from '@/lib/features/foy/service.server';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** An imalat föyü (PDF or photo) → its fields, checks and customer candidates. Nothing is written. */
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 4_400_000);
    const actor = await requireWorkOrderActor();
    const limit = await consumeRateLimit('assistant', actor.tenantId + ':' + actor.userId);
    if (!limit.allowed) return redactedJson({ error: 'Kısa bir ara verip yeniden deneyin.' }, { status: 429, headers: { ...NO_STORE, ...rateLimitHeaders(limit) } });
    return redactedJson(await analyzeFoy(actor, await req.json()), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'foy-analyze');
  }
}
