import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { sql, withTransaction } from '@/lib/db';
import { tableExists } from '@/lib/db/schema-guard';
import { recordAudit } from '@/lib/audit/audit-log';
import { createNotification } from '@/lib/notifications/service';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { consumeRateLimit } from '@/lib/security/rate-limit';
import {
  addDays, customerDiscountFor, diffQuotes, effectiveDiscountPercent, needsDiscountApproval, tryEquivalent,
  type QuoteSnapshot,
} from './engine';
import { istanbulToday } from './order-status.server';
import { ProductVisualizationSchema } from '@/lib/features/product-3d/catalog';
import { stableJson } from '@/lib/features/products/configuration';
const publicVisualization=(value:unknown)=>{const parsed=ProductVisualizationSchema.safeParse(value);return parsed.success?parsed.data:null;};

const OFFICE = ['owner', 'admin', 'office'];
const MANAGERS = ['owner', 'admin'];
const READERS = ['owner', 'admin', 'office', 'accountant'];

/** Tur B tables (migration 041). Before it runs, quotes work as before and these features answer 409. */
export const salesAvailable = () => tableExists('quotation_revisions');
async function requireSales() {
  if (!(await salesAvailable())) throw new WorkOrderApiError('Teklif/sipariş derinliği bu kurulumda henüz etkin değil (veritabanı güncellemesi bekleniyor)', 409);
}
const need = (actor: WorkOrderActor, roles: string[], what: string) => {
  if (!roles.includes(actor.role)) throw new WorkOrderApiError(`${what} yetkiniz yok`, 403);
};
const iso = (d: unknown) => (d ? new Date(d as string).toISOString().slice(0, 10) : null);

// Settings ----------------------------------------------------------------------------------------

export type QuoteSettings = { discountApprovalPercent: number; defaultValidDays: number; defaultVatPercent: number };
const DEFAULTS: QuoteSettings = { discountApprovalPercent: 10, defaultValidDays: 15, defaultVatPercent: 20 };

export async function getQuoteSettings(tenantId: string): Promise<QuoteSettings> {
  if (!(await salesAvailable())) return DEFAULTS;
  const [r] = await sql`SELECT * FROM quote_settings WHERE tenant_id = ${tenantId}`;
  return r ? { discountApprovalPercent: Number(r.discount_approval_percent), defaultValidDays: Number(r.default_valid_days), defaultVatPercent: Number(r.default_vat_percent) } : DEFAULTS;
}

const SettingsSchema = z.object({
  discountApprovalPercent: z.coerce.number().min(0).max(100),
  defaultValidDays: z.coerce.number().int().min(1).max(365),
  defaultVatPercent: z.coerce.number().refine((v) => [0, 1, 10, 20].includes(v), 'KDV oranı 20, 10, 1 ya da 0'),
}).strict();

export async function saveQuoteSettings(actor: WorkOrderActor, raw: unknown) {
  need(actor, MANAGERS, 'Teklif ayarlarını değiştirme');
  await requireSales();
  const s = SettingsSchema.parse(raw);
  const before = await getQuoteSettings(actor.tenantId);
  await withTransaction(async (tx: any) => {
    await tx`INSERT INTO quote_settings (tenant_id, discount_approval_percent, default_valid_days, default_vat_percent, updated_by, updated_at)
      VALUES (${actor.tenantId}, ${s.discountApprovalPercent}, ${s.defaultValidDays}, ${s.defaultVatPercent}, ${actor.userId}, now())
      ON CONFLICT (tenant_id) DO UPDATE SET discount_approval_percent = EXCLUDED.discount_approval_percent, default_valid_days = EXCLUDED.default_valid_days,
        default_vat_percent = EXCLUDED.default_vat_percent, updated_by = EXCLUDED.updated_by, updated_at = now()`;
    const changes = Object.fromEntries((Object.keys(s) as Array<keyof QuoteSettings>).filter((k) => before[k] !== s[k]).map((k) => [k, { from: before[k], to: s[k] }]));
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'tenant_settings', entityId: actor.tenantId, action: 'quote_settings_changed', changes });
  });
  return getQuoteSettings(actor.tenantId);
}

// Expiry ------------------------------------------------------------------------------------------

