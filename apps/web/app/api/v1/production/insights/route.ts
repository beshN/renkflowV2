import { redactedJson } from '@/lib/security/field-access.server';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { productionInsights } from '@/lib/features/production/depth.server';

export const dynamic = 'force-dynamic';

/** Scrap, rework and delay reasons (Pareto, 90 days), open delays and each work centre's load for 7 days. */
export async function GET() {
  try {
    return redactedJson(await productionInsights(await requireWorkOrderActor()), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'production-insights');
  }
}
