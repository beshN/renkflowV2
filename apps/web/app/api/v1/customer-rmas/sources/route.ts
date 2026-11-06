import { NextRequest } from "next/server";
import { z } from "zod";
import { requireWorkOrderActor } from "@/lib/features/work-orders/security";
import { customerRmaSources } from "@/lib/features/manufacturing/customer-rma.service";
import { redactedJson } from "@/lib/security/field-access.server";
import { NO_STORE, recordError } from "@/lib/features/records/http";
export async function GET(req: NextRequest) {
  try {
    return redactedJson(
      await customerRmaSources(
        await requireWorkOrderActor(),
        z.string().uuid().parse(req.nextUrl.searchParams.get("orderId")),
      ),
      { headers: NO_STORE },
    );
  } catch (e) {
    return recordError(e, "customer-rma");
  }
}
