import { readJsonBody } from '@/lib/security/request-body.server';
import { redactedJson } from '@/lib/security/field-access.server';
import { requireSameOriginJson } from "@/lib/features/manufacturing/http-security";
import { NextRequest } from "next/server";
import {
  requireWorkOrderActor,
  WorkOrderApiError,
} from "@/lib/features/work-orders/security";
import { extractIntake } from "@/lib/features/manufacturing/intake.service";
import { requireIntakeAccess } from "@/lib/features/manufacturing/intake.service";
import { consumeRateLimit, rateLimitHeaders } from '@/lib/security/rate-limit';
import { NO_STORE } from '@/lib/features/records/http';
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 15000000);
    const actor = await requireWorkOrderActor();
    requireIntakeAccess(actor);
    const limit = await consumeRateLimit('assistant', `${actor.tenantId}:${actor.userId}`);
    if (!limit.allowed) return redactedJson({ error: 'Kısa bir ara verip yeniden deneyin.' }, { status: 429, headers: { ...NO_STORE, ...rateLimitHeaders(limit) } });
    return redactedJson({
      data: await extractIntake(
        actor,
        await readJsonBody(req, 15_000_000),
      ),
    }, { headers: NO_STORE });
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
