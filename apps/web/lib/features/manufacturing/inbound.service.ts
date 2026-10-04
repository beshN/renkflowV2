import "server-only";
import { lookup } from "node:dns/promises";
import { sql } from "@/lib/db";
import { Resend } from "resend";
import { getAIService } from "@/lib/ai/service";
import { storeProductionFile } from "./files.service";
async function downloadProviderFile(value: string, token?: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("Geçersiz sağlayıcı dosya adresi");
  const hosts = (process.env.INBOUND_ATTACHMENT_HOSTS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (
    !hosts.includes(url.hostname) &&
    !url.hostname.endsWith(".fbcdn.net") &&
    url.hostname !== "lookaside.fbsbx.com"
  )
    throw new Error(
      "Sağlayıcı ek dosya alan adını INBOUND_ATTACHMENT_HOSTS içinde tanımlayın",
    );
  const addresses = await lookup(url.hostname, { all: true });
  if (
    addresses.some((a) =>
      /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|::1$|fc|fd|fe80)/i.test(
        a.address,
      ),
    )
  )
    throw new Error("Geçersiz sağlayıcı adresi");
  const r = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    redirect: "error",
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error("Gelen ek dosya alınamadı");
  const reader = r.body?.getReader();
  if (!reader) throw new Error("Gelen ek dosya boş");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 10 * 1024 * 1024) {
      await reader.cancel();
      throw new Error("Gelen ek 10 MB sınırını aşıyor");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
export async function drainInbound(limit = 3) {
  await sql`UPDATE inbound_messages SET status='pending'WHERE status='processing' AND processing_at<now()-interval '15 minutes'`;
  const rows = await sql.begin(async (tx: any) => {
    const r =
      await tx`SELECT * FROM inbound_messages WHERE status='pending' AND attempts<5 AND next_attempt_at<=now() ORDER BY created_at LIMIT ${limit} FOR UPDATE SKIP LOCKED`;
    if (r.length)
      await tx`UPDATE inbound_messages SET status='processing',processing_at=now(),attempts=attempts+1 WHERE id=ANY(${r.map((v: any) => v.id)}::uuid[])`;
    return r;
  });
  for (const row of rows)
    try {
      const [member] =
        await sql`SELECT user_id,role FROM tenant_members WHERE tenant_id=${row.tenant_id} AND role IN('owner','admin') ORDER BY created_at LIMIT 1`;
      if (!member) throw new Error("Gelen kutusu yöneticisi yok");
      const actor = {
        tenantId: row.tenant_id,
        userId: member.user_id,
        role: member.role,
      };
      const ai = getAIService();
      let text = "",
        documents: any[] = [],
        extractions: any[] = [];
      if (row.provider === "resend") {
        const resend = new Resend(process.env.RESEND_API_KEY),
          email = await resend.emails.receiving.get(row.provider_message_id);
        if (email.error || !email.data)
          throw new Error("Gelen e-posta okunamadı");
        text = `Konu: ${email.data.subject}\nGönderen: ${email.data.from}\n${email.data.text || ""}`;
        const attachments = await resend.emails.receiving.attachments.list({
          emailId: row.provider_message_id,
        });
        if (attachments.error) throw new Error("E-posta ekleri alınamadı");
        for (const att of attachments.data?.data.slice(0, 5) || []) {
          if (
            ![
              "application/pdf",
              "image/jpeg",
              "image/png",
              "image/webp",
            ].includes(att.content_type)
          )
            continue;
          const bytes = await downloadProviderFile(att.download_url);
          const f = {
            name: att.filename || "Belge",
            mime: att.content_type,
            base64: bytes.toString("base64"),
          };
          documents.push(await storeProductionFile(actor, f));
          extractions.push(
            (await ai.analyzeDocument(f.base64, f.mime)).extractedData,
          );
        }
      } else {
        const message = row.payload;
        text = `Gönderen: ${message.from}\n${message.text?.body || message.image?.caption || message.document?.caption || ""}`;
        const media = message.image || message.document;
        if (media?.id) {
          if (
            !process.env.WHATSAPP_API_VERSION ||
            !process.env.WHATSAPP_ACCESS_TOKEN
          )
            throw new Error("WhatsApp ayarları eksik");
          const r = await fetch(
            `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/${encodeURIComponent(media.id)}`,
            {
              headers: {
                Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
              },
              signal: AbortSignal.timeout(20000),
            },
          );
          if (!r.ok) throw new Error("WhatsApp dosya bilgisi alınamadı");
          const metadata = await r.json();
          const bytes = await downloadProviderFile(
            metadata.url,
            process.env.WHATSAPP_ACCESS_TOKEN,
          );
          const f = {
            name: media.filename || "WhatsApp belgesi",
            mime: metadata.mime_type,
            base64: bytes.toString("base64"),
          };
          documents.push(await storeProductionFile(actor, f));
          extractions.push(
            (await ai.analyzeDocument(f.base64, f.mime)).extractedData,
          );
        }
      }
      const analysis = await ai.analyzeText(text, extractions);
      const draft = await sql.begin(async (tx: any) => {
        const [d] =
          await tx`INSERT INTO intake_drafts(tenant_id,source,source_id,extracted_data,documents,warnings,created_by,source_text)VALUES(${row.tenant_id},${row.provider === "resend" ? "email" : "whatsapp"},${row.provider_message_id},${JSON.stringify(analysis)}::text::jsonb,${JSON.stringify(documents)}::text::jsonb,${JSON.stringify(analysis.warnings)}::text::jsonb,${member.user_id},${text.slice(0, 60000)})ON CONFLICT(tenant_id,source,source_id)DO UPDATE SET source_id=EXCLUDED.source_id RETURNING *`;
        await tx`UPDATE inbound_messages SET status='review',draft_id=${d.id},last_error=NULL WHERE id=${row.id}`;
        await tx`INSERT INTO production_events(tenant_id,event_type,payload,actor_id)VALUES(${row.tenant_id},'intake.received',${JSON.stringify({ draftId: d.id })}::text::jsonb,${member.user_id})`;
        return d;
      });
      void draft;
    } catch (e) {
      await sql`UPDATE inbound_messages SET status=${row.attempts >= 4 ? "failed" : "pending"},next_attempt_at=${new Date(Date.now() + Math.min(3600000, Math.pow(2, row.attempts + 1) * 30000))},last_error=${(e instanceof Error ? e.message : "Gelen içerik işlenemedi").slice(0, 300)} WHERE id=${row.id}`;
    }
  return rows.length;
}
