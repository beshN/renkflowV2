import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { statementCustomers } from '@/lib/features/finance/receivables.server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return redactedJson(await statementCustomers(await requireWorkOrderActor()), { headers: NO_STORE });
  } catch (error) {
    return recordError(error, 'statement-customers');
  }
}
