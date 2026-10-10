import 'server-only';

import { z } from 'zod';
import { sql } from '@/lib/db';
import { tableExists } from '@/lib/db/schema-guard';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { resolveMemberAccess } from '@/lib/security/member-access.server';
import { can } from '@/lib/security/access-matrix';
import { registerSuggestionKind } from '@/lib/ai/suggestions/kinds';
import { getAiSettings } from '@/lib/ai/gate.server';
import { istanbulToday } from '@/lib/features/sales/order-status.server';
import { parseColorWords } from '@/lib/ai/commands/parse';
import { extractQuoteRequest, type Field, type QuoteRequest } from './quote-request';
import { parseSupplierOffer } from './supplier-offer';

type Row = Record<string, any>;
const FAMILY_LABEL: Record<string, string> = { pergola: 'Pergola', awning: 'Tente', guillotine: 'Giyotin cam', zip: 'Zip perde', rolling_roof: 'Rolling roof', winter_garden: 'Kış bahçesi' };

async function need(actor: WorkOrderActor, module: 'quotations' | 'purchasing', action: 'create' | 'edit') {
  const access = await resolveMemberAccess(actor.userId, actor.tenantId);
  if (!access || access.deactivated || actor.role === 'worker' || !can(access, module, action)) throw new WorkOrderApiError('Bu işlem için yetkiniz yok', 403);
  return access;
}

/**
 * Model help for a message the rules could not fully read: only when the firm allows the model
 * (mode + KVKK). Personal data (phone, e-mail) is masked by the service; the model's fields come back
 * marked "model" with medium confidence and never overwrite a field the rules read.
 */
async function withModel(actor: WorkOrderActor, text: string, r: QuoteRequest): Promise<{ request: QuoteRequest; used: boolean }> {
  if (r.lines.length && r.lines.every((l) => l.family && l.color)) return { request: r, used: false };
  const ai = await getAiSettings(actor.tenantId);
  if (ai.mode !== 'assist' || !ai.kvkkAckAt) return { request: r, used: false };
  try {
    const { aiAvailable, getAIService } = await import('@/lib/ai/service');
    if (!aiAvailable()) return { request: r, used: false };
    // Minimum data: the contact details the rules already read never leave (customer names in the
    // free text cannot be recognised reliably; the firm accepted that with the KVKK switch).
    let minimal = text;
    for (const v of [r.phone?.evidence, r.email?.value, r.address?.value]) if (v) minimal = minimal.split(v).join('[gizli]');
    const out = await getAIService().analyzeText(minimal, [], { tenantId: actor.tenantId, userId: actor.userId, feature: 'extract.quote_request' });
    const m = (v: unknown): Field<any> | null => (v === null || v === undefined || v === '' ? null : { value: v, confidence: 'medium', source: 'model' });
    const lines = r.lines.length ? r.lines : (out.items ?? []).filter((i: any) => i.widthMm && (i.projectionMm || i.heightMm)).map((i: any) => ({
      family: m(/tente/i.test(i.productName ?? '') ? 'awning' : /zip/i.test(i.productName ?? '') ? 'zip' : /pergola|bioklimatik/i.test(i.productName ?? '') ? 'pergola' : null),
      widthMm: m(Math.round(i.widthMm)), projectionMm: m(Math.round(i.projectionMm ?? i.heightMm)), color: m(i.color ? parseColorWords(i.color) ?? i.color : null), quantity: m(i.quantity ?? 1) ?? { value: 1, confidence: 'low' as const, source: 'model' as const },
    }));
    return { request: { ...r, customer: r.customer ?? m(out.customerName), lines }, used: true };
  } catch {
    return { request: r, used: false };
  }
}