/** Sent quotes whose validity day has passed become expired (once, with a trace). */
export async function expireDueQuotes(tenantId: string) {
  if (!(await salesAvailable())) return 0;
  const today = istanbulToday();
  return withTransaction(async (tx: any) => {
    const rows = await tx`UPDATE quotations SET status = 'expired', version = version + 1, updated_at = now()
      WHERE tenant_id = ${tenantId} AND status = 'sent' AND valid_until < ${today}::date RETURNING id, valid_until`;
    for (const r of rows)
      await recordAudit(tx, { tenantId, actorId: null, entityType: 'quotation', entityId: r.id, action: 'status_changed', changes: { status: { from: 'sent', to: 'expired' } }, metadata: { reason: 'validity_passed', validUntil: iso(r.valid_until) } });
    return rows.length;
  });
}

// Customer price rules ----------------------------------------------------------------------------

export async function customerPriceRules(tenantId: string, customerId: string) {
  if (!(await salesAvailable())) return [];
  const rows = await sql`SELECT id, family, discount_percent, note FROM customer_price_rules WHERE tenant_id = ${tenantId} AND customer_id = ${customerId} ORDER BY family NULLS FIRST`;
  return rows.map((r: any) => ({ id: r.id as string, family: (r.family as string) ?? null, discountPercent: Number(r.discount_percent), note: (r.note as string) ?? null }));
}

/** Lines without a discount get the customer's standing one (the family rule over the general one). */
export async function applyCustomerPrices<T extends { discountPercent: number; productConfiguration?: any }>(tenantId: string, customerId: string, items: T[]) {
  const rules = await customerPriceRules(tenantId, customerId);
  if (!rules.length) return items;
  return items.map((i) => (i.discountPercent > 0 ? i : { ...i, discountPercent: customerDiscountFor(rules, i.productConfiguration?.family ?? null) }));
}

const PriceRuleSchema = z.object({
  family: z.string().trim().min(1).max(60).nullable().optional(),
  discountPercent: z.coerce.number().gt(0).max(100),
  note: z.string().trim().max(200).optional(),
}).strict();

export async function savePriceRule(actor: WorkOrderActor, customerId: string, raw: unknown) {
  need(actor, OFFICE, 'Müşteri fiyat listesini değiştirme');
  await requireSales();
  const r = PriceRuleSchema.parse(raw);
  await withTransaction(async (tx: any) => {
    const [c] = await tx`SELECT id FROM customers WHERE tenant_id = ${actor.tenantId} AND id = ${customerId}`;
    if (!c) throw new WorkOrderApiError('Müşteri bulunamadı', 404);
    const [before] = await tx`SELECT discount_percent FROM customer_price_rules WHERE tenant_id = ${actor.tenantId} AND customer_id = ${customerId} AND coalesce(family, '') = ${r.family ?? ''}`;
    await tx`INSERT INTO customer_price_rules (tenant_id, customer_id, family, discount_percent, note, created_by)
      VALUES (${actor.tenantId}, ${customerId}, ${r.family ?? null}, ${r.discountPercent}, ${r.note ?? null}, ${actor.userId})
      ON CONFLICT (tenant_id, customer_id, coalesce(family, '')) DO UPDATE SET discount_percent = EXCLUDED.discount_percent, note = EXCLUDED.note`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'customer', entityId: customerId, action: 'price_rule_set', changes: { [`indirim ${r.family ?? 'genel'}`]: { from: before ? Number(before.discount_percent) : null, to: r.discountPercent } } });
  });
  return customerPriceRules(actor.tenantId, customerId);
}

export async function deletePriceRule(actor: WorkOrderActor, customerId: string, ruleId: string) {
  need(actor, OFFICE, 'Müşteri fiyat listesini değiştirme');
  await requireSales();
  await withTransaction(async (tx: any) => {
    const [r] = await tx`DELETE FROM customer_price_rules WHERE tenant_id = ${actor.tenantId} AND customer_id = ${customerId} AND id = ${ruleId} RETURNING family, discount_percent`;
    if (!r) throw new WorkOrderApiError('Kural bulunamadı', 404);
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'customer', entityId: customerId, action: 'price_rule_removed', changes: { [`indirim ${r.family ?? 'genel'}`]: { from: Number(r.discount_percent), to: null } } });
  });
  return customerPriceRules(actor.tenantId, customerId);
}

