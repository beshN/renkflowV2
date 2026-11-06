import { NextRequest } from "next/server";
import { redactedJson } from "@/lib/security/field-access.server";
import { requireWorkOrderActor } from "@/lib/features/work-orders/security";
import { requireSameOriginJson } from "@/lib/features/manufacturing/http-security";
import { NO_STORE, recordError } from "@/lib/features/records/http";
import {
  supplierReturns,
  transitionSupplierReturn,
} from "@/lib/features/manufacturing/supplier-return.service";
import { z } from "zod";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };
export async function GET(_request: NextRequest, context: Context) {
  try {
    const id = z
      .string()
      .uuid()
      .parse((await context.params).id);
    return redactedJson(
      (await supplierReturns(await requireWorkOrderActor(), id))[0],
      { headers: NO_STORE },
    );
  } catch (e) {
    return recordError(e, "supplier-return");
  }
}
export async function POST(request: NextRequest, context: Context) {
  try {
    requireSameOriginJson(request, 10000);
    const id = z
      .string()
      .uuid()
      .parse((await context.params).id);
    return redactedJson(
      await transitionSupplierReturn(
        await requireWorkOrderActor(),
        id,
        await request.json(),
      ),
      { headers: NO_STORE },
    );
  } catch (e) {
    return recordError(e, "supplier-return");
  }
}
