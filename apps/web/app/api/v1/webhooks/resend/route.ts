import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { sql } from "@/lib/db";
export async function POST(req: NextRequest) {
  if (!process.env.RESEND_WEBHOOK_SECRET)
    return NextResponse.json(
      { error: "Webhook yapılandırılmamış" },
      { status: 503 },
    );
  const raw = await req.text();
  let event;
  try {
    event = new Resend(process.env.RESEND_API_KEY).webhooks.verify({
      payload: raw,
      webhookSecret: process.env.RESEND_WEBHOOK_SECRET,
      headers: {
        id: req.headers.get("svix-id") || "",
        timestamp: req.headers.get("svix-timestamp") || "",
        signature: req.headers.get("svix-signature") || "",
      },
    });
  } catch {
    return NextResponse.json({ error: "İmza geçersiz" }, { status: 401 });
  }
  if (event.type === "email.received") {
    const tenant = process.env.EMAIL_INBOUND_TENANT_ID,
      address = process.env.EMAIL_INBOUND_ADDRESS;
    if (!tenant || !address || !event.data.to.includes(address))
      return NextResponse.json(
        { error: "Gelen kutusu eşleşmedi" },
        { status: 422 },
      );
    await sql`INSERT INTO inbound_messages(tenant_id,provider,provider_message_id,payload)VALUES(${tenant},'resend',${event.data.email_id},${JSON.stringify(event.data)}::text::jsonb)ON CONFLICT DO NOTHING`;
  } else if (
    ["email.delivered", "email.bounced", "email.failed"].includes(event.type)
  ) {
    const e = event as any;
    await sql`INSERT INTO notification_delivery_events(provider,event_id,provider_message_id,status)VALUES('resend',${req.headers.get("svix-id") || ""},${e.data.email_id},${event.type === "email.delivered" ? "delivered" : "failed"})ON CONFLICT DO NOTHING`;
    await sql`UPDATE notification_outbox SET status=${event.type === "email.delivered" ? "delivered" : "failed"},last_error=${event.type === "email.delivered" ? null : "Sağlayıcı teslimatı başarısız bildirdi"},updated_at=now()WHERE channel='email' AND provider_id=${e.data.email_id} AND status<>'delivered'`;
  }
  return NextResponse.json({ ok: true });
}
