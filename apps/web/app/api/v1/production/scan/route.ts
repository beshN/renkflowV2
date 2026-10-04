import { NextRequest, NextResponse } from "next/server";
import {
  requireWorkOrderActor,
  WorkOrderApiError,
} from "@/lib/features/work-orders/security";
import { resolveLabel } from "@/lib/features/warehouse/service";
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(
      {
        data: await resolveLabel(
          await requireWorkOrderActor(),
          request.nextUrl.searchParams.get("code") || "",
        ),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof WorkOrderApiError
            ? error.message
            : "Etiket okunamadı",
      },
      { status: error instanceof WorkOrderApiError ? error.status : 400 },
    );
  }
}
