import { NextRequest } from 'next/server';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { consumeRateLimit, rateLimitHeaders } from '@/lib/security/rate-limit';
import { runCommand } from '@/lib/ai/commands/run.server';

export const dynamic = 'force-dynamic';

/** A typed or spoken command → a result card or an approval-gated preview. Never applies anything itself. */
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 5_000);
    const actor = await requireWorkOrderActor();
    const limit = await consumeRateLimit('assistant', actor.tenantId + ':' + actor.userId);
    if (!limit.allowed) return redactedJson({ error: 'Kısa bir ara verip yeniden deneyin.' }, { status: 429, headers: { ...NO_STORE, ...rateLimitHeaders(limit) } });
    return redactedJson(await runCommand(actor, await req.json()), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'ai-commands');
  }
}
