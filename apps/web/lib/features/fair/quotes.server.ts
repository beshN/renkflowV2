import 'server-only';

import { createHash } from 'node:crypto';
import { z } from 'zod';
import { sql, withTransaction } from '@/lib/db';
import { recordAudit } from '@/lib/audit/audit-log';
import { requireCap } from '@/lib/features/field/common.server';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { configuratorBaseUrl } from './config';
import { itemSpecs, itemSummary, type DesignItem } from './design';
import { QuoteInput } from './quote-input';
import { requireFairTenant } from './designs.server';
import { sendQuoteConfirmation } from './email.server';
import { fairIdByCode, firmName, requireConfiguratorFirm } from './fairs.server';
import { PRIVACY_VERSION, type Locale } from './i18n';
import { openLeadForQuote } from './renkflow-lead.server';

export const QUOTE_STATUSES = ['new', 'reviewing', 'quoted', 'sent', 'accepted', 'rejected'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const designUrl = (token: string) => `${configuratorBaseUrl()}/c/${token}`;

/** TT-2026-000001: per firm and year. */
async function nextQuoteNumber(tx: any, tenantId: string) {
  await tx`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId + ':fair_quotes'}, 0))`;
  const year = new Date().getFullYear();
  const prefix = `TT-${year}-`;
  const [row] = await tx`SELECT count(*)::int AS n FROM fair_quotes WHERE tenant_id = ${tenantId} AND number LIKE ${prefix + '%'}`;
  for (let n = Number(row?.n ?? 0) + 1; ; n++) {
    const candidate = `${prefix}${String(n).padStart(6, '0')}`;
    const [taken] = await tx`SELECT 1 FROM fair_quotes WHERE tenant_id = ${tenantId} AND number = ${candidate}`;
    if (!taken) return candidate;
  }
}

/**
 * A quote request: stores the design as it is now (the link keeps showing the latest version),
 * snapshots it on the request, opens the RenkFlow lead, then e-mails the customer. The e-mail
 * result is recorded and returned as it is; a failed e-mail never undoes the request.
 */
export async function submitQuote(raw: unknown, meta: { ip: string; agent: string }) {
  const tenantId = requireFairTenant();
  const d = QuoteInput.parse(raw);
  const ipHash = meta.ip && meta.ip !== 'unknown' ? createHash('sha256').update(`${tenantId}:${meta.ip}`).digest('hex').slice(0, 32) : null;
  const items = JSON.stringify(d.items);
  const saved = await withTransaction(async (tx: any) => {
    const codeFairId = await fairIdByCode(tx, tenantId, d.fairCode);
    await tx`
      INSERT INTO fair_designs (tenant_id, token, fair_id, origin, locale, items)
      VALUES (${tenantId}, ${d.token}, ${codeFairId}, 'mobile', ${d.locale}, ${items}::text::jsonb)
      ON CONFLICT (token) DO NOTHING`;
    const [design] = await tx`
      UPDATE fair_designs SET items = ${items}::text::jsonb, locale = ${d.locale}, version = version + 1, updated_at = now()
      WHERE tenant_id = ${tenantId} AND token = ${d.token} RETURNING id, fair_id`;
    if (!design) throw new WorkOrderApiError('Bu bağlantı kullanılamıyor', 409);
    const fairId = design.fair_id ? String(design.fair_id) : codeFairId;
    const number = await nextQuoteNumber(tx, tenantId);
    const [quote] = await tx`
      INSERT INTO fair_quotes (tenant_id, number, design_id, fair_id, items, contact_name, email, phone, company_name, location, note, locale,
        privacy_notice_version, privacy_notice_ack_at, marketing_consent, ip_hash, user_agent)
      VALUES (${tenantId}, ${number}, ${design.id}, ${fairId}, ${items}::text::jsonb, ${d.contactName}, ${d.email}, ${d.phone || null}, ${d.companyName || null},
        ${d.location || null}, ${d.note || null}, ${d.locale}, ${PRIVACY_VERSION}, now(), ${d.marketingConsent}, ${ipHash}, ${meta.agent.slice(0, 300) || null})
      RETURNING id`;
    const leadId = await openLeadForQuote(tx, {
      tenantId, quoteId: quote.id, number, fair: Boolean(fairId), items: d.items, contactName: d.contactName,
      companyName: d.companyName || null, phone: d.phone || null, email: d.email, location: d.location || null,
    });
    await tx`UPDATE fair_quotes SET lead_id = ${leadId} WHERE tenant_id = ${tenantId} AND id = ${quote.id}`;
    await recordAudit(tx, { tenantId, actorId: null, entityType: 'fair_quote', entityId: quote.id, action: 'created', metadata: { number, items: d.items.length, fair: Boolean(fairId) } });
    return { id: String(quote.id), number: number as string };
  });
  const email = await sendQuoteConfirmation({
    to: d.email, locale: d.locale, firm: await firmName(), number: saved.number, contactName: d.contactName, items: d.items, designUrl: designUrl(d.token),
  }).catch((e) => ({ status: 'failed' as const, error: e instanceof Error ? e.message.slice(0, 300) : 'send failed' }));
  await sql`UPDATE fair_quotes SET email_status = ${email.status}, email_error = ${email.error ?? null}, updated_at = now() WHERE tenant_id = ${tenantId} AND id = ${saved.id}`;
  return { number: saved.number, emailStatus: email.status };
}

// Sales screens -----------------------------------------------------------------------------------

type Row = Record<string, any>;
function quoteDto(r: Row, withImages: boolean) {
  const items = (Array.isArray(r.items) ? r.items : []) as DesignItem[];
  return {
    id: String(r.id), number: r.number as string, status: r.status as QuoteStatus, createdAt: r.created_at, statusChangedAt: r.status_changed_at,
    contactName: r.contact_name as string, email: r.email as string, phone: r.phone ?? null, companyName: r.company_name ?? null, location: r.location ?? null,
    note: r.note ?? null, locale: r.locale as Locale, marketingConsent: Boolean(r.marketing_consent), emailStatus: r.email_status as string, emailError: r.email_error ?? null,
    fair: r.fair_code ? { code: r.fair_code as string, name: r.fair_name as string } : null,
    leadId: r.lead_id ? String(r.lead_id) : null, leadNumber: r.lead_number ?? null,
    designUrl: r.token ? designUrl(r.token) : null,
    items: items.map((i) => ({
      ...i, image: withImages ? i.image : undefined, hasImage: Boolean(i.image), summary: itemSummary('tr', i), specs: itemSpecs('tr', i),
    })),
  };
}
const QUOTE_FROM = `fair_quotes q
  LEFT JOIN fairs f ON f.id = q.fair_id AND f.tenant_id = q.tenant_id
  LEFT JOIN leads l ON l.id = q.lead_id AND l.tenant_id = q.tenant_id
  LEFT JOIN fair_designs d ON d.id = q.design_id AND d.tenant_id = q.tenant_id`;

export async function listQuotes(actor: WorkOrderActor, filter: { status?: string | null; fair?: string | null }) {
  requireConfiguratorFirm(actor);
  await requireCap(actor, 'crm', 'view', 'Teklif taleplerini görme');
  const status = filter.status && (QUOTE_STATUSES as readonly string[]).includes(filter.status) ? filter.status : null;
  const fair = filter.fair && /^[a-z0-9-]{1,40}$/.test(filter.fair) ? filter.fair : null;
  const rows = await sql.unsafe(
    `SELECT q.id, q.number, q.status, q.created_at, q.status_changed_at, q.contact_name, q.email, q.phone, q.company_name, q.location, q.note, q.locale,
       q.marketing_consent, q.email_status, q.email_error, q.lead_id, (SELECT jsonb_agg(i - 'image') FROM jsonb_array_elements(q.items) i) AS items,
       f.code AS fair_code, f.name AS fair_name, l.lead_number, d.token
     FROM ${QUOTE_FROM}
     WHERE q.tenant_id = $1 AND ($2::text IS NULL OR q.status = $2) AND ($3::text IS NULL OR f.code = $3 OR ($3 = 'web' AND q.fair_id IS NULL))
     ORDER BY q.created_at DESC LIMIT 500`,
    [actor.tenantId, status, fair],
  );
  return rows.map((r: Row) => quoteDto(r, false));
}

export async function getQuote(actor: WorkOrderActor, id: string) {
  requireConfiguratorFirm(actor);
  await requireCap(actor, 'crm', 'view', 'Teklif taleplerini görme');
  const [row] = await sql.unsafe(
    `SELECT q.*, f.code AS fair_code, f.name AS fair_name, l.lead_number, d.token FROM ${QUOTE_FROM} WHERE q.tenant_id = $1 AND q.id = $2`,
    [actor.tenantId, id],
  );
  if (!row) throw new WorkOrderApiError('Teklif talebi bulunamadı', 404);
  return quoteDto(row, true);
}

export async function setQuoteStatus(actor: WorkOrderActor, id: string, raw: unknown) {
  requireConfiguratorFirm(actor);
  await requireCap(actor, 'crm', 'edit', 'Teklif talebi durumunu değiştirme');
  const { status } = z.object({ status: z.enum(QUOTE_STATUSES) }).strict().parse(raw);
  await withTransaction(async (tx: any) => {
    const [before] = await tx`SELECT status FROM fair_quotes WHERE tenant_id = ${actor.tenantId} AND id = ${id} FOR UPDATE`;
    if (!before) throw new WorkOrderApiError('Teklif talebi bulunamadı', 404);
    if (before.status === status) return;
    await tx`UPDATE fair_quotes SET status = ${status}, status_changed_at = now(), updated_at = now() WHERE tenant_id = ${actor.tenantId} AND id = ${id}`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'fair_quote', entityId: id, action: 'status_changed', changes: { status: { from: before.status, to: status } } });
  });
}
