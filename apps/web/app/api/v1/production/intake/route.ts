import { requireSameOriginJson } from "@/lib/features/manufacturing/http-security";
import { NextRequest, NextResponse } from "next/server";
import {
  requireWorkOrderActor,
  WorkOrderApiError,
} from "@/lib/features/work-orders/security";
import { extractIntake } from "@/lib/features/manufacturing/intake.service";
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 15000000);
    return NextResponse.json({
      data: await extractIntake(
        await requireWorkOrderActor(),
        await req.json(),
      ),
    });
  } catch (e) {
    console.error("[intake]", e instanceof Error ? e.message : "failed");
    return NextResponse.json(
      {
        error:
          e instanceof WorkOrderApiError
            ? e.message
            : "Belge okunamadı. Dosyayı ve AI bağlantısını kontrol edin.",
      },
      { status: e instanceof WorkOrderApiError ? e.status : 400 },
    );
  }
}

export const maxDuration = 300;
