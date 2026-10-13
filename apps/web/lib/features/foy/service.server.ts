import 'server-only';

import { z } from 'zod';
import { sql } from '@/lib/db';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { resolveMemberAccess } from '@/lib/security/member-access.server';
import { can } from '@/lib/security/access-matrix';
import { getAiSettings } from '@/lib/ai/gate.server';
import { NewOrderFormSchema } from '@/lib/shared/types';
import { foyLayout } from './pdf.server';
import { parseFoy } from './parse';
import { checkFoy, foyFeatures } from './rules';
import { matchCustomers } from './match';
import { foyToOrder } from './to-order';
import { FoyDocSchema, type FoyDoc } from './types';

const MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;
export const FoyUploadSchema = z.object({
  name: z.string().trim().min(1).max(200),
  mime: z.enum(MIMES),
  base64: z.string().min(10).max(8_000_000).regex(/^[A-Za-z0-9+/=\r\n]+$/),
});

async function needOrders(actor: WorkOrderActor, action: 'view' | 'create') {
  const access = await resolveMemberAccess(actor.userId, actor.tenantId);
  if (!access || access.deactivated || actor.role === 'worker' || !can(access, 'orders', action)) throw new WorkOrderApiError('Bu işlem için yetkiniz yok', 403);
  return access;
}

/** Fill only what the text layer left empty; the text layer is exact, the model is a reading. */
function mergeModel(base: FoyDoc, model: FoyDoc): { doc: FoyDoc; filled: string[] } {
  const filled: string[] = [];
  const doc: FoyDoc = { ...base };
  const take = <K extends keyof FoyDoc>(key: K, empty: (v: FoyDoc[K]) => boolean) => {
    if (empty(base[key]) && !empty(model[key])) {
      doc[key] = model[key];
      filled.push(String(key));
    }
  };
  if (base.template === 'unknown' && model.template !== 'unknown') { doc.template = model.template; filled.push('template'); }
  for (const k of ['date', 'customer', 'address', 'ral', 'finish', 'fabric', 'assembly', 'crated', 'fabricSize', 'valanceSize', 'windbreaker'] as const) take(k, (v) => v === null);
  for (const k of ['series', 'lights', 'notes', 'systems', 'cutList', 'ironNotes'] as const) take(k, (v) => !(v as unknown[]).length);
  // The rüzgâr kırıcı table comes only from the picture: fill its empty fields one by one.
  if (base.windbreaker && model.windbreaker) {
    const wb = { ...base.windbreaker };
    for (const [k, v] of Object.entries(model.windbreaker) as Array<[keyof typeof wb, unknown]>) {
      const cur = wb[k];
      if ((cur === null || (Array.isArray(cur) && !cur.length)) && v !== null && !(Array.isArray(v) && !v.length)) {
        (wb as Record<string, unknown>)[k] = v;
        filled.push(`windbreaker.${k}`);
      }
    }
    doc.windbreaker = wb;
  }
  doc.unreadPages = filled.length ? model.unreadPages : base.unreadPages;
  return { doc, filled };
}

export type FoyAnalysis = Awaited<ReturnType<typeof analyzeFoy>>;

/**
 * Reads one föy: text layer and drawn check boxes first (exact, free, nothing leaves the server);
 * the vision model only for what that cannot read (scans, photos, picture pages) and only when the
 * firm turned the model on with the KVKK confirmation. Nothing is written.
 */
