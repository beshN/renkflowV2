import { redactedJson } from '@/lib/security/field-access.server';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { reorderOverview } from '@/lib/features/stock/depth.server';

export const dynamic = 'force-dynamic';

/** Items with a minimum: available stock, reorder point and level, and what the policy would buy. */
export async function GET() {
  try {
    return redactedJson(await reorderOverview(await requireWorkOrderActor()), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'stock-reorder');
  }
}
