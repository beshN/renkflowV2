import { requireWorkOrderActor } from "@/lib/features/work-orders/security";
import { paintDispatchCandidates } from "@/lib/features/manufacturing/paint-dispatch.server";
import { redactedJson } from "@/lib/security/field-access.server";
import { NO_STORE, recordError } from "@/lib/features/records/http";
export async function GET(_req: Request) {
  try {
    return redactedJson(
      { data: await paintDispatchCandidates(await requireWorkOrderActor()) },
      { headers: NO_STORE },
    );
  } catch (e) {
    return recordError(e, "paint-dispatch-candidates");
  }
}
