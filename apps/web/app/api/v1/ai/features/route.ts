import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { featureOn, getAiSettings } from '@/lib/ai/gate.server';
import { ASSISTANT_FEATURES } from '@/lib/ai/policy';

export const dynamic = 'force-dynamic';

/** Which assistant extras the firm has on (for any signed-in member; no settings detail). */
export async function GET() {
  try {
    const actor = await requireWorkOrderActor();
    const ai = await getAiSettings(actor.tenantId);
    return redactedJson({ mode: ai.mode, features: Object.fromEntries(ASSISTANT_FEATURES.map((f) => [f, ai.mode !== 'off' && featureOn(ai, f)])) }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'ai-features');
  }
}
