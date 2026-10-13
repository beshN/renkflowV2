import 'server-only';

import { createHash } from 'node:crypto';
import { z } from 'zod';
import { providerConfig } from '@/lib/ai/providers';
import { sql } from '@/lib/db';
import { columnExists, tableExists } from '@/lib/db/schema-guard';
import { recordAudit } from '@/lib/audit/audit-log';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { resolveMemberAccess } from '@/lib/security/member-access.server';
import { can, type Action, type Module } from '@/lib/security/access-matrix';
import { registerSuggestionKind } from '@/lib/ai/suggestions/kinds';
import { getAiSettings } from '@/lib/ai/gate.server';
import { colorKey } from '@/lib/features/colors/color-spec';
import { istanbulToday } from '@/lib/features/sales/order-status.server';
import { canTransition } from '@/lib/features/orders/transition-rules';
import { parseCommand, type Command } from './parse';
import { comparePlans, explain, releasedMaterial, type PlanJob } from './whatif';

type Row = Record<string, any>;
const day = (v: unknown) => (v ? (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10) : null);
const addDays = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10);
const fold = (s: string) => s.toLocaleLowerCase('tr-TR').replace(/[^a-z0-9çğıöşü ]/g, '').trim();

export type CommandResult =
  | { type: 'preview'; suggestionId: string; version: number; title: string; summary: string; lines: Array<{ label: string; value: string }>; warnings: string[]; source: 'rules' | 'model' }
  | { type: 'choose'; question: string; field: 'customerId'; options: Array<{ value: string; label: string; hint?: string }> }
  | { type: 'list'; title: string; columns: string[]; rows: Array<{ cells: string[]; href?: string }>; empty: string }
  | { type: 'answer'; title: string; lines: Array<{ label: string; value: string }>; note?: string }
  | { type: 'need'; message: string; missing: string[]; examples: string[] }
  | { type: 'denied'; message: string };

const EXAMPLES = ["Ahmet Bey'e 3x4 pergola teklif hazırla antrasit", 'bu hafta geciken işler', '7016 mat kaç çubuk var', "ORD-12'yi öne al", "ORD-12'ye 2 gün ekle", 'RF-1042 nerede', 'yarın teslimatlar', 'kritik stok', 'Kaya İnşaat siparişleri', 'vadesi geçen faturalar', 'yoldaki malzemeler'];
const NEEDS: Record<Exclude<Command['intent'], 'unknown'>, { module: Module; action: Action; what: string }> = {
  quote_draft: { module: 'quotations', action: 'create', what: 'teklif hazırlama' },
  list_late: { module: 'orders', action: 'view', what: 'siparişleri görme' },
  stock_query: { module: 'inventory', action: 'view', what: 'stoğu görme' },
  what_if: { module: 'orders', action: 'view', what: 'siparişleri görme' },
  order_status: { module: 'orders', action: 'view', what: 'siparişleri görme' },
  customer_orders: { module: 'orders', action: 'view', what: 'siparişleri görme' },
  deliveries: { module: 'orders', action: 'view', what: 'siparişleri görme' },
  low_stock: { module: 'inventory', action: 'view', what: 'stoğu görme' },
  overdue_invoices: { module: 'finance', action: 'view', what: 'finansı görme' },
  open_purchases: { module: 'purchasing', action: 'view', what: 'satın almayı görme' },
};

/**
 * One typed or spoken command: rules read it (model only when they cannot, and only when the firm
 * allows the model); the person's own permissions decide what it may do; changes come back as a
 * preview that waits for approval; questions come back as a result card.
 */
export async function runCommand(actor: WorkOrderActor, raw: unknown): Promise<CommandResult> {
  const input = z.object({ text: z.string().trim().min(2).max(500), customerId: z.string().uuid().optional() }).parse(raw);
  let parsed = parseCommand(input.text);
  let source: 'rules' | 'model' = 'rules';
  if (parsed.command.intent === 'unknown' && parsed.missing.length === 0) {
    const ai = await getAiSettings(actor.tenantId);
    if (ai.mode === 'assist' && ai.kvkkAckAt) {
      try {
        const { getAIService, aiAvailable } = await import('@/lib/ai/service');
        if (aiAvailable()) {
          const { tenantPersonalNames } = await import('@/lib/ai/known-names');
          const cmd = await getAIService().parseCommand(input.text, { tenantId: actor.tenantId, userId: actor.userId, feature: 'command.parse' }, await tenantPersonalNames(actor.tenantId));
          if (cmd.intent !== 'unknown') { parsed = { command: cmd, confidence: 'medium', missing: [] }; source = 'model'; }
        }
      } catch {
        // Model refused (budget, KVKK, error): the rules' answer stands.
      }
    }
  }
  const cmd = parsed.command;
  if (cmd.intent === 'unknown') return { type: 'need', message: parsed.missing.length ? `Eksik: ${parsed.missing.join(', ')}.` : 'Bu komutu anlayamadım.', missing: parsed.missing, examples: EXAMPLES };

  const access = await resolveMemberAccess(actor.userId, actor.tenantId);
  const need = NEEDS[cmd.intent];
  // Order-level answers name customers and dates: never for the shop floor (workers use their own job screens).
  if (actor.role === 'worker' && cmd.intent !== 'stock_query' && cmd.intent !== 'low_stock') return { type: 'denied', message: `Bu komut için yetkiniz yok (${need.what}).` };
  if (!access || access.deactivated || !can(access, need.module, need.action)) return { type: 'denied', message: `Bu komut için yetkiniz yok (${need.what}).` };
  const hidePrices = access.hidden.includes('price');
  // Previews wait for approval; only the roles that may approve a command's kind get one.
  const mayApprove = ['owner', 'admin', 'office'].includes(actor.role);

  if (cmd.intent === 'quote_draft') {
    if (!mayApprove) return { type: 'denied', message: 'Teklif taslağını asistanla ofis rolleri hazırlar.' };
    const missing = [!cmd.customer && !input.customerId && 'müşteri', (!cmd.widthMm || !cmd.projectionMm) && 'ölçü (ör. 3x4)'].filter((x): x is string => Boolean(x));
    if (missing.length) return { type: 'need', message: `Teklif için eksik: ${missing.join(', ')}.`, missing, examples: EXAMPLES.slice(0, 1) };
    return quotePreview(actor, cmd, input.customerId, hidePrices, source, access.hidden.includes('cost') || access.hidden.includes('profit'));
  }
  if (cmd.intent === 'list_late') return lateList(actor, cmd.period, hidePrices);
  if (cmd.intent === 'stock_query') return stockAnswer(actor, cmd.color, cmd.item);
  if (cmd.intent === 'order_status') return orderStatus(actor, cmd.order, hidePrices);
  if (cmd.intent === 'customer_orders') return customerOrders(actor, cmd.customer, hidePrices);
  if (cmd.intent === 'deliveries') return deliveries(actor, cmd.period, hidePrices);
  if (cmd.intent === 'low_stock') return lowStock(actor);
  if (cmd.intent === 'overdue_invoices') return overdueInvoiceList(actor, hidePrices);
  if (cmd.intent === 'open_purchases') return openPurchases(actor);
  return whatIf(actor, cmd, mayApprove && can(access, 'orders', 'edit'), source);
}

