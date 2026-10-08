import { NextResponse } from "next/server";
import { requireWorkOrderActor, WorkOrderApiError } from "@/lib/features/work-orders/security";
import { wallBoard } from "@/lib/features/manufacturing/platform.service";

export const dynamic = "force-dynamic";

/** Read-only data for the workshop wall screen (no customers, no prices). */
export async function GET() {
  try {
    return NextResponse.json({ data: await wallBoard(await requireWorkOrderActor()) });
  } catch (e) {
    if (e instanceof WorkOrderApiError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[production wall]", e instanceof Error ? e.message : "request failed");
    return NextResponse.json({ error: "Duvar ekranı verisi alınamadı" }, { status: 500 });
  }
}