// Revisions ---------------------------------------------------------------------------------------

async function loadQuote(db: any, tenantId: string, id: string, lock = false) {
  const [q] = lock
    ? await db`SELECT * FROM quotations WHERE tenant_id = ${tenantId} AND id = ${id} FOR UPDATE`
    : await db`SELECT * FROM quotations WHERE tenant_id = ${tenantId} AND id = ${id}`;
  if (!q) throw new WorkOrderApiError('Teklif bulunamadı', 404);
  const items = await db`SELECT * FROM quotation_items WHERE tenant_id = ${tenantId} AND quotation_id = ${id} ORDER BY position, id`;
  return { q, items };
}

export function snapshotOf(q: any, items: any[]): QuoteSnapshot {
  const num = (v: unknown) => (v == null ? null : Number(v));
  return {
    revision: Number(q.revision ?? 1),
    currency: q.currency,
    discountPercent: Number(q.discount_percent),
    vatPercent: Number(q.vat_percent ?? 20),
    validUntil: iso(q.valid_until),
    totalAmount: Number(q.total_amount),
    notes: q.notes ?? null,
    terms: q.terms_and_conditions ?? null,
    items: items.map((i) => ({
      productName: i.product_name, quantity: Number(i.quantity), unitPrice: Number(i.unit_price), discountPercent: Number(i.discount_percent),
      widthMm: num(i.width_mm), heightMm: num(i.height_mm), projectionMm: num(i.projection_mm), color: i.color ?? null, notes: i.notes ?? null,
      ...(i.product_visualization?{visualization:stableJson(i.product_visualization.configuration)}:{}),
    })),
  };
}

/**
 * Revising a sent, accepted, rejected or expired quote keeps the version the customer saw (a
 * snapshot), returns the quote to draft under the next revision number, and closes the old
 * approval links and approvals: what the customer approves next is the new revision.
 */
export async function reviseQuote(actor: WorkOrderActor, id: string, reason: string) {
  need(actor, OFFICE, 'Teklifi revize etme');
  await requireSales();
  const why = reason.trim();
  if (why.length < 3) throw new WorkOrderApiError('Revizyon gerekçesi yazın', 400);
  return withTransaction(async (tx: any) => {
    const { q, items } = await loadQuote(tx, actor.tenantId, id, true);
    if (!['sent', 'accepted', 'rejected', 'expired'].includes(q.status))
      throw new WorkOrderApiError(q.status === 'draft' ? 'Taslak teklif zaten düzenlenebilir' : 'Siparişe dönüşen teklif revize edilemez', 409);
    await tx`INSERT INTO quotation_revisions (tenant_id, quotation_id, revision, status, snapshot, reason, created_by)
      VALUES (${actor.tenantId}, ${id}, ${q.revision}, ${q.status}, ${JSON.stringify(snapshotOf(q, items))}::text::jsonb, ${why}, ${actor.userId})`;
    await tx`UPDATE quotation_approval_links SET revoked_at = now() WHERE tenant_id = ${actor.tenantId} AND quotation_id = ${id} AND revoked_at IS NULL`;
    await tx`UPDATE quotations SET status = 'draft', revision = revision + 1, version = version + 1, updated_at = now(), sent_at = NULL,
      discount_approved_percent = NULL, discount_approved_by = NULL, discount_approved_at = NULL,
      customer_decided_at = NULL, customer_decision_name = NULL, customer_decision_ip = NULL, customer_decision_agent = NULL, customer_decision_note = NULL
      WHERE tenant_id = ${actor.tenantId} AND id = ${id}`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'quotation', entityId: id, action: 'revised', note: why, changes: { revizyon: { from: q.revision, to: q.revision + 1 }, status: { from: q.status, to: 'draft' } } });
    return { revision: q.revision + 1 };
  });
}

