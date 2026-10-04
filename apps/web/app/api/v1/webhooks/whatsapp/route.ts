import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { sql } from "@/lib/db";
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  if (
    q.get("hub.mode") === "subscribe" &&
    process.env.WHATSAPP_VERIFY_TOKEN &&
    q.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN
  )
    return new Response(q.get("hub.challenge"));
  return new Response("Forbidden", { status: 403 });
}
export async function POST(req: NextRequest) {
  if (!process.env.WHATSAPP_APP_SECRET)
    return new Response("Unavailable", { status: 503 });
  const raw = await req.text(),
    actual = Buffer.from(req.headers.get("x-hub-signature-256") || ""),
    expected = Buffer.from(
      "sha256=" +
        createHmac("sha256", process.env.WHATSAPP_APP_SECRET)
          .update(raw)
          .digest("hex"),
    );
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return new Response("Forbidden", { status: 401 });
  const body = JSON.parse(raw);
  if (body.object !== "whatsapp_business_account")
    return new Response("Invalid event", { status: 400 });
  for (const entry of body.entry || [])
    for (const change of entry.changes || []) {
      const v = change.value;
      if (v?.metadata?.phone_number_id !== process.env.WHATSAPP_PHONE_NUMBER_ID)
        continue;
      for (const status of v.statuses || []) {
        if (!["sent", "delivered", "read", "failed"].includes(status.status))
          continue;
        await sql`INSERT INTO notification_delivery_events(provider,event_id,provider_message_id,status)VALUES('whatsapp',${status.id + ":" + status.status + ":" + status.timestamp},${status.id},${["delivered", "read"].includes(status.status) ? "delivered" : status.status === "failed" ? "failed" : "sent"})ON CONFLICT DO NOTHING`;
        await sql`UPDATE notification_outbox SET status=${["delivered", "read"].includes(status.status) ? "delivered" : status.status === "failed" ? "failed" : "sent"},last_error=${status.status === "failed" ? "WhatsApp teslimatı başarısız" : null},updated_at=now()WHERE channel='whatsapp' AND provider_id=${status.id} AND status<>'delivered'`;
      }
      const tenant = process.env.WHATSAPP_INBOUND_TENANT_ID;
      if (!tenant) continue;
      for (const message of v.messages || [])
        await sql`INSERT INTO inbound_messages(tenant_id,provider,provider_message_id,payload)VALUES(${tenant},'whatsapp',${message.id},${JSON.stringify(message)}::text::jsonb)ON CONFLICT DO NOTHING`;
    }
  return NextResponse.json({ ok: true });
}
