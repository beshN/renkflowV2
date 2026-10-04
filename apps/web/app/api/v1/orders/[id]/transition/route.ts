import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  requireWorkOrderActor,
  WorkOrderApiError,
} from "@/lib/features/work-orders/security";
import { requireSameOriginJson } from "@/lib/features/manufacturing/http-security";
import { transitionOrder } from "@/lib/features/orders/transitions.service";
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireSameOriginJson(req, 16000);
    const actor = await requireWorkOrderActor(),
      { id } = await params;
    const result = await transitionOrder(actor, id, await req.json());
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    if (e instanceof WorkOrderApiError)
      return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof ZodError || e instanceof SyntaxError)
      return NextResponse.json(
        { error: "Sipariş, sürüm veya durum bilgisi geçersiz" },
        { status: 400 },
      );
    console.error(
      "[OrderTransition]",
      e instanceof Error ? e.message : "failed",
    );
    return NextResponse.json(
      { error: "Durum güncellenemedi. Yeniden deneyin." },
      { status: 500 },
    );
  }
}
