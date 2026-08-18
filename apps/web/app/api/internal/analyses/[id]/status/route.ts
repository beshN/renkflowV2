import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  status: z.enum(["queued", "running", "needs_review", "completed", "failed"]),
  errorCode: z.string().max(160).optional(),
  errorMessage: z.string().max(2000).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!process.env.INTERNAL_WORKFLOW_SECRET || token !== process.env.INTERNAL_WORKFLOW_SECRET) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz durum." }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("document_analyses").update({
    status: parsed.data.status,
    error_code: parsed.data.errorCode,
    error_message: parsed.data.errorMessage,
  }).eq("id", id);

  if (error) return NextResponse.json({ error: "Durum güncellenemedi." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
