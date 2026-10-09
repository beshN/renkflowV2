import { redactedJson } from '@/lib/security/field-access.server';
import { NextRequest } from "next/server";
import { ZodError } from "zod";
import {
  requireWorkOrderActor,
  WorkOrderApiError,
} from "@/lib/features/work-orders/security";
import { requireSameOriginJson } from "@/lib/features/manufacturing/http-security";
import { transitionOrder } from "@/lib/features/orders/transitions.service";
import { runRecordRules } from "@/lib/features/records/rules";
import { notifyShortageOnApproval } from "@/lib/features/stock/depth.server";
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireSameOriginJson(req, 16000);
    const actor = await requireWorkOrderActor(),
      { id } = await params;
    const result = await transitionOrder(actor, id, await req.json());
    // The firm's rules (e.g. approved → production activity) follow the change; a rule failure never undoes it.
    await runRecordRules(actor.tenantId, { force: true }).catch((e) => console.error("[records:rules]", e instanceof Error ? e.message : e));
    // An approved order is checked for missing material at once (best effort, never undoes the approval).
    if ((result as any)?.newStatus === "approved" && !(result as any)?.replayed) await notifyShortageOnApproval(actor.tenantId, id, actor.userId);
    return redactedJson({ success: true, ...result });
  } catch (e) {
    if (e instanceof WorkOrderApiError)
      return redactedJson({ error: e.message }, { status: e.status });
    if (e instanceof ZodError || e instanceof SyntaxError)
      return redactedJson(
        { error: "Sipariş, sürüm veya durum bilgisi geçersiz" },
        { status: 400 },
      );
    console.error(
      "[OrderTransition]",
      e instanceof Error ? e.message : "failed",
    );
    return redactedJson(
      { error: "Durum güncellenemedi. Yeniden deneyin." },
      { status: 500 },
    );
  }
}
