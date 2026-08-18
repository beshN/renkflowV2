import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const waitlistSchema = z.object({ email: z.email().max(254) });

export async function POST(request: Request) {
  const parsed = waitlistSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Geçerli bir e-posta adresi girin." }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.from("waitlist_subscribers").upsert({
    email: parsed.data.email.trim().toLowerCase(),
    source: "coming-soon",
  }, { onConflict: "email", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: "Talep kaydedilemedi." }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
