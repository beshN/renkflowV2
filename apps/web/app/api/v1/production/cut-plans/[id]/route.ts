import { redactedJson } from '@/lib/security/field-access.server';
import { requireWorkOrderActor, WorkOrderApiError } from "@/lib/features/work-orders/security";
import { cutPlanSheet } from "@/lib/features/manufacturing/platform.service";
export const dynamic = "force-dynamic";

/** The saw operator's sheet for one cutting plan (printed from /production/cut-plans/[id]/print). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return redactedJson({ data: await cutPlanSheet(await requireWorkOrderActor(), id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    if (e instanceof WorkOrderApiError) return redactedJson({ error: e.message }, { status: e.status });
    console.error("[cut-plan sheet]", e instanceof Error ? e.message : "request failed");
    return redactedJson({ error: "Kesim planı alınamadı." }, { status: 500 });
  }
}
