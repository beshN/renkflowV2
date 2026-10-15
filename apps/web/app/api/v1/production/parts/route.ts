import { NextRequest } from "next/server";
import { requireSameOriginJson } from "@/lib/features/manufacturing/http-security";
import { requireWorkOrderActor } from "@/lib/features/work-orders/security";
import { recordPartProgress } from "@/lib/features/manufacturing/parts.server";
import { redactedJson } from "@/lib/security/field-access.server";
import { NO_STORE, recordError } from "@/lib/features/records/http";
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 100000);
    return redactedJson(
      await recordPartProgress(await requireWorkOrderActor(), await req.json()),
      { headers: NO_STORE },
    );
  } catch (e) {
    return recordError(e, "production-parts");
  }
}