// Quote draft ---------------------------------------------------------------------------------------

async function quotePreview(actor: WorkOrderActor, cmd: Extract<Command, { intent: 'quote_draft' }>, customerId: string | undefined, hidePrices: boolean, source: 'rules' | 'model', hideProfit = true): Promise<CommandResult> {
  let customer: { id: string | null; name: string };
  if (customerId) {
    const [c] = await sql`SELECT id, full_name, company_name FROM customers WHERE tenant_id = ${actor.tenantId} AND id = ${customerId}`;
    if (!c) throw new WorkOrderApiError('Müşteri bulunamadı', 404);
    customer = { id: String(c.id), name: c.company_name || c.full_name };
  } else {
    const q = fold(cmd.customer!);
    const hits = (await sql`SELECT id, full_name, company_name, phone FROM customers WHERE tenant_id = ${actor.tenantId} AND coalesce(is_active, true) LIMIT 2000`)
      .filter((c: Row) => fold(`${c.full_name ?? ''} ${c.company_name ?? ''}`).includes(q));
    if (hits.length > 1)
      return { type: 'choose', question: `Hangi "${cmd.customer}"?`, field: 'customerId', options: hits.slice(0, 8).map((c: Row) => ({ value: String(c.id), label: c.company_name || c.full_name, hint: c.company_name && c.full_name !== c.company_name ? c.full_name : undefined })) };
    customer = hits.length ? { id: String(hits[0].id), name: hits[0].company_name || hits[0].full_name } : { id: null, name: cmd.customer! };
  }
  const family = cmd.family ?? 'pergola';
  const warnings: string[] = [];
  if (!customer.id) warnings.push(`"${customer.name}" kayıtlı müşterilerde yok; teklif bu adla açılır, müşteri kartı siparişe dönüşte bağlanır.`);
  if (!cmd.color) warnings.push('Renk belirtilmedi; teklifte boş kalır.');
  // Price from the firm's matrix when one recipe is mapped to the family; never a guessed price.
  let unitPrice: number | null = null;
  let priceNote = 'Fiyat matrisi yok; fiyat elle girilecek';
  if ((await tableExists('product_family_recipes')) && (await tableExists('price_matrices'))) {
    const recipes = await sql`SELECT recipe_code FROM product_family_recipes WHERE tenant_id = ${actor.tenantId} AND family = ${family}`;
    if (recipes.length === 1) {
      const { quotePrice } = await import('@/lib/features/products/price-matrix.service');
      const p = await quotePrice(sql, actor.tenantId, { family, variant: String(recipes[0].recipe_code), a: cmd.widthMm!, b: cmd.projectionMm!, options: {} });
      if ('unitPrice' in p && p.status === 'priced') { unitPrice = p.unitPrice; priceNote = 'Fiyat matrisinden'; } else priceNote = 'message' in p && typeof p.message === 'string' ? p.message : 'Bu ölçü matriste yok; fiyat elle girilecek';
    } else if (recipes.length > 1) priceNote = 'Ailenin birden çok reçetesi var; fiyat yapılandırıcıdan seçilecek';
  }
  if (unitPrice === null) warnings.push(priceNote);
  // Price hint from the firm's own accepted quotes (evidence only: the draft keeps the matrix price).
  const hint: Array<{ label: string; value: string }> = [];
  if (!hidePrices) {
    const { getAiSettings, featureOn } = await import('@/lib/ai/gate.server');
    const ai = await getAiSettings(actor.tenantId);
    if (featureOn(ai, 'price_hint')) {
      const { priceHistory } = await import('@/lib/ai/insight/price.server');
      const { suggestPrice } = await import('@/lib/ai/insight/price');
      const { withoutProfit } = await import('@/lib/ai/insight/price.server');
      const s0 = suggestPrice({ areaM2: (cmd.widthMm! / 1000) * (cmd.projectionMm! / 1000), history: await priceHistory(actor.tenantId, family), matrixUnitPrice: unitPrice, floorPercent: ai.profitFloorPercent });
      const s = withoutProfit(s0, hideProfit);
      if (s.basis === 'history') hint.push({ label: 'Fiyat önerisi', value: `${s.suggested!.toLocaleString('tr-TR')} ₺ · ${s.evidence.count} kabul edilmiş benzer teklif, medyan ${s.evidence.medianPerM2!.toLocaleString('tr-TR')} ₺/m² (${s.evidence.minPerM2!.toLocaleString('tr-TR')}–${s.evidence.maxPerM2!.toLocaleString('tr-TR')})` });
      for (const w of s.warnings.filter((x) => /kâr|matristen/.test(x))) warnings.push(w);
    }
  }
  const payload = { customerId: customer.id, customerName: customer.name, family, widthMm: cmd.widthMm!, projectionMm: cmd.projectionMm!, quantity: cmd.quantity ?? 1, color: cmd.color, unitPrice };
  const label = `${family === 'pergola' ? 'Pergola' : family} ${(cmd.widthMm! / 1000).toLocaleString('tr-TR')} × ${(cmd.projectionMm! / 1000).toLocaleString('tr-TR')} m`;
  const { fileSuggestion } = await import('@/lib/ai/suggestions/service');
  const r = await fileSuggestion(sql, actor.tenantId, actor.userId, {
    // The same command the same day is one preview (a repeated or shared command does not pile up drafts).
    dedupeKey: `${actor.userId}:${istanbulToday()}:${createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 32)}`,
    kind: QUOTE_KIND, title: `${customer.name} için teklif taslağı`, rationale: `Komut: ${label}${cmd.color ? `, ${cmd.color}` : ''}, ${payload.quantity} adet.`,
    payload, source: source === 'model' ? 'model' : 'system', model: source === 'model' ? providerConfig('anthropic').model : null, uncertain: warnings.length > 0, uncertaintyNote: warnings.join(' ') || null,
  });
  return {
    type: 'preview', suggestionId: String(r.suggestion.id), version: Number(r.suggestion.version), title: `${customer.name} için teklif taslağı`, source,
    summary: 'Onaylarsanız taslak teklif açılır; müşteriye gönderilmez.',
    lines: [
      { label: 'Müşteri', value: customer.name + (customer.id ? '' : ' (yeni)') }, { label: 'Ürün', value: label }, { label: 'Renk', value: cmd.color ?? '—' }, { label: 'Adet', value: String(payload.quantity) },
      ...(hidePrices ? [] : [{ label: 'Birim fiyat', value: unitPrice === null ? 'elle girilecek' : `${unitPrice.toLocaleString('tr-TR')} ₺ (matris)` }]),
      ...hint,
    ],
    warnings,
  };
}

