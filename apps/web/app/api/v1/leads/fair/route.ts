import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { listFairRequests } from '@/lib/features/fair/requests.server';

export const dynamic = 'force-dynamic';

/** Requests left from the fair configurator, newest first. */
export async function GET() {
  try {
    return redactedJson({ requests: await listFairRequests(await requireWorkOrderActor()) }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'fair-requests');
  }
}
