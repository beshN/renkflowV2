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
    // Voice: the browser's speech service (e.g. Chrome → Google) receives the audio, a transfer abroad:
    // only with the firm's KVKK confirmation in assistant mode.
    const on = (f: string) => ai.mode !== 'off' && featureOn(ai, f) && (f !== 'voice' || (ai.mode === 'assist' && Boolean(ai.kvkkAckAt)));
    return redactedJson({ mode: ai.mode, features: Object.fromEntries(ASSISTANT_FEATURES.map((f) => [f, on(f)])) }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'ai-features');
  }
}
