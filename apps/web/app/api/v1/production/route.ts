import { requireSameOriginJson } from "@/lib/features/manufacturing/http-security";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  requireWorkOrderActor,
  WorkOrderApiError,
} from "@/lib/features/work-orders/security";
import {
  productionOverview,
  productionCommand,
} from "@/lib/features/manufacturing/platform.service";
export const dynamic = "force-dynamic";
function error(e: unknown) {
  if (e instanceof ZodError)
    return NextResponse.json(
      { error: e.issues.map((i) => i.message).join(", ") },
      { status: 400 },
    );
  if (e instanceof WorkOrderApiError)
    return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(
    "[production]",
    e instanceof Error ? e.message : "request failed",
  );
  return NextResponse.json(
    {
      error:
        "İşlem tamamlanamadı. Stok, reçete ve kayıt bilgilerini kontrol edin.",
    },
    { status: 409 },
  );
}
export async function GET() {
  try {
    return NextResponse.json({
      data: await productionOverview(await requireWorkOrderActor()),
    });
  } catch (e) {
    return error(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 2000000);
    if (Number(req.headers.get("content-length")) > 2_000_000)
      return NextResponse.json({ error: "İstek çok büyük" }, { status: 413 });
    return NextResponse.json({
      data: await productionCommand(
        await requireWorkOrderActor(),
        await req.json(),
      ),
    });
  } catch (e) {
    return error(e);
  }
}
