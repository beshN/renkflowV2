import { NextRequest } from "next/server";
import { z } from "zod";
import { requireWorkOrderActor } from "@/lib/features/work-orders/security";
import { requireSameOriginJson } from "@/lib/features/manufacturing/http-security";
import {
  workshopOverview,
  createWorkshopRequest,
  approveWorkshopRequest,
  checkReceipt,
  approveReceiptInspection,
  readReceivingDocument,
  purchaseWorkshopNeed,
} from "@/lib/features/manufacturing/workshop.server";
import { redactedJson } from "@/lib/security/field-access.server";
import { recordError, NO_STORE } from "@/lib/features/records/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return redactedJson(await workshopOverview(await requireWorkOrderActor()), {
      headers: NO_STORE,
    });
  } catch (e) {
    return recordError(e, "workshop");
  }
}
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 15_000_000);
    const a = await requireWorkOrderActor();
    const d = z
      .discriminatedUnion("action", [
        z.object({ action: z.literal("purchase.create"), data: z.unknown() }),
        z.object({ action: z.literal("request.create"), data: z.unknown() }),
        z.object({
          action: z.literal("request.approve"),
          id: z.uuid(),
          version: z.number().int().positive(),
        }),
        z.object({ action: z.literal("receipt.check"), data: z.unknown() }),
        z.object({
          action: z.literal("receipt.approve"),
          id: z.uuid(),
          version: z.number().int().positive(),
        }),
        z.object({ action: z.literal("document.read"), data: z.unknown() }),
      ])
      .parse(await req.json());
    const result =
      d.action === "purchase.create"
        ? await purchaseWorkshopNeed(a, d.data)
        : d.action === "request.create"
          ? await createWorkshopRequest(a, d.data)
          : d.action === "request.approve"
            ? await approveWorkshopRequest(a, d.id, d.version)
            : d.action === "receipt.check"
              ? await checkReceipt(a, d.data)
              : d.action === "receipt.approve"
                ? await approveReceiptInspection(a, d.id, d.version)
                : await readReceivingDocument(a, d.data);
    return redactedJson(result, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, "workshop");
  }
}
