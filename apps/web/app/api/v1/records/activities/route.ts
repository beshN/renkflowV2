import { redactedJson } from '@/lib/security/field-access.server';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { dueActivities } from '@/lib/features/records/service';
import { runRecordRules } from '@/lib/features/records/rules';
import { NO_STORE, recordError } from '@/lib/features/records/http';

export const dynamic = 'force-dynamic';

/** Activities due today or earlier for this person; the firm's rules run first (each once per record). */
export async function GET() {
  try {
    const actor = await requireWorkOrderActor();
    await runRecordRules(actor.tenantId).catch((e) => console.error('[records:rules]', e instanceof Error ? e.message : e));
    return redactedJson(await dueActivities(actor), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'activities');
  }
}
