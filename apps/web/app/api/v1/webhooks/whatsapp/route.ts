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
  // Collect the whole payload first and write it in at most three statements (it used to be two
  // statements per status and one per message). Dedup is unchanged: event and inbound rows keep their
  // unique keys with ON CONFLICT DO NOTHING, so Meta's redeliveries stay harmless.
  const events: Array<{ eventId: string; providerId: string; status: string }> = [];
  const finalStatus = new Map<string, string>();
  const tenant = process.env.WHATSAPP_INBOUND_TENANT_ID;
  const inbound = new Map<string, string>();
  for (const entry of body.entry || [])
    for (const change of entry.changes || []) {
      const v = change.value;
      if (v?.metadata?.phone_number_id !== process.env.WHATSAPP_PHONE_NUMBER_ID)
        continue;
      for (const status of v.statuses || []) {
        if (!["sent", "delivered", "read", "failed"].includes(status.status))
          continue;
        const mapped = ["delivered", "read"].includes(status.status) ? "delivered" : status.status === "failed" ? "failed" : "sent";
        events.push({ eventId: status.id + ":" + status.status + ":" + status.timestamp, providerId: String(status.id), status: mapped });
        // Same result as applying each status in order with the `status<>'delivered'` guard:
        // once delivered nothing later applies, otherwise the last status wins.
        if (finalStatus.get(String(status.id)) !== "delivered") finalStatus.set(String(status.id), mapped);
      }
      if (!tenant) continue;
      for (const message of v.messages || [])
        if (!inbound.has(String(message.id))) inbound.set(String(message.id), JSON.stringify(message));
    }
  if (events.length)
    await sql`INSERT INTO notification_delivery_events(provider,event_id,provider_message_id,status) SELECT 'whatsapp',e.event_id,e.provider_message_id,e.status FROM unnest(${events.map((e) => e.eventId)}::text[],${events.map((e) => e.providerId)}::text[],${events.map((e) => e.status)}::text[]) WITH ORDINALITY AS e(event_id,provider_message_id,status,n) ORDER BY e.n ON CONFLICT DO NOTHING`;
  if (finalStatus.size)
    await sql`/* tenant-checked: provider webhook, WhatsApp message ids are global */ UPDATE notification_outbox o SET status=u.status,last_error=CASE WHEN u.status='failed' THEN 'WhatsApp teslimatı başarısız' END,updated_at=now() FROM unnest(${[...finalStatus.keys()]}::text[],${[...finalStatus.values()]}::text[]) AS u(provider_id,status) WHERE o.channel='whatsapp' AND o.provider_id=u.provider_id AND o.status<>'delivered'`;
  if (tenant && inbound.size)
    await sql`INSERT INTO inbound_messages(tenant_id,provider,provider_message_id,payload) SELECT ${tenant}::uuid,'whatsapp',m.id,m.payload::jsonb FROM unnest(${[...inbound.keys()]}::text[],${[...inbound.values()]}::text[]) WITH ORDINALITY AS m(id,payload,n) ORDER BY m.n ON CONFLICT DO NOTHING`;
  return NextResponse.json({ ok: true });
}
