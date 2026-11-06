import { NextRequest } from "next/server";
import { redactedJson } from "@/lib/security/field-access.server";
import { requireWorkOrderActor } from "@/lib/features/work-orders/security";
import { requireSameOriginJson } from "@/lib/features/manufacturing/http-security";
import { NO_STORE, recordError } from "@/lib/features/records/http";
import {
  customerRmas,
  decideCustomerRma,
  approveCustomerRmaReplacement,
} from "@/lib/features/manufacturing/customer-rma.service";
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
      (await customerRmas(await requireWorkOrderActor(), id))[0],
      { headers: NO_STORE },
    );
  } catch (e) {
    return recordError(e, "customer-rma");
  }
}
export async function POST(request: NextRequest, context: Context) {
  try {
    requireSameOriginJson(request, 10000);
    const id = z
      .string()
      .uuid()
      .parse((await context.params).id);
    const body = await request.json();
    if (body?.action === "approveReplacement")
      return redactedJson(
        await approveCustomerRmaReplacement(await requireWorkOrderActor(), id),
        { headers: NO_STORE },
      );
    return redactedJson(
      await decideCustomerRma(await requireWorkOrderActor(), id, body),
      { headers: NO_STORE },
    );
  } catch (e) {
    return recordError(e, "customer-rma");
  }
}
