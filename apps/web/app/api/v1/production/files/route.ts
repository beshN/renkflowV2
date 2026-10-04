import { requireSameOriginJson } from "@/lib/features/manufacturing/http-security";
import { NextRequest, NextResponse } from "next/server";
import {
  requireWorkOrderActor,
  WorkOrderApiError,
} from "@/lib/features/work-orders/security";
import { storeProductionFile } from "@/lib/features/manufacturing/files.service";
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 15000000);
    return NextResponse.json({
      data: await storeProductionFile(
        await requireWorkOrderActor(),
        await req.json(),
      ),
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof WorkOrderApiError ? e.message : "Dosya yüklenemedi",
      },
      { status: e instanceof WorkOrderApiError ? e.status : 400 },
    );
  }
}