const QUOTE_KIND = 'command.quote_draft';
registerSuggestionKind({
  kind: QUOTE_KIND, label: 'Komut: teklif taslağı', icon: 'FileText', roles: ['owner', 'admin', 'office'], access: { module: 'quotations', action: 'create' },
  payloadSchema: z.object({ customerId: z.string().uuid().nullable(), customerName: z.string().min(1).max(200), family: z.string(), widthMm: z.number().int().positive(), projectionMm: z.number().int().positive(), quantity: z.number().int().positive(), color: z.string().nullable(), unitPrice: z.number().nullable() }),
  apply: async (tx, actor, p, suggestion) => {
    const { quotationService } = await import('@/lib/features/quotations/service');
    void tx; // the quotation service runs its own transaction (idempotent on the suggestion id)
    const { CreateQuotationSchema } = await import('@/lib/features/quotations/types');
    const q = await quotationService.createQuotation(actor.tenantId, CreateQuotationSchema.parse({
      idempotencyKey: suggestion.id, customerId: p.customerId ?? undefined, customerName: p.customerName,
      items: [{ productName: `${p.family === 'pergola' ? 'Pergola' : p.family} ${p.widthMm / 1000} × ${p.projectionMm / 1000} m`, quantity: p.quantity, unitPrice: p.unitPrice ?? 0, color: p.color ?? undefined, widthMm: p.widthMm, projectionMm: p.projectionMm, description: 'Asistan komutundan taslak' }],
      internalNotes: `Asistan komutu (${suggestion.title})`,
    }), actor.userId);
    return { quotationId: q.id, number: (q as any).quotationNumber ?? null, href: `/quotations/${q.id}` };
  },
});

// Late jobs -------------------------------------------------------------------------------------

