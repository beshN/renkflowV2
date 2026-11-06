import { requireWorkOrderActor } from "@/lib/features/work-orders/security";
import { paintDispatchDetail } from "@/lib/features/manufacturing/paint-dispatch.server";
import { redactedJson } from "@/lib/security/field-access.server";
import { NO_STORE, recordError } from "@/lib/features/records/http";
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    return redactedJson(
      {
        data: await paintDispatchDetail(
          await requireWorkOrderActor(),
          (await ctx.params).id,
        ),
      },
      { headers: NO_STORE },
    );
  } catch (e) {
    return recordError(e, "paint-dispatch-[id]");
  }
}
