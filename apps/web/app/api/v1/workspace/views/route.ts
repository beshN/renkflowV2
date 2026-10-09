import { redactedJson } from '@/lib/security/field-access.server';
import { NextRequest } from "next/server";
import { ZodError } from "zod";
import {
  requireWorkOrderActor,
  WorkOrderApiError,
} from "@/lib/features/work-orders/security";
import { requireSameOriginJson } from "@/lib/features/manufacturing/http-security";
import {
  listSavedViews,
  savedViewCommand,
} from "@/lib/features/orders/saved-views.service";
export const dynamic = "force-dynamic";
function failure(e: unknown) {
  if (e instanceof WorkOrderApiError)
    return redactedJson({ error: e.message }, { status: e.status });
  if (e instanceof ZodError || e instanceof SyntaxError)
    return redactedJson(
      { error: "Görünüm bilgileri geçersiz" },
      { status: 400 },
    );
  console.error("[workspace-views]", e instanceof Error ? e.message : "failed");
  return redactedJson(
    { error: "Görünüm işlemi tamamlanamadı. Tekrar deneyin." },
    { status: 500 },
  );
}
export async function GET() {
  try {
    return redactedJson(
      { data: await listSavedViews(await requireWorkOrderActor()) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 16000);
    const body = await req.text();
    if (Buffer.byteLength(body) > 16000)
      throw new WorkOrderApiError("İstek çok büyük", 413);
    return redactedJson({
      data: await savedViewCommand(
        await requireWorkOrderActor(),
        JSON.parse(body),
      ),
    });
  } catch (e) {
    return failure(e);
  }
}