/** Revisions with what changed from each to the next (the last one against the quote as it is now). */
export async function quoteHistory(actor: WorkOrderActor, id: string) {
  need(actor, READERS, 'Teklif geçmişini görme');
  if (!(await salesAvailable())) return { available: false, revisions: [] };
  const { q, items } = await loadQuote(sql, actor.tenantId, id);
  const rows = await sql`SELECT r.revision, r.status, r.snapshot, r.reason, r.created_at, u.name AS by_name
    FROM quotation_revisions r LEFT JOIN users u ON u.id = r.created_by
    WHERE r.tenant_id = ${actor.tenantId} AND r.quotation_id = ${id} ORDER BY r.revision`;
  const current = snapshotOf(q, items);
  const revisions = rows.map((r: any, i: number) => {
    const next: QuoteSnapshot = i + 1 < rows.length ? rows[i + 1].snapshot : current;
    return { revision: r.revision, status: r.status, reason: r.reason, at: r.created_at, by: r.by_name ?? null, totalAmount: r.snapshot.totalAmount, diffToNext: diffQuotes(r.snapshot, next), nextRevision: next.revision };
  });
  return { available: true, current: current.revision, revisions };
}

// Discount approval -------------------------------------------------------------------------------

/** The quote's discount position for the screen: effective share, the firm's threshold, approval state. */
export async function discountState(tenantId: string, id: string) {
  const settings = await getQuoteSettings(tenantId);
  const { q, items } = await loadQuote(sql, tenantId, id);
  const effective = effectiveDiscountPercent(items.map((i: any) => ({ quantity: Number(i.quantity), unitPrice: Number(i.unit_price), discountPercent: Number(i.discount_percent) })), Number(q.discount_percent));
  const approved = q.discount_approved_percent == null ? null : Number(q.discount_approved_percent);
  return { effective, threshold: settings.discountApprovalPercent, approved, needsApproval: needsDiscountApproval(effective, settings.discountApprovalPercent, approved), tryTotal: tryEquivalent(Number(q.total_amount), q.currency, q.fx_rate == null ? null : Number(q.fx_rate)) };
}

export async function approveDiscount(actor: WorkOrderActor, id: string, expectedPercent?: number) {
  need(actor, MANAGERS, 'İndirim onaylama');
  await requireSales();
  const settings = await getQuoteSettings(actor.tenantId);
  await withTransaction(async (tx: any) => {
    // Worked out on the locked rows: what is approved is what is on the quote now, and must be what the manager saw.
    const { q, items } = await loadQuote(tx, actor.tenantId, id, true);
    if (!['draft', 'sent'].includes(q.status)) throw new WorkOrderApiError('Bu teklifte indirim onayı gerekmez', 409);
    const effective = effectiveDiscountPercent(items.map((i: any) => ({ quantity: Number(i.quantity), unitPrice: Number(i.unit_price), discountPercent: Number(i.discount_percent) })), Number(q.discount_percent));
    if (expectedPercent !== undefined && Math.abs(expectedPercent - effective) > 0.005)
      throw new WorkOrderApiError(`İndirim bu arada %${effective} oldu; güncel teklifi açıp yeniden onaylayın`, 409);
    await tx`UPDATE quotations SET discount_approved_percent = ${effective}, discount_approved_by = ${actor.userId}, discount_approved_at = now(), version = version + 1, updated_at = now() WHERE tenant_id = ${actor.tenantId} AND id = ${id}`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'quotation', entityId: id, action: 'discount_approved', changes: { indirim: { from: q.discount_approved_percent == null ? null : Number(q.discount_approved_percent), to: effective } }, metadata: { threshold: settings.discountApprovalPercent } });
  });
  return discountState(actor.tenantId, id);
}

// Templates ---------------------------------------------------------------------------------------

const TEMPLATE_ITEM_KEYS = ['productName', 'description', 'color', 'widthMm', 'heightMm', 'projectionMm', 'mountingHeightMm', 'quantity', 'unitPrice', 'discountPercent', 'notes', 'productConfiguration'] as const;

export async function listTemplates(actor: WorkOrderActor) {
  need(actor, READERS, 'Teklif şablonlarını görme');
  if (!(await salesAvailable())) return [];
  const rows = await sql`SELECT id, name, items, notes, terms, vat_percent, created_at FROM quotation_templates WHERE tenant_id = ${actor.tenantId} ORDER BY name_key`;
  return rows.map((r: any) => ({ id: r.id, name: r.name, items: r.items, notes: r.notes, terms: r.terms, vatPercent: r.vat_percent == null ? null : Number(r.vat_percent), lineCount: (r.items as unknown[]).length }));
}

