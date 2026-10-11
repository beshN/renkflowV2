import { redactedJson } from '@/lib/security/field-access.server';
import { requireSameOriginJson } from "@/lib/features/manufacturing/http-security";
import { NextRequest } from "next/server";
import {
  requireWorkOrderActor,
  WorkOrderApiError,
} from "@/lib/features/work-orders/security";
import { extractIntake } from "@/lib/features/manufacturing/intake.service";
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 15000000);
    return redactedJson({
      data: await extractIntake(
        await requireWorkOrderActor(),
        await req.json(),
      ),
    });
  } catch (e) {
    console.error("[intake]", e instanceof Error ? e.message : "failed");
    return redactedJson(
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
