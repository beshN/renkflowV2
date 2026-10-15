import { NextRequest } from "next/server";
import { requireWorkOrderActor } from "@/lib/features/work-orders/security";
import { requireSameOriginJson } from "@/lib/features/manufacturing/http-security";
import { loadOrder } from "@/lib/features/orders/loading.server";
import { redactedJson } from "@/lib/security/field-access.server";
import { NO_STORE, recordError } from "@/lib/features/records/http";
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 100000);
    return redactedJson(
      await loadOrder(await requireWorkOrderActor(), await req.json()),
      { headers: NO_STORE },
    );
  } catch (e) {
    return recordError(e, "order-loading");
  }
}
