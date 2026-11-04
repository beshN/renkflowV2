import { reportServerError } from '@/lib/observability/report-server-error';
import { redactedJson } from '@/lib/security/field-access.server';
import { requireWorkOrderActor, WorkOrderApiError } from "@/lib/features/work-orders/security";
import { wallBoard } from "@/lib/features/manufacturing/platform.service";

export const dynamic = "force-dynamic";

/** Read-only data for the workshop wall screen (no customers, no prices). */
export async function GET() {
  try {
    return redactedJson({ data: await wallBoard(await requireWorkOrderActor()) });
  } catch (e) {
    if (e instanceof WorkOrderApiError) return redactedJson({ error: e.message }, { status: e.status });
    console.error("[production wall]", e instanceof Error ? e.message : "request failed");
    await reportServerError("app/api/v1/production/wall/route:GET", e);
    return redactedJson({ error: "Duvar ekranı verisi alınamadı" }, { status: 500 });
  }
}