/** Pasted WhatsApp / e-mail → a quote draft preview with per-field confidence (yellow below "high"). */
export async function quoteRequestPreview(actor: WorkOrderActor, raw: unknown) {
  const { text } = z.object({ text: z.string().trim().min(5).max(8000) }).parse(raw);
  const access = await need(actor, 'quotations', 'create');
  const { request, used } = await withModel(actor, text, extractQuoteRequest(text));
  if (!request.lines.length) return { type: 'need' as const, message: request.notes.join(' ') || 'Mesajda ürün ve ölçü bulunamadı.', request };
  const lines = request.lines.map((l) => ({ family: l.family?.value ?? null, widthMm: l.widthMm?.value ?? null, projectionMm: l.projectionMm?.value ?? null, color: l.color?.value ?? null, quantity: l.quantity.value }));
  const { fileSuggestion } = await import('@/lib/ai/suggestions/service');
  const name = request.customer?.value ?? 'İsimsiz talep';
  const r = await fileSuggestion(sql, actor.tenantId, actor.userId, {
    kind: REQUEST_KIND, title: `${name}: ${lines.length} kalem teklif talebi`, rationale: 'Yapıştırılan mesajdan çıkarıldı; sarı alanları kontrol edin.',
    payload: { customerName: name, phone: request.phone?.value ?? null, email: request.email?.value ?? null, address: request.address?.value ?? null, lines },
    source: used ? 'model' : 'system', uncertain: true, uncertaintyNote: 'Metinden çıkarılan değerler onaydan önce kontrol edilmeli.',
  });
  return { type: 'preview' as const, suggestionId: String(r.suggestion.id), version: Number(r.suggestion.version), request, usedModel: used, hidePrices: access.hidden.includes('price') };
}

const REQUEST_KIND = 'extract.quote_request';
registerSuggestionKind({
  kind: REQUEST_KIND, label: 'Mesajdan teklif', icon: 'FileText', roles: ['owner', 'admin', 'office'], access: { module: 'quotations', action: 'create' },
  payloadSchema: z.object({
    customerName: z.string().min(1).max(200), phone: z.string().nullable(), email: z.string().nullable(), address: z.string().nullable(),
    lines: z.array(z.object({ family: z.string().nullable(), widthMm: z.number().nullable(), projectionMm: z.number().nullable(), color: z.string().nullable(), quantity: z.number().int().positive() })).min(1).max(30),
  }),
  apply: async (tx, actor, p, suggestion) => {
    void tx;
    const { quotationService } = await import('@/lib/features/quotations/service');
    const { CreateQuotationSchema } = await import('@/lib/features/quotations/types');
    const q = await quotationService.createQuotation(actor.tenantId, CreateQuotationSchema.parse({
      idempotencyKey: suggestion.id, customerName: p.customerName,
      items: p.lines.map((l) => ({ productName: `${FAMILY_LABEL[l.family ?? ''] ?? 'Ürün'}${l.widthMm && l.projectionMm ? ` ${l.widthMm / 1000} × ${l.projectionMm / 1000} m` : ''}`, quantity: l.quantity, unitPrice: 0, color: l.color ?? undefined, widthMm: l.widthMm ?? undefined, projectionMm: l.projectionMm ?? undefined, description: 'Mesajdan çıkarıldı' })),
      // Contact details stay on the internal note (the quote form has no phone field).
      internalNotes: ['Mesajdan teklif talebi', p.phone && `Tel: ${p.phone}`, p.email && `E-posta: ${p.email}`, p.address && `Adres: ${p.address}`].filter(Boolean).join('\n'),
    }), actor.userId);
    return { quotationId: q.id, href: `/quotations/${q.id}` };
  },
});

