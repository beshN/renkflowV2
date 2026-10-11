import { redactedJson } from '@/lib/security/field-access.server';
import { NextRequest } from "next/server";
import {
  requireWorkOrderActor,
  WorkOrderApiError,
} from "@/lib/features/work-orders/security";
import { resolveLabel } from "@/lib/features/warehouse/service";
export async function GET(request: NextRequest) {
  try {
    return redactedJson(
      {
        data: await resolveLabel(
          await requireWorkOrderActor(),
          request.nextUrl.searchParams.get("code") || "",
        ),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return redactedJson(
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
