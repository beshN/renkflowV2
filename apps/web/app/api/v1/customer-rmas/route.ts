import { NextRequest } from "next/server";
import { redactedJson } from "@/lib/security/field-access.server";
import { requireWorkOrderActor } from "@/lib/features/work-orders/security";
import { requireSameOriginJson } from "@/lib/features/manufacturing/http-security";
import { NO_STORE, recordError } from "@/lib/features/records/http";
import {
  createCustomerRma,
  customerRmas,
} from "@/lib/features/manufacturing/customer-rma.service";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return redactedJson(await customerRmas(await requireWorkOrderActor()), {
      headers: NO_STORE,
    });
  } catch (e) {
    return recordError(e, "customer-rmas");
  }
}
export async function POST(request: NextRequest) {
  try {
    requireSameOriginJson(request, 10000);
    return redactedJson(
      await createCustomerRma(
        await requireWorkOrderActor(),
        await request.json(),
      ),
      { status: 201, headers: NO_STORE },
    );
  } catch (e) {
    return recordError(e, "customer-rmas");
  }
}
