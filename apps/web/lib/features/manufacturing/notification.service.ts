import "server-only";
import { sql } from "@/lib/db";
import { Resend } from "resend";
import { createElement } from "react";
import { Body, Container, Heading, Html, Text } from "@react-email/components";
const descriptions: Record<string, string> = {
  in_production: "Siparişiniz üretime alındı.",
  ready_for_shipment: "Siparişiniz paketlendi ve sevkiyata hazır.",
  completed: "Siparişiniz teslim edildi.",
  shipped: "Siparişiniz sevk edildi.",
  partially_shipped: "Siparişinizin bir bölümü sevk edildi.",
};
function email(orderNumber: string, customerName: string, status: string) {
  return createElement(
    Html,
    null,
    createElement(
      Body,
      {
        style: {
          fontFamily: "Arial,sans-serif",
          background: "#f5f7fa",
          padding: "32px",
        },
      },
      createElement(
        Container,
        { style: { background: "white", padding: "32px", maxWidth: "560px" } },
        createElement(Heading, { as: "h2" }, "Renk Alüminyum"),
        createElement(Text, null, `${customerName},`),
        createElement(
          Text,
          null,
          `${orderNumber} · ${descriptions[status] || status}`,
        ),
        createElement(
          Text,
          { style: { fontSize: "12px", color: "#64748b" } },
          "RenkFlow sipariş bilgilendirmesi",
        ),
      ),
    ),
  );
}
export async function drainNotifications(limit = 20) {
  await sql`UPDATE notification_outbox SET status=CASE WHEN channel='email' THEN 'pending' ELSE 'uncertain' END,last_error='Sağlayıcı yanıtı alınmadan çalışan durdu; teslimat kontrol edilmeli',next_attempt_at=now() WHERE status='sending' AND leased_at<now()-interval '5 minutes'`;
  const rows = await sql.begin(async (tx: any) => {
    const queued =
      await tx`SELECT * FROM notification_outbox WHERE status='pending' AND next_attempt_at<=now() ORDER BY created_at LIMIT ${limit} FOR UPDATE SKIP LOCKED`;
    if (queued.length)
      await tx`UPDATE notification_outbox SET status='sending',leased_at=now(),attempts=attempts+1 WHERE id=ANY(${queued.map((r: any) => r.id)}::uuid[])`;
    return queued;
  });
  for (const row of rows) {
    let providerId: string | undefined;
    try {
      const [prefs] =
        await sql`SELECT * FROM manufacturing_preferences WHERE tenant_id=${row.tenant_id}`;
      if (!prefs?.[`${row.channel}_enabled`]) {
        await sql`UPDATE notification_outbox SET status='suppressed',updated_at=now()WHERE id=${row.id}`;
        continue;
      }
      if (row.channel === "email") {
        if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
          throw new Error("E-posta sağlayıcı ayarları eksik");
        const r = await new Resend(process.env.RESEND_API_KEY).emails.send(
          {
            from: process.env.EMAIL_FROM,
            to: row.recipient,
            subject: `${row.payload.orderNumber} · Sipariş durumu`,
            react: email(
              row.payload.orderNumber,
              row.payload.customerName,
              row.payload.status,
            ),
          },
          { idempotencyKey: row.id },
        );
        if (r.error) throw new Error("E-posta sağlayıcısı isteği reddetti");
        providerId = r.data?.id;
      } else {
        if (
          !process.env.WHATSAPP_ACCESS_TOKEN ||
          !process.env.WHATSAPP_PHONE_NUMBER_ID ||
          !process.env.WHATSAPP_API_VERSION ||
          !row.payload.template
        )
          throw new Error(
            "WhatsApp sağlayıcı veya onaylı şablon ayarları eksik",
          );
        const phone = row.recipient.replace(/[^\d]/g, "");
        if (phone.length < 10 || phone.length > 15)
          throw new Error("WhatsApp telefon formatı geçersiz");
        const r = await fetch(
          `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: phone,
              type: "template",
              template: {
                name: row.payload.template,
                language: {
                  code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "tr",
                },
                components: [
                  {
                    type: "body",
                    parameters: [
                      { type: "text", text: row.payload.orderNumber },
                      {
                        type: "text",
                        text:
                          descriptions[row.payload.status] ||
                          row.payload.status,
                      },
                    ],
                  },
                ],
              },
            }),
            signal: AbortSignal.timeout(20000),
          },
        );
        if (!r.ok) throw new Error("WhatsApp sağlayıcısı isteği reddetti");
        const body = await r.json();
        providerId = body.messages?.[0]?.id;
        if (!providerId) throw new Error("WhatsApp teslimat kimliği alınamadı");
      }
      const [delivery] =
        await sql`SELECT status FROM notification_delivery_events WHERE provider=${row.channel === "email" ? "resend" : "whatsapp"} AND provider_message_id=${providerId || ""} ORDER BY CASE WHEN status='delivered' THEN 0 WHEN status='failed' THEN 1 ELSE 2 END,received_at DESC LIMIT 1`;
      await sql`UPDATE notification_outbox SET status=CASE WHEN status='delivered' THEN 'delivered' ELSE ${delivery?.status || "sent"} END,provider_id=${providerId || null},last_error=NULL,updated_at=now()WHERE id=${row.id}`;
      await sql`INSERT INTO notification_attempts(notification_id,attempt,status,provider_id)VALUES(${row.id},${row.attempts + 1},'sent',${providerId || null})`;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Bildirim gönderilemedi",
        attempts = row.attempts + 1,
        uncertain =
          row.channel === "whatsapp" &&
          /timeout|fetch|kimliği|abort/i.test(message);
      await sql`INSERT INTO notification_attempts(notification_id,attempt,status,error)VALUES(${row.id},${attempts},${uncertain ? "uncertain" : "failed"},${message.slice(0, 300)})`;
      await sql`UPDATE notification_outbox SET status=${uncertain ? "uncertain" : attempts >= 5 ? "failed" : "pending"},next_attempt_at=${new Date(Date.now() + Math.min(3600000, Math.pow(2, attempts) * 30000))},last_error=${message.slice(0, 300)},updated_at=now()WHERE id=${row.id}`;
    }
  }
  return rows.length;
}