/** A template from a quote: its lines (configured ones as the seller's choice, priced again when used), notes and terms. */
export async function saveTemplateFromQuote(actor: WorkOrderActor, quotationId: string, name: string) {
  need(actor, OFFICE, 'Teklif şablonu kaydetme');
  await requireSales();
  const clean = name.trim();
  if (!clean || clean.length > 80) throw new WorkOrderApiError('Şablon adı 1-80 karakter olmalı', 400);
  const { q, items } = await loadQuote(sql, actor.tenantId, quotationId);
  const lines = items.map((i: any) => {
    const line: Record<string, unknown> = {
      productName: i.product_name, description: i.description, color: i.color, widthMm: i.width_mm == null ? undefined : Number(i.width_mm),
      heightMm: i.height_mm == null ? undefined : Number(i.height_mm), projectionMm: i.projection_mm == null ? undefined : Number(i.projection_mm),
      mountingHeightMm: i.mounting_height_mm == null ? undefined : Number(i.mounting_height_mm), quantity: Number(i.quantity), unitPrice: Number(i.unit_price),
      discountPercent: Number(i.discount_percent), notes: i.notes,
      // The seller's choice only (family, recipe, measures, colour): the server prices and builds it again when used.
      productConfiguration: i.product_configuration ? { family: i.product_configuration.family, recipeId: i.product_configuration.recipeId, parameters: i.product_configuration.parameters, color: i.product_configuration.color } : undefined,
    };
    return Object.fromEntries(TEMPLATE_ITEM_KEYS.filter((k) => line[k] != null).map((k) => [k, line[k]]));
  });
  return withTransaction(async (tx: any) => {
    const [dupe] = await tx`SELECT id FROM quotation_templates WHERE tenant_id = ${actor.tenantId} AND name_key = ${clean.toLocaleLowerCase('tr')}`;
    if (dupe) throw new WorkOrderApiError('Bu adla bir şablon var', 409);
    const [t] = await tx`INSERT INTO quotation_templates (tenant_id, name, name_key, items, notes, terms, vat_percent, created_by)
      VALUES (${actor.tenantId}, ${clean}, ${clean.toLocaleLowerCase('tr')}, ${JSON.stringify(lines)}::text::jsonb, ${q.notes ?? null}, ${q.terms_and_conditions ?? null}, ${q.vat_percent ?? null}, ${actor.userId}) RETURNING id`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'quotation', entityId: quotationId, action: 'template_saved', metadata: { template: clean, lines: lines.length } });
    return { id: t.id as string, name: clean };
  });
}

export async function deleteTemplate(actor: WorkOrderActor, id: string) {
  need(actor, OFFICE, 'Teklif şablonu silme');
  await requireSales();
  await withTransaction(async (tx: any) => {
    const [t] = await tx`DELETE FROM quotation_templates WHERE tenant_id = ${actor.tenantId} AND id = ${id} RETURNING name`;
    if (!t) throw new WorkOrderApiError('Şablon bulunamadı', 404);
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'tenant_settings', entityId: actor.tenantId, action: 'template_deleted', metadata: { template: t.name } });
  });
}

// Customer approval link --------------------------------------------------------------------------

const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

/**
 * A link the customer opens to approve or reject this revision of a sent quote. It ends with the
 * quote's validity (at most 30 days), a new link or a revision closes the old one, and it can be
 * used for one decision.
 */
