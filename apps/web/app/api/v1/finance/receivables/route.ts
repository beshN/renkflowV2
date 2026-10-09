import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { receivables } from '@/lib/features/finance/receivables.server';

export const dynamic = 'force-dynamic';

/** Open balance and aging per customer; also files the overdue reminders (once per invoice). */
export async function GET() {
  try {
    return redactedJson(await receivables(await requireWorkOrderActor()), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'receivables');
  }
}
