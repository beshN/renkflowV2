import { reportServerError } from '@/lib/observability/report-server-error';
import { redactedJson } from '@/lib/security/field-access.server';
import { requireWorkOrderActor, WorkOrderApiError } from '@/lib/features/work-orders/security';
import { stockThresholdWarnings } from '@/lib/features/inventory/thresholds';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

/** Items under their minimum stock, with what is ordered and whether a draft order can be suggested. */
export async function GET() {
  try {
    return redactedJson(await stockThresholdWarnings(await requireWorkOrderActor()), { headers });
  } catch (e) {
    if (e instanceof WorkOrderApiError) return redactedJson({ error: e.message }, { status: e.status, headers });
    console.error('[stock thresholds]', e instanceof Error ? e.message : 'failed');
    await reportServerError("app/api/v1/inventory/thresholds/route:GET", e);
    return redactedJson({ error: 'Stok eşikleri alınamadı.' }, { status: 500, headers });
  }
}