/** A supplier's offer (PDF text or pasted) → the answer to our price request, line by line with confidence. */
export async function supplierOfferPreview(actor: WorkOrderActor, raw: unknown) {
  const d = z.object({ rfqId: z.string().uuid(), supplierId: z.string().uuid(), text: z.string().trim().min(5).max(60_000) }).parse(raw);
  await need(actor, 'purchasing', 'edit');
  if (!(await tableExists('purchase_rfqs'))) throw new WorkOrderApiError('Teklif isteği için veritabanı güncellemesi (043) bekleniyor', 409);
  const [rfq] = await sql`SELECT id, rfq_number, status, supplier_ids, currency FROM purchase_rfqs WHERE tenant_id = ${actor.tenantId} AND id = ${d.rfqId}`;
  if (!rfq) throw new WorkOrderApiError('Teklif isteği bulunamadı', 404);
  if (rfq.status !== 'open') throw new WorkOrderApiError('Bu teklif isteği kapanmış', 409);
  if (!(rfq.supplier_ids as string[]).map(String).includes(d.supplierId)) throw new WorkOrderApiError('Bu tedarikçiden teklif istenmedi', 400);
  const lines = await sql`SELECT l.id, l.quantity, l.color, i.name, i.sku, i.profile_code FROM purchase_rfq_lines l JOIN inventory_items i ON i.id = l.item_id WHERE l.tenant_id = ${actor.tenantId} AND l.rfq_id = ${d.rfqId} ORDER BY l.position`;
  const offer = parseSupplierOffer(d.text, lines.map((l: Row) => ({ lineId: String(l.id), name: l.name, codes: [l.sku, l.profile_code].filter(Boolean), color: l.color, quantity: Number(l.quantity) })), istanbulToday());
  const priced = offer.prices.filter((p) => p.unitPrice !== null);
  if (!priced.length) return { type: 'need' as const, message: 'Teklifte isteğimizdeki kalemlerden hiçbiri bulunamadı.', offer };
  const [s] = await sql`SELECT name FROM suppliers WHERE tenant_id = ${actor.tenantId} AND id = ${d.supplierId}`;
  const { fileSuggestion } = await import('@/lib/ai/suggestions/service');
  const r = await fileSuggestion(sql, actor.tenantId, actor.userId, {
    kind: OFFER_KIND, title: `${s?.name ?? 'Tedarikçi'} cevabı · ${rfq.rfq_number}`, rationale: `${priced.length}/${lines.length} satır fiyatlandı.${offer.unmatched.length ? ` Bulunamayan: ${offer.unmatched.join(', ')}.` : ''}`,
    payload: { rfqId: d.rfqId, supplierId: d.supplierId, leadTimeDays: offer.leadTimeDays, validUntil: offer.validUntil, prices: priced.map((p) => ({ lineId: p.lineId, unitPrice: p.unitPrice! })) },
    uncertain: priced.some((p) => p.confidence !== 'high') || offer.unmatched.length > 0, uncertaintyNote: 'Sarı satırların fiyatını teklifle karşılaştırın.',
  });
  return { type: 'preview' as const, suggestionId: String(r.suggestion.id), version: Number(r.suggestion.version), offer, lines: lines.map((l: Row) => ({ lineId: String(l.id), name: l.name, quantity: Number(l.quantity) })), currency: rfq.currency };
}

const OFFER_KIND = 'extract.rfq_response';
registerSuggestionKind({
  kind: OFFER_KIND, label: 'Tedarikçi teklifinden cevap', icon: 'FileText', roles: ['owner', 'admin', 'office'], access: { module: 'purchasing', action: 'edit' }, sensitive: ['price', 'cost'],
  payloadSchema: z.object({ rfqId: z.string().uuid(), supplierId: z.string().uuid(), leadTimeDays: z.number().nullable(), validUntil: z.string().nullable(), prices: z.array(z.object({ lineId: z.string().uuid(), unitPrice: z.number().min(0) })).min(1) }),
  apply: async (tx, actor, p) => {
    void tx;
    const { recordRfqResponse } = await import('@/lib/features/stock/depth.server');
    await recordRfqResponse(actor as any, p.rfqId, { supplierId: p.supplierId, leadTimeDays: p.leadTimeDays, validUntil: p.validUntil, prices: p.prices, note: 'Tedarikçi teklifinden asistanla çıkarıldı' });
    return { rfqId: p.rfqId, href: '/purchases?tab=rfq' };
  },
});

/** Text of an uploaded PDF (the same reader the count import uses). */
export async function pdfText(base64: string) {
  const { pdfTextItems } = await import('@/lib/features/warehouse/count-import/extract');
  const bytes = Uint8Array.from(Buffer.from(base64, 'base64'));
  if (bytes.length > 4_000_000) throw new WorkOrderApiError('Dosya en fazla 4 MB olabilir', 400);
  const items = await pdfTextItems(bytes);
  // Lines by page and vertical position (PDF y grows upwards), each left to right.
  const rows = new Map<string, { page: number; y: number; cells: Array<{ x: number; s: string }> }>();
  for (const it of items) {
    const key = `${it.page}:${it.y}`;
    const row = rows.get(key) ?? { page: it.page, y: it.y, cells: [] };
    row.cells.push({ x: it.x, s: it.text });
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => a.page - b.page || b.y - a.y).map((r) => r.cells.sort((a, b) => a.x - b.x).map((c) => c.s).join(' ')).join('\n');
}
