import { NextRequest } from "next/server";
import { redactedJson } from "@/lib/security/field-access.server";
import { requireWorkOrderActor } from "@/lib/features/work-orders/security";
import { requireSameOriginJson } from "@/lib/features/manufacturing/http-security";
import { NO_STORE, recordError } from "@/lib/features/records/http";
import {
  createSupplierReturn,
  supplierReturns,
} from "@/lib/features/manufacturing/supplier-return.service";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return redactedJson(await supplierReturns(await requireWorkOrderActor()), {
      headers: NO_STORE,
    });
  } catch (e) {
    return recordError(e, "supplier-returns");
  }
}
export async function POST(request: NextRequest) {
  try {
    requireSameOriginJson(request, 10000);
    return redactedJson(
      await createSupplierReturn(
        await requireWorkOrderActor(),
        await request.json(),
      ),
      { status: 201, headers: NO_STORE },
    );
  } catch (e) {
    return recordError(e, "supplier-returns");
  }
}
