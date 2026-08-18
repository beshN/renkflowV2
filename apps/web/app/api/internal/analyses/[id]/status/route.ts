import { NextResponse } from "next/server";
import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  status: z.enum(["queued", "running", "needs_review", "completed", "failed"]),
  errorCode: z.string().max(160).optional(),
  errorMessage: z.string().max(2000).optional(),
});

function validSecret(value: string | undefined, expected: string | undefined) {
  if (!value || !expected) return false;
  const valueBytes = Buffer.from(value);
  const expectedBytes = Buffer.from(expected);
  return valueBytes.length === expectedBytes.length && timingSafeEqual(valueBytes, expectedBytes);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!validSecret(token, process.env.INTERNAL_WORKFLOW_SECRET)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz durum." }, { status: 400 });

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await admin.from("document_analyses").update({
    status: parsed.data.status,
    error_code: parsed.data.status === "failed" ? parsed.data.errorCode ?? "WORKFLOW_FAILED" : null,
    error_message: parsed.data.status === "failed" ? parsed.data.errorMessage ?? "Workflow tamamlanamadı." : null,
    ...(parsed.data.status === "running" ? { started_at: now, completed_at: null } : {}),
    ...(["needs_review", "completed", "failed"].includes(parsed.data.status) ? { completed_at: now } : {}),
    ...(parsed.data.status === "queued" ? { started_at: null, completed_at: null } : {}),
  }).eq("id", id).select("id").maybeSingle();

  if (error) return NextResponse.json({ error: "Durum güncellenemedi." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Analiz bulunamadı." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
