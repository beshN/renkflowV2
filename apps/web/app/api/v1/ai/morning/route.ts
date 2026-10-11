import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { morningFor } from '@/lib/ai/insight/morning.server';

export const dynamic = 'force-dynamic';

/** The reader's morning summary for their role. Read only. */
export async function GET() {
  try {
    return redactedJson(await morningFor(await requireWorkOrderActor()), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'ai-morning');
  }
}