export async function analyzeFoy(actor: WorkOrderActor, raw: unknown) {
  const input = FoyUploadSchema.parse(raw);
  const access = await needOrders(actor, 'create');
  const bytes = Uint8Array.from(Buffer.from(input.base64, 'base64'));
  if (bytes.length > 6_000_000) throw new WorkOrderApiError('Dosya en fazla 6 MB olabilir', 400);

  let doc: FoyDoc = input.mime === 'application/pdf' ? parseFoy(await foyLayout(bytes)) : { ...parseFoy({ pageCount: 1, items: [], segments: [], imagePages: [1] }) };
  const needsModel = doc.template === 'unknown' || doc.unreadPages.length > 0;
  let model: { used: boolean; filled: string[]; blocked: string | null } = { used: false, filled: [], blocked: null };
  if (needsModel) {
    const ai = await getAiSettings(actor.tenantId);
    const { aiAvailable, getAIService } = await import('@/lib/ai/service');
    if (!aiAvailable()) model.blocked = 'Görsel okuma için model anahtarı tanımlı değil.';
    else if (ai.mode !== 'assist' || !ai.kvkkAckAt) model.blocked = 'Görsel okuma kapalı: Ayarlar → Asistan bölümünde model kullanımını açın (KVKK onayı).';
    else {
      try {
        const read = FoyDocSchema.parse(await getAIService().analyzeFoy(input.base64, input.mime, doc.template === 'unknown' ? null : doc, { tenantId: actor.tenantId, userId: actor.userId, feature: 'foy.read' }));
        const merged = mergeModel(doc, read);
        doc = merged.doc;
        model = { used: true, filled: merged.filled, blocked: null };
      } catch (e) {
        model.blocked = e instanceof Error && /bütçe|limit|kapalı/i.test(e.message) ? e.message : 'Görsel okuma şu an yapılamadı; metinden okunanlar gösteriliyor.';
      }
    }
  }

  const checks = checkFoy(doc);
  const customers = await sql`SELECT id, COALESCE(NULLIF(company_name, ''), full_name) AS name FROM customers WHERE tenant_id = ${actor.tenantId} AND COALESCE(NULLIF(company_name, ''), full_name) IS NOT NULL ORDER BY updated_at DESC NULLS LAST LIMIT 5000`;
  const matches = matchCustomers([doc.customer, doc.address, input.name.replace(/\.(pdf|jpe?g|png|webp)$/i, '').replace(/[_-]+/g, ' ').replace(/\bİMALAT\b.*$/i, '')], customers.map((c: Record<string, unknown>) => ({ id: String(c.id), name: String(c.name) })));
  return {
    name: input.name, doc, checks, features: foyFeatures(doc), customers: matches, model,
    summary: { ok: checks.filter((c) => c.severity === 'ok').length, info: checks.filter((c) => c.severity === 'info').length, warn: checks.filter((c) => c.severity === 'warn').length },
    hidePrices: access.hidden.includes('price'),
  };
}

export const FoyOrderSchema = z.object({
  name: z.string().trim().min(1).max(200),
  doc: FoyDocSchema,
  customerId: z.string().uuid().nullable(),
  customerName: z.string().trim().min(1, 'Müşteri adı gerekli').max(200),
  file: FoyUploadSchema.optional(),
});

/** The user's approval: the reviewed sheet becomes an order (checks are recomputed, not trusted from the client). */
export async function createOrderFromFoy(actor: WorkOrderActor, raw: unknown) {
  const input = FoyOrderSchema.parse(raw);
  await needOrders(actor, 'create');
  if (input.customerId) {
    const [c] = await sql`SELECT id FROM customers WHERE tenant_id = ${actor.tenantId} AND id = ${input.customerId}`;
    if (!c) throw new WorkOrderApiError('Müşteri bulunamadı', 404);
  }
  if (input.doc.template === 'unknown') throw new WorkOrderApiError('Föy tanınmadı; sipariş oluşturulamaz', 400);
  const checks = checkFoy(input.doc);
  const data = NewOrderFormSchema.parse(foyToOrder(input.doc, checks, { customerName: input.customerName, customerId: input.customerId ?? undefined, fileName: input.name }));
  const { storageConfigured } = await import('@/lib/storage');
  const files = input.file && storageConfigured() ? [new File([Buffer.from(input.file.base64, 'base64')], input.file.name, { type: input.file.mime })] : [];
  const { orderService } = await import('@/lib/services/orderService.server');
  const order = await orderService.createOrder(actor.tenantId, data, files, actor.userId);
  return { orderId: String(order.id), orderNumber: order.orderNumber, href: `/orders/${order.id}`, attached: files.length > 0 };
}