export async function createApprovalLink(actor: WorkOrderActor, id: string) {
  need(actor, OFFICE, 'Müşteri onay bağlantısı oluşturma');
  await requireSales();
  await expireDueQuotes(actor.tenantId);
  const token = randomBytes(32).toString('base64url');
  const expiresAt = await withTransaction(async (tx: any) => {
    const { q } = await loadQuote(tx, actor.tenantId, id, true);
    if (q.status !== 'sent') throw new WorkOrderApiError(q.status === 'expired' ? 'Teklifin süresi doldu; revize edip yeniden gönderin' : 'Önce teklifi gönderin', 409);
    const validEnd = q.valid_until ? new Date(iso(q.valid_until) + 'T20:59:59Z') : null; // 23:59:59 Istanbul
    const cap = new Date(Date.now() + 30 * 86_400_000);
    const expires = validEnd && validEnd < cap ? validEnd : cap;
    await tx`UPDATE quotation_approval_links SET revoked_at = now() WHERE tenant_id = ${actor.tenantId} AND quotation_id = ${id} AND revoked_at IS NULL`;
    await tx`INSERT INTO quotation_approval_links (tenant_id, quotation_id, revision, token_hash, expires_at, created_by)
      VALUES (${actor.tenantId}, ${id}, ${q.revision}, ${hashToken(token)}, ${expires}, ${actor.userId})`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'quotation', entityId: id, action: 'approval_link_created', metadata: { revision: q.revision, expiresAt: expires.toISOString() } });
    return expires;
  });
  return { path: `/teklif/${token}`, expiresAt: expiresAt.toISOString() };
}

async function linkFor(db: any, token: string, lock = false) {
  if (!TOKEN.test(token)) return null;
  const [l] = lock
    ? await db`SELECT * FROM quotation_approval_links WHERE token_hash = ${hashToken(token)} FOR UPDATE`
    : await db`SELECT * FROM quotation_approval_links WHERE token_hash = ${hashToken(token)}`;
  if (!l || l.revoked_at || new Date(l.expires_at) < new Date()) return null;
  return l;
}

/** What the customer sees: their own quote (lines, measures, colour, prices, terms); never internal notes. */
export async function publicQuote(token: string) {
  if (!(await salesAvailable())) return null;
  const l = await linkFor(sql, token);
  if (!l) return null;
  const { q, items } = await loadQuote(sql, l.tenant_id, l.quotation_id);
  if (q.revision !== l.revision) return null;
  const [tenant] = await sql`SELECT name FROM tenants WHERE id = ${l.tenant_id}`;
  return {
    firm: tenant?.name ?? '',
    quotationNumber: q.quotation_number,
    revision: q.revision,
    customerName: q.customer_name,
    status: q.status as string,
    decidable: q.status === 'sent' && !l.used_at,
    decidedAt: q.customer_decided_at,
    decidedBy: q.customer_decision_name,
    validUntil: iso(q.valid_until),
    currency: q.currency,
    vatPercent: Number(q.vat_percent ?? 20),
    subtotal: Number(q.subtotal),
    discountAmount: Number(q.discount_amount),
    taxAmount: Number(q.tax_amount),
    totalAmount: Number(q.total_amount),
    notes: q.notes ?? null,
    terms: q.terms_and_conditions ?? null,
    items: items.map((i: any) => ({
      productName: i.product_name, description: i.description ?? null, quantity: Number(i.quantity), unitPrice: Number(i.unit_price),
      discountPercent: Number(i.discount_percent), totalPrice: Number(i.total_price), color: i.color ?? null,
      widthMm: i.width_mm == null ? null : Number(i.width_mm), heightMm: i.height_mm == null ? null : Number(i.height_mm),
      family: i.product_configuration?.family ?? null,
      productVisualization: publicVisualization(i.product_visualization),
      awningConfiguration: i.awning_configuration??null,
      awningPreview: i.awning_preview??null,
      parameters: i.product_configuration?.parameters
        ? { widthMm: i.product_configuration.parameters.widthMm ?? null, projectionMm: i.product_configuration.parameters.projectionMm ?? null, mountingHeightMm: i.product_configuration.parameters.mountingHeightMm ?? null }
        : null,
    })),
  };
}

const DecisionSchema = z.object({
  decision: z.enum(['accept', 'reject']),
  name: z.string().trim().min(2, 'Adınızı yazın').max(120),
  note: z.string().trim().max(1000).optional(),
}).strict();

/**
 * The customer's decision through the link: once, while the quote is sent and valid, with the
 * name they typed, the time, their IP and browser kept on the quote and in the trail.
 */
