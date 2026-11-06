import { reportServerError } from '@/lib/observability/report-server-error';
import { redactedJson } from '@/lib/security/field-access.server';
import { requireWorkOrderActor, WorkOrderApiError } from '@/lib/features/work-orders/security';
import { procurementWorkspace } from '@/lib/features/manufacturing/purchasing.service';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { return redactedJson({ success:true,data:await procurementWorkspace(await requireWorkOrderActor()) },{ headers:{ 'Cache-Control':'no-store' } }); }
  catch (e) { if (!(e instanceof WorkOrderApiError) || e.status === 500) await reportServerError("app/api/v1/procurement/workspace/route:GET", e);
  return redactedJson({ error:e instanceof WorkOrderApiError ? e.message : 'Satın alma verileri alınamadı' },{ status:e instanceof WorkOrderApiError ? e.status : 500 }); }
}