async function lateList(actor: WorkOrderActor, period: 'overdue' | 'today' | 'this_week' | 'next_week', hidePrices: boolean): Promise<CommandResult> {
  const today = istanbulToday();
  const dow = (new Date(today + 'T12:00:00Z').getUTCDay() + 6) % 7;
  const [from, to] = period === 'overdue' ? ['1900-01-01', addDays(today, -1)] : period === 'today' ? [today, today] : period === 'this_week' ? ['1900-01-01', addDays(today, 6 - dow)] : [addDays(today, 7 - dow), addDays(today, 13 - dow)];
  const promised = await columnExists('orders', 'promised_date');
  const due = promised ? sql`coalesce(o.promised_date, o.delivery_date::date)` : sql`o.delivery_date::date`;
  const rows = await sql`SELECT o.id, o.order_number, o.customer_name, o.status, o.total_amount, ${due} AS due FROM orders o
    WHERE o.tenant_id = ${actor.tenantId} AND o.status NOT IN ('shipped', 'delivered', 'completed', 'cancelled') AND ${due} BETWEEN ${from}::date AND ${to}::date ORDER BY ${due} LIMIT 50`;
  const title = { overdue: 'Termini geçmiş işler', today: 'Bugün teslim olması gerekenler', this_week: 'Bu hafta termini olan (ya da geçmiş) işler', next_week: 'Gelecek hafta termini olan işler' }[period];
  return {
    type: 'list', title, empty: 'Bu aralıkta açık iş yok.',
    columns: ['Sipariş', 'Müşteri', 'Termin', 'Gün', 'Durum', ...(hidePrices ? [] : ['Tutar'])],
    rows: rows.map((r: Row) => {
      const left = Math.round((Date.parse(day(r.due)! + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86_400_000);
      return { href: `/orders/${r.id}`, cells: [r.order_number, r.customer_name ?? '—', day(r.due)!.split('-').reverse().join('.'), left < 0 ? `${-left} gün geçti` : `${left} gün`, String(r.status), ...(hidePrices ? [] : [`${Number(r.total_amount).toLocaleString('tr-TR')} ₺`])] };
    }),
  };
}

// Order status, a customer's orders, deliveries, low stock (read only) ------------------------------

// The same names the order screens use (components/shared/ui/StatusStepper.tsx), plus the legacy and rare ones.
const STATUS_LABEL: Record<string, string> = {
  new: 'Yeni', pending: 'Yeni', pending_approval: 'Onay Bekliyor', approved: 'Onaylandı', preparing_materials: 'Malzeme Hazırlanıyor', ready_for_production: 'Üretime Hazır',
  in_production: 'Üretimde', quality_check: 'Kalite Kontrol', ready: 'Sevkiyata Hazır', ready_for_shipment: 'Sevkiyata Hazır', shipped: 'Sevk Edildi',
  delivered: 'Teslim Edildi', completed: 'Tamamlandı', on_hold: 'Beklemede', cancelled: 'İptal',
};
const statusLabel = (s: unknown) => STATUS_LABEL[String(s)] ?? String(s);
const dmy = (d: string | null) => (d ? d.split('-').reverse().join('.') : '—');
const tl = (v: unknown) => `${Number(v).toLocaleString('tr-TR')} ₺`;

async function orderStatus(actor: WorkOrderActor, order: string, hidePrices: boolean): Promise<CommandResult> {
  const found = await findOrders(actor.tenantId, order);
  if (!found.length) return { type: 'need', message: `"${order}" numaralı sipariş bulunamadı.`, missing: ['sipariş numarası'], examples: EXAMPLES.slice(5, 6) };
  if (found.length > 1) return { type: 'need', message: `"${order}" birden çok siparişe uyuyor (${found.slice(0, 5).map((o: Row) => o.order_number).join(', ')}); tam numarayı yazın.`, missing: ['sipariş numarası'], examples: [] };
  const promised = await columnExists('orders', 'promised_date');
  const [o] = await sql`SELECT id, order_number, customer_name, product_name, status, delivery_date, total_amount${promised ? sql`, promised_date` : sql``} FROM orders WHERE tenant_id = ${actor.tenantId} AND id = ${found[0].id}`;
  const [w] = await tableExists('work_orders')
    ? await sql`SELECT count(*)::int AS total, count(*) FILTER (WHERE status = 'done')::int AS done, count(*) FILTER (WHERE status = 'blocked')::int AS blocked FROM work_orders WHERE tenant_id = ${actor.tenantId} AND order_id = ${o.id} AND status <> 'cancelled'`
    : [{ total: 0, done: 0, blocked: 0 }];
  const due = day(o.promised_date) ?? day(o.delivery_date);
  const left = due ? Math.round((Date.parse(due + 'T00:00:00Z') - Date.parse(istanbulToday() + 'T00:00:00Z')) / 86_400_000) : null;
  const open = !['shipped', 'delivered', 'completed', 'cancelled'].includes(String(o.status));
  const jobs = Number(w.total) ? `${w.done}/${w.total} iş emri bitti${Number(w.blocked) ? `, ${w.blocked} tanesi engelli` : ''}` : 'iş emri yok';
  return {
    type: 'list', title: `${o.order_number}: ${statusLabel(o.status)}`, empty: '',
    columns: ['Sipariş', 'Müşteri', 'Ürün', 'Termin', 'Kalan', 'Üretim', ...(hidePrices ? [] : ['Tutar'])],
    rows: [{ href: `/orders/${o.id}`, cells: [o.order_number, o.customer_name ?? '—', o.product_name ?? '—', dmy(due), left === null || !open ? '—' : left < 0 ? `${-left} gün geçti` : `${left} gün`, jobs, ...(hidePrices ? [] : [tl(o.total_amount)])] }],
  };
}

async function customerOrders(actor: WorkOrderActor, customer: string, hidePrices: boolean): Promise<CommandResult> {
  const q = fold(customer);
  const rows = (await sql`SELECT id, order_number, customer_name, product_name, status, delivery_date, total_amount FROM orders
    WHERE tenant_id = ${actor.tenantId} AND customer_name IS NOT NULL ORDER BY created_at DESC LIMIT 2000`)
    .filter((r: Row) => fold(String(r.customer_name)).includes(q)).slice(0, 15);
  return {
    type: 'list', title: `${customer} · son siparişler`, empty: `"${customer}" adına sipariş bulunamadı.`,
    columns: ['Sipariş', 'Müşteri', 'Ürün', 'Termin', 'Durum', ...(hidePrices ? [] : ['Tutar'])],
    rows: rows.map((r: Row) => ({ href: `/orders/${r.id}`, cells: [r.order_number, r.customer_name, r.product_name ?? '—', dmy(day(r.delivery_date)), statusLabel(r.status), ...(hidePrices ? [] : [tl(r.total_amount)])] })),
  };
}

async function deliveries(actor: WorkOrderActor, period: 'today' | 'tomorrow' | 'this_week', hidePrices: boolean): Promise<CommandResult> {
  const today = istanbulToday();
  const dow = (new Date(today + 'T12:00:00Z').getUTCDay() + 6) % 7;
  const [from, to] = period === 'today' ? [today, today] : period === 'tomorrow' ? [addDays(today, 1), addDays(today, 1)] : [today, addDays(today, 6 - dow)];
  const promised = await columnExists('orders', 'promised_date');
  const due = promised ? sql`coalesce(o.promised_date, o.delivery_date::date)` : sql`o.delivery_date::date`;
  const rows = await sql`SELECT o.id, o.order_number, o.customer_name, o.product_name, o.status, o.total_amount, ${due} AS due FROM orders o
    WHERE o.tenant_id = ${actor.tenantId} AND o.status NOT IN ('shipped', 'delivered', 'completed', 'cancelled') AND ${due} BETWEEN ${from}::date AND ${to}::date ORDER BY ${due}, o.order_number LIMIT 50`;
  const title = { today: 'Bugün teslim edilecekler', tomorrow: 'Yarın teslim edilecekler', this_week: 'Bu hafta teslim edilecekler' }[period];
  return {
    type: 'list', title, empty: 'Bu aralıkta teslim edilecek açık sipariş yok.',
    columns: ['Sipariş', 'Müşteri', 'Ürün', 'Teslim', 'Durum', ...(hidePrices ? [] : ['Tutar'])],
    rows: rows.map((r: Row) => ({ href: `/orders/${r.id}`, cells: [r.order_number, r.customer_name ?? '—', r.product_name ?? '—', dmy(day(r.due)), statusLabel(r.status), ...(hidePrices ? [] : [tl(r.total_amount)])] })),
  };
}

async function lowStock(actor: WorkOrderActor): Promise<CommandResult> {
  if (!(await tableExists('stock_balances'))) return { type: 'answer', title: 'Kritik stok', lines: [], note: 'Stok bakiyesi bu kurulumda tutulmuyor.' };
  const { unitLabel } = await import('@/lib/features/inventory/vocabulary');
  const rows = await sql`SELECT i.id, i.name, i.stock_uom, i.min_stock, COALESCE(b.qty, 0) AS on_hand, COALESCE(r.qty, 0) AS reserved, COALESCE(b.qty, 0) - COALESCE(r.qty, 0) AS available
    FROM inventory_items i
    LEFT JOIN LATERAL (SELECT SUM(on_hand_qty) AS qty FROM stock_balances WHERE tenant_id = ${actor.tenantId} AND item_id = i.id) b ON true
    LEFT JOIN LATERAL (SELECT SUM(l.reserved_qty - l.consumed_qty - l.released_qty) AS qty FROM stock_reservation_lines l JOIN stock_reservations h ON h.id = l.reservation_id AND h.tenant_id = l.tenant_id
      WHERE l.tenant_id = ${actor.tenantId} AND l.item_id = i.id AND h.status = 'active') r ON true
    WHERE i.tenant_id = ${actor.tenantId} AND i.active AND i.min_stock > 0 AND COALESCE(b.qty, 0) - COALESCE(r.qty, 0) < i.min_stock
    ORDER BY (COALESCE(b.qty, 0) - COALESCE(r.qty, 0)) / i.min_stock, i.name LIMIT 30`;
  const n = (v: unknown) => Number(v).toLocaleString('tr-TR', { maximumFractionDigits: 2 });
  return {
    type: 'list', title: 'Minimum stoğun altındaki malzemeler', empty: 'Minimum stoğun altında malzeme yok.',
    columns: ['Malzeme', 'Kullanılabilir', 'Minimum', 'Eksik', 'Eldeki'],
    rows: rows.map((r: Row) => ({ href: '/inventory', cells: [r.name, `${n(r.available)} ${unitLabel(r.stock_uom)}`, `${n(r.min_stock)} ${unitLabel(r.stock_uom)}`, `${n(Number(r.min_stock) - Number(r.available))} ${unitLabel(r.stock_uom)}`, `${n(r.on_hand)} ${unitLabel(r.stock_uom)}`] })),
  };
}

async function overdueInvoiceList(actor: WorkOrderActor, hidePrices: boolean): Promise<CommandResult> {
  const { overdueOpenInvoices } = await import('@/lib/features/finance/receivables.server');
  const rows = (await overdueOpenInvoices(actor.tenantId)).sort((a, b) => b.daysOverdue - a.daysOverdue).slice(0, 30);
  return {
    type: 'list', title: 'Vadesi geçmiş faturalar', empty: 'Vadesi geçmiş açık fatura yok.',
    columns: ['Fatura', 'Müşteri', 'Vade', 'Gecikme', ...(hidePrices ? [] : ['Açık tutar'])],
    rows: rows.map((r) => ({ href: '/finance/receivables', cells: [r.number, r.customer ?? '—', dmy(r.dueOn), `${r.daysOverdue} gün`, ...(hidePrices ? [] : [tl(r.open)])] })),
  };
}

async function openPurchases(actor: WorkOrderActor): Promise<CommandResult> {
  if (!(await tableExists('purchase_orders'))) return { type: 'answer', title: 'Bekleyen satın almalar', lines: [], note: 'Satın alma siparişi bu kurulumda tutulmuyor.' };
  const today = istanbulToday();
  const rows = await sql`SELECT p.id, p.purchase_order_number, p.status, p.expected_at, s.name AS supplier_name FROM purchase_orders p
    LEFT JOIN suppliers s ON s.id = p.supplier_id AND s.tenant_id = p.tenant_id
    WHERE p.tenant_id = ${actor.tenantId} AND p.status IN ('submitted', 'partially_received') ORDER BY p.expected_at NULLS LAST, p.created_at LIMIT 30`;
  return {
    type: 'list', title: 'Yolda olan ya da gelmesi beklenen satın almalar', empty: 'Bekleyen satın alma yok.',
    columns: ['Satın alma', 'Tedarikçi', 'Beklenen', 'Kalan', 'Durum'],
    rows: rows.map((r: Row) => {
      const due = day(r.expected_at);
      const left = due ? Math.round((Date.parse(due + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86_400_000) : null;
      return { href: '/purchases', cells: [r.purchase_order_number, r.supplier_name ?? '—', dmy(due), left === null ? 'tarih yok' : left < 0 ? `${-left} gün gecikti` : `${left} gün`, r.status === 'partially_received' ? 'Kısmen geldi' : 'Gönderildi'] };
    }),
  };
}

// Stock ---------------------------------------------------------------------------------------------

async function stockAnswer(actor: WorkOrderActor, color: string | null, item: string | null): Promise<CommandResult> {
  if (!(await tableExists('stock_lots'))) return { type: 'answer', title: 'Stok', lines: [], note: 'Çubuk stoğu bu kurulumda tutulmuyor.' };
  const lots = await sql`SELECT l.item_id, i.name, l.metadata->>'color' AS color, l.length_m, l.remaining_qty, coalesce((l.metadata->>'isRemnant')::boolean, false) AS remnant
    FROM stock_lots l JOIN inventory_items i ON i.id = l.item_id JOIN warehouses w ON w.id = l.warehouse_id
    WHERE l.tenant_id = ${actor.tenantId} AND l.status = 'available' AND w.warehouse_type IN ('RAW', 'REUSABLE_REMNANTS') AND l.remaining_qty > 0 LIMIT 20000`;
  const key = color ? colorKey(color) : null;
  const want = item ? fold(item).replace(/profili?$/, '').trim() : null;
  const hits = lots.filter((l: Row) => (!key || (l.color && colorKey(l.color) === key)) && (!want || fold(l.name).includes(want)));
  const groups = new Map<string, { name: string; bars: number; remnants: number; metres: number; lengths: Map<number, number> }>();
  // A lot without a bar length (a count import, a non-profile receipt) is not a bar: left out and said so.
  const unsized = hits.filter((l: Row) => !(Number(l.length_m) > 0)).length;
  for (const l of hits.filter((x: Row) => Number(x.length_m) > 0)) {
    const g = groups.get(l.item_id) ?? { name: l.name, bars: 0, remnants: 0, metres: 0, lengths: new Map() };
    if (l.remnant) g.remnants++; else { g.bars++; const mm = Math.round(Number(l.length_m) * 1000); g.lengths.set(mm, (g.lengths.get(mm) ?? 0) + 1); }
    g.metres += Number(l.remaining_qty);
    groups.set(l.item_id, g);
  }
  const title = `${color ?? item ?? 'Stok'}: ${[...groups.values()].reduce((s, g) => s + g.bars, 0)} çubuk`;
  return {
    type: 'answer', title,
    lines: [...groups.values()].sort((a, b) => b.bars - a.bars).slice(0, 15).map((g) => ({ label: g.name, value: `${g.bars} çubuk (${[...g.lengths.entries()].sort((x, y) => y[1] - x[1] || x[0] - y[0]).map(([mm, n]) => `${n}×${mm.toLocaleString('tr-TR')} mm`).join(', ') || '—'})${g.remnants ? ` + ${g.remnants} artık` : ''} · ${Math.round(g.metres * 10) / 10} m` })),
    note: [groups.size ? null : 'Bu renkte ya da profilde serbest çubuk yok.', unsized ? `${unsized} stok kaydının çubuk boyu yok (ör. sayım içe aktarma); çubuk sayısına katılmadı.` : null].filter(Boolean).join(' ') || undefined,
  };
}

// What-if -----------------------------------------------------------------------------------------

/** Orders a reference names: the exact number (separators ignored), else a number ending in "-<digits>" exactly ("ORD-12" never matches "ORD-112"). */
async function findOrders(tenantId: string, order: string): Promise<Row[]> {
  const ref = order.replace(/\s+/g, '').toUpperCase();
  const compact = ref.replace(/[^A-Z0-9]/g, '');
  let orders = await sql`SELECT id, order_number, status, delivery_date, version FROM orders WHERE tenant_id = ${tenantId}
    AND regexp_replace(upper(order_number), '[^A-Z0-9]', '', 'g') = ${compact} ORDER BY created_at DESC LIMIT 2`;
  const digits = ref.match(/(\d+)$/)?.[1];
  if (!orders.length && digits)
    orders = await sql`SELECT id, order_number, status, delivery_date, version FROM orders WHERE tenant_id = ${tenantId}
      AND order_number ~ ${'[-/ ]0*' + String(Number(digits)) + '$'} ORDER BY created_at DESC LIMIT 6`;
  return orders;
}

async function whatIf(actor: WorkOrderActor, cmd: Extract<Command, { intent: 'what_if' }>, canEdit: boolean, source: 'rules' | 'model'): Promise<CommandResult> {
  const orders = await findOrders(actor.tenantId, cmd.order);
  if (!orders.length) return { type: 'need', message: `"${cmd.order}" numaralı sipariş bulunamadı.`, missing: ['sipariş numarası'], examples: EXAMPLES.slice(3) };
  if (orders.length > 1)
    return { type: 'need', message: `"${cmd.order}" birden çok siparişe uyuyor (${orders.slice(0, 5).map((o: Row) => o.order_number).join(', ')}); tam numarayı yazın.`, missing: ['sipariş numarası'], examples: [] };
  const o = orders[0];
  const orderId = String(o.id);
  const result = await simulate(actor.tenantId, orderId, cmd);
  const text = explain({ scenario: cmd.scenario, orderNumber: o.order_number, days: cmd.days }, result.plan, result.material);
  const lines = [
    ...result.plan.newlyLate.slice(0, 8).map((j) => ({ label: 'Gecikmeye düşer', value: `${j.label}${j.orderNumber ? ` (${j.orderNumber})` : ''}` })),
    ...result.plan.noLongerLate.slice(0, 5).map((j) => ({ label: 'Yetişir hale gelir', value: j.label })),
    ...(result.material?.covered ?? []).slice(0, 5).map((c) => ({ label: 'Malzemesi tamamlanır', value: `${c.label}: ${c.itemName} ${c.covered}` })),
    ...(cmd.scenario === 'delay' && result.newPromise ? [{ label: 'Yeni termin', value: result.newPromise.split('-').reverse().join('.') }] : []),
  ];
  const warnings = result.planned ? [] : ['Bu siparişin planlanmış üretim operasyonu yok; etki yalnız termin ve malzeme üzerinden gösterildi.'];
  if (cmd.scenario === 'cancel' && !canTransition(String(o.status), 'cancelled')) warnings.push(`Sipariş "${o.status}" durumunda; iptal durum makinesince reddedilir.`);
  const openJobs = cmd.scenario === 'cancel' ? Number((await sql`SELECT count(*)::int AS n FROM work_orders WHERE tenant_id = ${actor.tenantId} AND order_id = ${orderId} AND status NOT IN ('done', 'cancelled')`)[0].n) : 0;
  if (openJobs) warnings.push(`Siparişin ${openJobs} açık iş emri var; iptal onayı reddedilir. Önce iş emirlerini kapatın ya da iptal edin (rezerve malzeme orada serbest kalır).`);
  if (!canEdit) return { type: 'answer', title: text, lines, note: 'Uygulamak için sipariş düzenleme yetkisi gerekir; bu yalnız bir önizleme.' };
  const { fileSuggestion } = await import('@/lib/ai/suggestions/service');
  const r = await fileSuggestion(sql, actor.tenantId, actor.userId, {
    dedupeKey: `${actor.userId}:${istanbulToday()}:${orderId}:${o.version}:${cmd.scenario}:${cmd.days ?? ''}`,
    kind: WHATIF_KIND, title: text.split(':')[0], rationale: text,
    payload: { orderId, orderVersion: Number(o.version), scenario: cmd.scenario, days: cmd.days, newPromise: result.newPromise },
    source: source === 'model' ? 'model' : 'system', uncertain: warnings.length > 0, uncertaintyNote: warnings.join(' ') || null,
  });
  return { type: 'preview', suggestionId: String(r.suggestion.id), version: Number(r.suggestion.version), title: text, summary: cmd.scenario === 'expedite' ? 'Onaylarsanız siparişin işleri en öne alınır (öncelik: kritik).' : cmd.scenario === 'delay' ? 'Onaylarsanız siparişin söz tarihi değişir; müşteriye bilgi ayrıca verilir.' : 'Onaylarsanız sipariş durum makinesinden geçerek iptal edilir.', lines, warnings, source };
}

/** The plan before and after the change, from the same scheduler the planning screen uses. */
async function simulate(tenantId: string, orderId: string, cmd: Extract<Command, { intent: 'what_if' }>) {
  const today = istanbulToday();
  const [o] = await sql`SELECT delivery_date${(await columnExists('orders', 'promised_date')) ? sql`, promised_date` : sql``} FROM orders WHERE id = ${orderId}`;
  const base = day(o?.promised_date) ?? day(o?.delivery_date) ?? today;
  const newPromise = cmd.scenario === 'delay' ? addDays(base > today ? base : today, cmd.days ?? 1) : null;
  let plan = { newlyLate: [] as PlanJob[], noLongerLate: [] as PlanJob[], ownLateAfter: false, ownFinish: null as string | null, shifted: [] as Array<PlanJob & { shiftHours: number }> };
  let planned = false;
  if (await tableExists('production_operations')) {
    const { schedulingSnapshot, scheduleSnapshot } = await import('@/lib/features/manufacturing/planning.service');
    const inputs = await schedulingSnapshot(sql, tenantId);
    planned = inputs.operations.some((op: Row) => String(op.order_id) === orderId);
    const changed = {
      ...inputs,
      operations: inputs.operations.flatMap((op: Row) => {
        if (String(op.order_id) !== orderId) return [op];
        if (cmd.scenario === 'cancel') return [];
        if (cmd.scenario === 'expedite') return [{ ...op, priority: 'critical' }];
        return [{ ...op, order_delivery_date: newPromise }];
      }),
    };
    const now = new Date().toISOString();
    const titles = new Map<string, Row>((await sql`SELECT w.id, w.title, w.order_id, o.order_number FROM work_orders w LEFT JOIN orders o ON o.id = w.order_id WHERE w.tenant_id = ${tenantId} AND w.status NOT IN ('done', 'cancelled')`).map((w: Row) => [String(w.id), w] as [string, Row]));
    const jobs = (tasks: Row[]): PlanJob[] => {
      const by = new Map<string, PlanJob>();
      for (const t of tasks) {
        const id = String(t.workOrderId ?? '');
        const w = titles.get(id);
        const end = (t.segments as Row[]).map((s) => String(s.end)).sort().pop();
        if (!id || !end) continue;
        const prev = by.get(id);
        if (!prev || end > prev.finishAt) by.set(id, { workOrderId: id, label: w?.title ?? 'İş emri', orderId: w?.order_id ? String(w.order_id) : null, orderNumber: w?.order_number ?? null, finishAt: end, dueAt: t.dueAt ?? null, late: Boolean(t.late) || Boolean(prev?.late) });
      }
      return [...by.values()];
    };
    plan = comparePlans(jobs(scheduleSnapshot(inputs, now).tasks as Row[]), jobs(scheduleSnapshot(changed, now).tasks as Row[]), orderId);
  }
  let material: ReturnType<typeof releasedMaterial> | undefined;
  if (cmd.scenario === 'cancel' && (await tableExists('work_order_materials'))) {
    const released = await sql`SELECT m.item_id, i.name, sum(m.reserved_qty) AS q FROM work_order_materials m JOIN work_orders w ON w.id = m.work_order_id JOIN inventory_items i ON i.id = m.item_id
      WHERE m.tenant_id = ${tenantId} AND w.order_id = ${orderId} AND m.reserved_qty > 0 GROUP BY m.item_id, i.name`;
    const needs = await sql`SELECT m.work_order_id, w.title, m.item_id, i.name, greatest(m.required_qty - m.reserved_qty - m.transferred_qty, 0) AS missing FROM work_order_materials m
      JOIN work_orders w ON w.id = m.work_order_id JOIN inventory_items i ON i.id = m.item_id
      WHERE m.tenant_id = ${tenantId} AND w.status IN ('open', 'in_progress') AND w.order_id IS DISTINCT FROM ${orderId} AND m.required_qty - m.reserved_qty - m.transferred_qty > 0`;
    material = releasedMaterial(released.map((r: Row) => ({ itemId: String(r.item_id), itemName: r.name, quantity: Number(r.q) })), needs.map((n: Row) => ({ workOrderId: String(n.work_order_id), label: n.title, itemId: String(n.item_id), itemName: n.name, missing: Number(n.missing) })));
  }
  return { plan, material, newPromise, planned };
}

const WHATIF_KIND = 'command.what_if';
registerSuggestionKind({
  kind: WHATIF_KIND, label: 'Komut: ya şöyle olsa?', icon: 'CalendarClock', roles: ['owner', 'admin', 'office'], access: { module: 'orders', action: 'edit' },
  payloadSchema: z.object({ orderId: z.string().uuid(), orderVersion: z.number().int().positive(), scenario: z.enum(['expedite', 'delay', 'cancel']), days: z.number().nullable(), newPromise: z.string().nullable() }),
  apply: async (tx, actor, p) => {
    const [o] = await tx`SELECT id, status, version FROM orders WHERE tenant_id = ${actor.tenantId} AND id = ${p.orderId} FOR UPDATE`;
    if (!o) throw new WorkOrderApiError('Sipariş bulunamadı', 404);
    // The preview was worked out on this version of the order; a changed order needs a new preview.
    if (Number(o.version) !== p.orderVersion) throw new WorkOrderApiError('Sipariş önizlemeden sonra değişti; komutu yeniden çalıştırın.', 409);
    if (p.scenario === 'expedite') {
      const raised = await tx`UPDATE work_orders SET priority = 'critical', updated_at = now() WHERE tenant_id = ${actor.tenantId} AND order_id = ${p.orderId} AND status IN ('open', 'in_progress', 'blocked') RETURNING id`;
      for (const w of raised) await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'work_order', entityId: w.id, action: 'priority_changed', changes: { öncelik: { from: null, to: 'critical' } }, note: 'Asistan: öne al' });
      return { href: `/orders/${p.orderId}`, raised: raised.length };
    }
    if (p.scenario === 'delay') {
      if (!p.newPromise || !(await columnExists('orders', 'promised_date'))) throw new WorkOrderApiError('Söz tarihi için veritabanı güncellemesi (041) bekleniyor', 409);
      await tx`UPDATE orders SET promised_date = ${p.newPromise}, version = version + 1, updated_at = now() WHERE id = ${p.orderId}`;
      await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'order', entityId: p.orderId, action: 'promise_changed', changes: { 'söz tarihi': { from: null, to: p.newPromise } }, note: `Asistan: ${p.days} gün ertele` });
      return { href: `/orders/${p.orderId}`, promisedDate: p.newPromise };
    }
    // The same guards as the order screen: a recipe order's status follows production, and open
    // work orders (with their reserved material and planned time) are closed first, never left behind.
    if ((await tx`SELECT id FROM work_orders WHERE tenant_id = ${actor.tenantId} AND order_id = ${p.orderId} AND recipe_id IS NOT NULL LIMIT 1`).length)
      throw new WorkOrderApiError('Bu siparişin durumu üretim ve sevkiyat kayıtlarından hesaplanır. İlgili operasyon ekranını kullanın.', 409);
    if ((await tx`SELECT id FROM work_orders WHERE tenant_id = ${actor.tenantId} AND order_id = ${p.orderId} AND status NOT IN ('done', 'cancelled') LIMIT 1`).length)
      throw new WorkOrderApiError('Siparişin açık iş emirleri var; önce onları kapatın ya da iptal edin.', 409);
    const { applyOrderStatus } = await import('@/lib/features/sales/order-status.server');
    await applyOrderStatus(tx, { tenantId: actor.tenantId, orderId: p.orderId, from: o.status, to: 'cancelled', actorId: actor.userId, note: 'Asistan: ya şöyle olsa? önizlemesi onaylandı' });
    return { href: `/orders/${p.orderId}`, status: 'cancelled' };
  },
});