export async function publicDecision(token: string, raw: unknown, client: { ip: string; agent: string }) {
  if (!(await salesAvailable())) throw new WorkOrderApiError('Bağlantı geçersiz', 404);
  const limit = await consumeRateLimit('quoteDecision', client.ip || 'unknown');
  if (!limit.allowed) throw new WorkOrderApiError('Çok fazla deneme; biraz sonra tekrar deneyin', 429);
  const d = DecisionSchema.parse(raw);
  const result = await withTransaction(async (tx: any) => {
    // Quote first, then link: the same lock order as revising and creating links (no deadlock).
    const seen = await linkFor(tx, token);
    if (!seen) throw new WorkOrderApiError('Bağlantı geçersiz veya süresi dolmuş', 404);
    const { q } = await loadQuote(tx, seen.tenant_id, seen.quotation_id, true);
    const l = await linkFor(tx, token, true);
    if (!l) throw new WorkOrderApiError('Bağlantı geçersiz veya süresi dolmuş', 404);
    if (l.used_at) throw new WorkOrderApiError('Bu teklif için karar zaten verildi', 409);
    if (q.revision !== l.revision) throw new WorkOrderApiError('Teklif değişti; firmadan yeni bağlantı isteyin', 409);
    if (q.status !== 'sent') throw new WorkOrderApiError('Bu teklif artık karar beklemiyor', 409);
    if (q.valid_until && iso(q.valid_until)! < istanbulToday()) throw new WorkOrderApiError('Teklifin geçerlilik süresi doldu', 409);
    const to = d.decision === 'accept' ? 'accepted' : 'rejected';
    const agent = client.agent.slice(0, 300);
    await tx`UPDATE quotations SET status = ${to}, version = version + 1, updated_at = now(), customer_decided_at = now(), customer_decision_name = ${d.name},
      customer_decision_ip = ${client.ip.slice(0, 64)}, customer_decision_agent = ${agent}, customer_decision_note = ${d.note || null}
      WHERE id = ${q.id}`;
    await tx`UPDATE quotation_approval_links SET used_at = now() WHERE id = ${l.id}`;
    await recordAudit(tx, { tenantId: l.tenant_id, actorId: null, entityType: 'quotation', entityId: q.id, action: d.decision === 'accept' ? 'customer_accepted' : 'customer_rejected', changes: { status: { from: 'sent', to } }, metadata: { name: d.name, ip: client.ip.slice(0, 64), agent, revision: q.revision, note: d.note || null } });
    return { tenantId: l.tenant_id as string, quoteId: q.id as string, number: q.quotation_number as string, createdBy: q.created_by as string | null, status: to };
  });
  // After commit: the seller hears of it (and the managers when no seller is on the quote).
  const people = result.createdBy ? [result.createdBy] : (await sql`SELECT user_id FROM tenant_members WHERE tenant_id = ${result.tenantId} AND role IN ('owner', 'admin')`).map((m: any) => m.user_id);
  for (const p of people)
    await createNotification(p, result.tenantId, 'system', `${result.number} ${result.status === 'accepted' ? 'müşteri tarafından onaylandı' : 'müşteri tarafından reddedildi'}`, `${d.name} · bağlantı ile`, { href: `/quotations/${result.quoteId}`, entityType: 'quotation', entityId: result.quoteId })
      .catch((e) => console.error('[sales] decision notice', e instanceof Error ? e.message : e));
  return { status: result.status };
}

/** A firm-facing summary of the customer's decision, for the quote screen. */
export async function decisionTrail(actor: WorkOrderActor, id: string) {
  need(actor, READERS, 'Teklif görme');
  if (!(await salesAvailable())) return null;
  const { q } = await loadQuote(sql, actor.tenantId, id);
  const [link] = await sql`SELECT expires_at, used_at, revoked_at, created_at FROM quotation_approval_links WHERE tenant_id = ${actor.tenantId} AND quotation_id = ${id} ORDER BY created_at DESC LIMIT 1`;
  return {
    decidedAt: q.customer_decided_at, name: q.customer_decision_name, ip: q.customer_decision_ip, agent: q.customer_decision_agent, note: q.customer_decision_note,
    link: link ? { createdAt: link.created_at, expiresAt: link.expires_at, used: Boolean(link.used_at), revoked: Boolean(link.revoked_at), live: !link.used_at && !link.revoked_at && new Date(link.expires_at) > new Date() } : null,
    validUntil: iso(q.valid_until), defaultValidUntil: addDays(istanbulToday(), (await getQuoteSettings(actor.tenantId)).defaultValidDays),
  };
}
