import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  requireWorkOrderActor,
  WorkOrderApiError,
} from "@/lib/features/work-orders/security";
import { requireSameOriginJson } from "@/lib/features/manufacturing/http-security";
import { productionCommand } from "@/lib/features/manufacturing/platform.service";
import {
  warehouseOverview,
  resolveLabel,
} from "@/lib/features/warehouse/service";
export const dynamic = "force-dynamic";
function error(e: unknown) {
  const status =
    e instanceof WorkOrderApiError
      ? e.status
      : e instanceof ZodError || e instanceof SyntaxError
        ? 400
        : 500;
  return NextResponse.json(
    {
      error:
        e instanceof WorkOrderApiError
          ? e.message
          : e instanceof ZodError
            ? e.issues.map((i) => i.message).join(", ")
            : status === 400
              ? "İstek veya etiket biçimini kontrol edin"
              : "Depo işlemi tamamlanamadı. Kaydı yenileyip tekrar deneyin.",
    },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
export async function GET(r: NextRequest) {
  try {
    const a = await requireWorkOrderActor();
    const code = r.nextUrl.searchParams.get("code");
    return NextResponse.json(
      {
        data:
          code !== null
            ? await resolveLabel(a, code)
            : await warehouseOverview(a),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return error(e);
  }
}
export async function POST(r: NextRequest) {
  try {
    requireSameOriginJson(r, 50000);
    const a = await requireWorkOrderActor();
    const body = await r.json();
    if (
      typeof body.action !== "string" ||
      !body.action.startsWith("warehouse.")
    )
      throw new WorkOrderApiError("Depo komutu gerekli", 400);
    return NextResponse.json(
      { data: await productionCommand(a, body) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return error(e);
  }
}
