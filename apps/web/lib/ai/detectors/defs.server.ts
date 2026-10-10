import 'server-only';

import { z } from 'zod';
import { sql } from '@/lib/db';
import { columnExists, tableExists } from '@/lib/db/schema-guard';
import { recordAudit } from '@/lib/audit/audit-log';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';
import { lifecycleIndex } from '@/lib/features/orders/lifecycle';
import { istanbulToday } from '@/lib/features/sales/order-status.server';
import { DOCUMENT_KIND_LABELS, type DocumentKind } from '@/lib/features/fleet/engine';
import { registerDetector } from './runner.server';
import { toneFor, type Tone } from './messages';
import {
  detectCapacity, detectExpiries, detectLateOrders, detectOffcuts, detectOverdue, detectScrapAnomalies, detectShortages, detectStaleQuotes,
  type ExpiryRow, type OrderRow, type ScheduledJob, type ScrapRow, type ShortageRow, type SupplierOption,
} from './rules';

type Row = Record<string, any>;
const day = (v: unknown) => (v ? (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10) : null);
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const OFFICE = ['owner', 'admin', 'office'] as const;
const FINANCE = ['owner', 'admin', 'accountant'] as const;
const MANAGERS = ['owner', 'admin'] as const;
/** Loader caps: when a loader reads its cap, the run is partial and nothing is closed as resolved. */
const LATE_LIMIT = 300;

async function firmName(tenantId: string) {
  const [t] = await sql`SELECT name FROM tenants WHERE id = ${tenantId}`;
  return (t?.name as string) ?? null;
}

/** Tone per customer card: a firm or someone without delivered orders → formal. */
async function tones(tenantId: string, customerIds: Array<string | null>): Promise<Map<string, Tone>> {
  const ids = [...new Set(customerIds.filter((x): x is string => Boolean(x)))];
  const out = new Map<string, Tone>();
  if (!ids.length) return out;
  const rows = await sql`SELECT c.id, c.company_name,
      (SELECT count(*)::int FROM orders o WHERE o.tenant_id = c.tenant_id AND o.customer_id = c.id AND o.status IN ('delivered', 'completed')) AS done
    FROM customers c WHERE c.tenant_id = ${tenantId} AND c.id = ANY(${ids}::uuid[])`;
  for (const r of rows) out.set(String(r.id), toneFor({ isCompany: Boolean(r.company_name), pastOrders: Number(r.done) }));
  return out;
}

/** A "do this" item on a record, made by the assistant on approval (assigned to the approver). */
async function addTodo(tx: any, tenantId: string, entityType: string, entityId: string, title: string, dueOn: string, assigneeId: string, ruleKey: string) {
  if (!(await tableExists('record_activities'))) return null;
  const [a] = await tx`INSERT INTO record_activities (tenant_id, entity_type, entity_id, kind, title, due_on, assignee_id, rule_key, created_by)
    VALUES (${tenantId}, ${entityType}, ${entityId}, 'todo', ${title.slice(0, 200)}, ${dueOn}, ${assigneeId}, ${ruleKey}, ${assigneeId}) RETURNING id`;
  await recordAudit(tx, { tenantId, actorId: assigneeId, entityType, entityId, action: 'activity_planned', changes: { activity: { from: null, to: `${title} · ${dueOn}` } }, metadata: { rule: ruleKey, source: 'assistant' } });
  return String(a.id);
}

/** Records that a message draft was prepared and copied; nothing is sent (no channel is connected). */
async function noteMessage(tx: any, tenantId: string, actorId: string, entityType: string, entityId: string, kind: string, message: string | undefined) {
  await recordAudit(tx, { tenantId, actorId, entityType, entityId, action: 'customer_message_prepared', note: message ? message.slice(0, 2000) : null, metadata: { kind, channel: 'copy', sent: false } });
}

// 1 · Late / risky order -------------------------------------------------------------------------

registerDetector({
  key: 'late_order', label: 'Geciken sipariş', icon: 'AlarmClock', roles: OFFICE, access: { module: 'orders', action: 'edit' }, defaults: { enabled: true, quietDays: 3, threshold: 3 },
  thresholdLabel: 'Termine kaç gün kala uyarsın',
  payloadSchema: z.object({ orderId: z.string().uuid(), newPromiseDate: isoDay, reason: z.string().max(200), message: z.string().max(4000).optional() }),
  editableFields: [{ key: 'newPromiseDate', label: 'Yeni termin (YYYY-AA-GG)', type: 'text' }, { key: 'message', label: 'Müşteriye mesaj', type: 'text' }],
  detect: async (actor, settings) => {
    const today = istanbulToday();
    const promised = await columnExists('orders', 'promised_date');
    const rows = await sql`SELECT o.id, o.order_number, o.customer_id, o.customer_name, o.status, o.delivery_date,
        ${promised ? sql`o.promised_date` : sql`NULL::date AS promised_date`},
        (SELECT max(a.created_at) FROM activity_logs a WHERE a.tenant_id = o.tenant_id AND a.entity_type = 'order' AND a.entity_id = o.id AND a.action = 'status_changed') AS last_move, o.created_at
      FROM orders o WHERE o.tenant_id = ${actor.tenantId} AND o.status NOT IN ('shipped', 'delivered', 'completed', 'cancelled', 'pending', 'new', 'pending_approval')
        AND coalesce(${promised ? sql`o.promised_date` : sql`NULL::date`}, o.delivery_date::date) <= (${today}::date + 10)
      ORDER BY coalesce(${promised ? sql`o.promised_date` : sql`NULL::date`}, o.delivery_date::date) LIMIT ${LATE_LIMIT}`;
    if (!rows.length) return [];
    const { orderShortage } = await import('@/lib/features/stock/depth.server');
    const delays = (await tableExists('production_delays'))
      ? await sql`SELECT w.order_id, d.reason_code, d.expected_until FROM production_delays d JOIN work_orders w ON w.id = d.work_order_id AND w.tenant_id = d.tenant_id
          WHERE d.tenant_id = ${actor.tenantId} AND d.resolved_at IS NULL AND w.order_id = ANY(${rows.map((r: Row) => r.id)}::uuid[])` : [];
    const tone = await tones(actor.tenantId, rows.map((r: Row) => r.customer_id));
    const firm = await firmName(actor.tenantId);
    const input: OrderRow[] = [];
    // Material checks ten at a time; lead times read once for all missing items.
    const shortages = new Map<string, Array<{ itemId: string; missing: number }>>();
    for (let i = 0; i < rows.length; i += 10)
      await Promise.all(rows.slice(i, i + 10).map(async (r: Row) => {
        const s = await orderShortage(actor, String(r.id)).catch(() => ({ lines: [] as Array<{ itemId: string; missing: number }> }));
        shortages.set(String(r.id), s.lines.filter((l: { missing: number }) => l.missing > 0));
      }));
    const missingIds = [...new Set([...shortages.values()].flat().map((l) => l.itemId))];
    const leads = new Map<string, number>();
    if (missingIds.length && (await columnExists('inventory_items', 'lead_time_days')))
      for (const m of await sql`SELECT id, lead_time_days FROM inventory_items WHERE tenant_id = ${actor.tenantId} AND id = ANY(${missingIds}::uuid[]) AND lead_time_days IS NOT NULL`) leads.set(String(m.id), Number(m.lead_time_days));
    for (const r of rows) {
      const missing = shortages.get(String(r.id)) ?? [];
      const known = missing.map((l) => leads.get(l.itemId)).filter((x): x is number => x !== undefined);
      const lead = known.length ? Math.max(...known) : null;
      const d = delays.find((x: Row) => String(x.order_id) === String(r.id));
      input.push({
        id: String(r.id), number: r.order_number, customer: r.customer_name ?? null, tone: (r.customer_id && tone.get(String(r.customer_id))) || 'formal', firm,
        dueOn: day(r.promised_date) ?? day(r.delivery_date), promised: day(r.promised_date), step: lifecycleIndex(String(r.status)),
        lastMoveOn: day(r.last_move) ?? day(r.created_at), missingMaterials: missing.length, materialLeadDays: lead,
        openDelay: d ? { reason: String(d.reason_code), expectedUntil: day(d.expected_until) } : null,
      });
    }
    return { findings: detectLateOrders(input, today, settings), partial: rows.length >= LATE_LIMIT };
  },
  apply: async (tx, actor, p) => {
    if (!(await columnExists('orders', 'promised_date'))) throw new WorkOrderApiError('Söz tarihi için veritabanı güncellemesi (041) bekleniyor', 409);
    const [o] = await tx`SELECT id, promised_date, status FROM orders WHERE tenant_id = ${actor.tenantId} AND id = ${p.orderId} FOR UPDATE`;
    if (!o) throw new WorkOrderApiError('Sipariş bulunamadı', 404);
    if (['delivered', 'completed', 'cancelled'].includes(o.status)) throw new WorkOrderApiError('Sipariş artık açık değil; öneri geçersiz', 409);
    if (p.newPromiseDate < istanbulToday()) throw new WorkOrderApiError('Yeni termin bugünden önce olamaz', 400);
    // version + 1: an order screen open elsewhere sees the change instead of overwriting it.
    await tx`UPDATE orders SET promised_date = ${p.newPromiseDate}, version = version + 1, updated_at = now() WHERE id = ${p.orderId}`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'order', entityId: p.orderId, action: 'promise_changed',
      changes: { 'söz tarihi': { from: day(o.promised_date), to: p.newPromiseDate } }, note: `Asistan önerisi onaylandı: ${p.reason}` });
    await noteMessage(tx, actor.tenantId, actor.userId, 'order', p.orderId, 'late_order', p.message);
    return { orderId: p.orderId, promisedDate: p.newPromiseDate, href: `/orders/${p.orderId}`, message: p.message ?? null };
  },
});

// 2 · Material shortage ---------------------------------------------------------------------------

registerDetector({
  key: 'shortage', label: 'Eksik malzeme', icon: 'PackageX', roles: OFFICE, access: { module: 'purchasing', action: 'create' }, sensitive: ['price', 'cost'], defaults: { enabled: true, quietDays: 3 },
  payloadSchema: z.object({ itemId: z.string().uuid(), quantity: z.coerce.number().positive(), supplierId: z.string().uuid().nullable(), unitPrice: z.number().nullable(), currency: z.string().max(3), lengthMm: z.number().nullable(), color: z.string().nullable() }),
  editableFields: [{ key: 'quantity', label: 'Miktar', type: 'number', min: 0.001 }],
  detect: async (actor) => {
    if (!(await tableExists('work_order_materials'))) return [];
    const t = actor.tenantId;
    const demand = await sql`SELECT m.item_id, sum(greatest(m.required_qty - m.reserved_qty - m.transferred_qty, 0)) AS demand,
        json_agg(json_build_object('id', w.id, 'label', w.title, 'due', w.due_at)) AS jobs
      FROM work_order_materials m JOIN work_orders w ON w.id = m.work_order_id AND w.tenant_id = m.tenant_id
      WHERE m.tenant_id = ${t} AND w.status IN ('open', 'in_progress') GROUP BY m.item_id HAVING sum(greatest(m.required_qty - m.reserved_qty - m.transferred_qty, 0)) > 0 LIMIT 200`;
    if (!demand.length) return [];
    const ids = demand.map((d: Row) => d.item_id);
    const multiple = await columnExists('inventory_items', 'order_multiple');
    const [items, stock, reserved, incoming, last] = await Promise.all([
      sql`SELECT id, name, stock_uom, ${multiple ? sql`order_multiple` : sql`NULL::numeric AS order_multiple`} FROM inventory_items WHERE tenant_id = ${t} AND id = ANY(${ids}::uuid[])`,
      sql`SELECT b.item_id, sum(b.on_hand_qty) AS q FROM stock_balances b JOIN warehouses w ON w.id = b.warehouse_id WHERE b.tenant_id = ${t} AND w.warehouse_type IN ('RAW', 'REUSABLE_REMNANTS') AND b.item_id = ANY(${ids}::uuid[]) GROUP BY b.item_id`,
      sql`SELECT rl.item_id, sum(rl.reserved_qty - rl.consumed_qty - rl.released_qty) AS q FROM stock_reservation_lines rl JOIN stock_reservations rh ON rh.id = rl.reservation_id
        WHERE rl.tenant_id = ${t} AND rh.status = 'active' AND rl.item_id = ANY(${ids}::uuid[]) GROUP BY rl.item_id`,
      sql`SELECT l.item_id, sum(greatest(l.ordered_qty - l.received_qty, 0)) AS q FROM purchase_order_lines l JOIN purchase_orders po ON po.id = l.purchase_order_id AND po.tenant_id = l.tenant_id
        WHERE l.tenant_id = ${t} AND po.status IN ('draft', 'submitted', 'partially_received') AND l.item_id = ANY(${ids}::uuid[]) GROUP BY l.item_id`,
      sql`SELECT DISTINCT ON (l.item_id, po.supplier_id) l.item_id, po.supplier_id, s.name AS supplier_name, l.unit_price, coalesce(po.currency, 'TRY') AS currency, l.metadata, po.created_at
        FROM purchase_order_lines l JOIN purchase_orders po ON po.id = l.purchase_order_id AND po.tenant_id = l.tenant_id JOIN suppliers s ON s.id = po.supplier_id AND s.tenant_id = po.tenant_id
        WHERE l.tenant_id = ${t} AND coalesce(s.is_active, true) AND po.status IN ('submitted', 'partially_received', 'received') AND l.item_id = ANY(${ids}::uuid[])
        ORDER BY l.item_id, po.supplier_id, po.created_at DESC`,
    ]);
    // Supplier scores (on-time %, rejects) from the scorecard, when there is enough history.
    let scores = new Map<string, { score: number | null; lead: number | null }>();
    try {
      const { supplierScorecards } = await import('@/lib/features/stock/depth.server');
      const cards = await supplierScorecards({ ...actor, role: 'owner' } as any);
      scores = new Map(cards.suppliers.map((s: Row) => [String(s.supplierId), { score: s.enoughData ? Number(s.score) : null, lead: s.avgLeadDays === null ? null : Number(s.avgLeadDays) }]));
    } catch { /* no scorecard: price decides */ }
    const q = (rows: Row[], id: string) => Number(rows.find((r) => String(r.item_id) === id)?.q ?? 0);
    const input: ShortageRow[] = demand.map((d: Row) => {
      const id = String(d.item_id);
      const item = items.find((i: Row) => String(i.id) === id);
      const offers = last.filter((l: Row) => String(l.item_id) === id);
      const suppliers: SupplierOption[] = offers.map((l: Row) => ({ supplierId: String(l.supplier_id), name: l.supplier_name, unitPrice: l.unit_price === null ? null : Number(l.unit_price), currency: l.currency, score: scores.get(String(l.supplier_id))?.score ?? null, leadDays: scores.get(String(l.supplier_id))?.lead ?? null }));
      const meta = offers[0]?.metadata ?? {};
      const jobs = (d.jobs as Row[]).filter((j, i, all) => all.findIndex((x) => x.id === j.id) === i).map((j) => ({ id: String(j.id), label: j.label ?? 'İş emri', href: `/work-orders/${j.id}`, dueOn: day(j.due) }));
      return {
        itemId: id, name: item?.name ?? 'Malzeme', uom: item?.stock_uom ?? 'adet', demand: Number(d.demand), free: q(stock, id) - q(reserved, id), incoming: q(incoming, id),
        orderMultiple: item?.order_multiple === null || item?.order_multiple === undefined ? null : Number(item.order_multiple), jobs, suppliers,
        lengthMm: meta.lengthMm ? Number(meta.lengthMm) : null, color: meta.color ?? null,
      };
    });
    return detectShortages(input, istanbulToday());
  },
  apply: async (tx, actor, p, suggestion) => {
    if (!p.supplierId || p.unitPrice === null) {
      // No supplier history: a purchasing task instead of a guessed order.
      const id = await addTodo(tx, actor.tenantId, 'inventory_item', p.itemId, 'Tedarikçi seçip satın alma siparişi açın (asistan: eksik malzeme)', istanbulToday(), actor.userId, 'assistant_shortage');
      return { todoId: id, href: '/purchases' };
    }
    const [w] = await tx`SELECT id FROM warehouses WHERE tenant_id = ${actor.tenantId} AND warehouse_type = 'RAW' AND active ORDER BY created_at LIMIT 1`;
    if (!w) throw new WorkOrderApiError('Hammadde deposu yok; önce depo tanımlayın', 409);
    const { executeProcurement } = await import('@/lib/features/manufacturing/purchasing.service');
    try {
      const po = await executeProcurement(tx, actor as any, 'procurement.purchase.create', {
        supplierId: p.supplierId, currency: p.currency, notes: `Asistan önerisinden taslak (${suggestion.title})`.slice(0, 1000),
        lines: [{ itemId: p.itemId, warehouseId: w.id, quantity: p.quantity, unitPrice: p.unitPrice, ...(p.lengthMm ? { lengthMm: p.lengthMm } : {}), ...(p.color ? { color: p.color } : {}) }],
      }, `ai-detector:${suggestion.id}`);
      return { purchaseOrderId: po.id, number: po.purchase_order_number, href: '/purchases' };
    } catch (error) {
      if (error instanceof WorkOrderApiError && error.status === 400) throw new WorkOrderApiError(`${error.message}. Öneri yenilenecek.`, 409);
      throw error;
    }
  },
});

// 3 · Quote waiting for an answer -----------------------------------------------------------------

registerDetector({
  key: 'stale_quote', label: 'Bekleyen teklif', icon: 'MailQuestion', roles: OFFICE, access: { module: 'quotations', action: 'edit' }, sensitive: ['price'], defaults: { enabled: true, quietDays: 5, threshold: 3 },
  thresholdLabel: 'Kaç gün cevapsız kalınca takip önersin',
  payloadSchema: z.object({ quotationId: z.string().uuid(), step: z.union([z.literal(1), z.literal(2)]), message: z.string().max(4000).optional() }),
  editableFields: [{ key: 'message', label: 'Takip mesajı', type: 'text' }],
  detect: async (actor, settings) => {
    const sent = await columnExists('quotations', 'sent_at');
    const rows = await sql`SELECT q.id, q.quotation_number, q.customer_id, q.customer_name, q.valid_until, q.total_amount, q.currency,
        ${sent ? sql`coalesce(q.sent_at, q.updated_at)` : sql`q.updated_at`} AS sent_on
      FROM quotations q WHERE q.tenant_id = ${actor.tenantId} AND q.status = 'sent' ORDER BY sent_on LIMIT 200`;
    const tone = await tones(actor.tenantId, rows.map((r: Row) => r.customer_id));
    const firm = await firmName(actor.tenantId);
    return detectStaleQuotes(rows.map((r: Row) => ({
      id: String(r.id), number: r.quotation_number, customer: r.customer_name ?? null, tone: (r.customer_id && tone.get(String(r.customer_id))) || 'formal', firm,
      sentOn: day(r.sent_on)!, validUntil: day(r.valid_until), total: Number(r.total_amount), currency: r.currency ?? 'TRY',
    })), istanbulToday(), settings);
  },
  apply: async (tx, actor, p) => {
    const [q] = await tx`SELECT status FROM quotations WHERE tenant_id = ${actor.tenantId} AND id = ${p.quotationId}`;
    if (!q || q.status !== 'sent') throw new WorkOrderApiError('Teklif artık beklemede değil; öneri geçersiz', 409);
    await noteMessage(tx, actor.tenantId, actor.userId, 'quotation', p.quotationId, 'stale_quote', p.message);
    const todo = await addTodo(tx, actor.tenantId, 'quotation', p.quotationId, p.step === 1 ? 'Teklif takibi: müşteriye mesaj gönderildi mi?' : 'Teklif ikinci takip: müşteriyi arayın', istanbulToday(), actor.userId, 'assistant_quote_follow_up');
    return { quotationId: p.quotationId, todoId: todo, href: `/quotations/${p.quotationId}`, message: p.message ?? null };
  },
});

// 4 · Overdue receivable ------------------------------------------------------------------------

registerDetector({
  key: 'overdue_receivable', label: 'Vadesi geçen alacak', icon: 'Wallet', roles: FINANCE, access: { module: 'finance', action: 'view' }, sensitive: ['price'], defaults: { enabled: true, quietDays: 7, threshold: 15 },
  thresholdLabel: 'İkinci hatırlatma kaç gün sonra',
  payloadSchema: z.object({ invoiceId: z.string().uuid(), orderId: z.string().uuid(), step: z.union([z.literal(1), z.literal(2)]), message: z.string().max(4000).optional() }),
  editableFields: [{ key: 'message', label: 'Hatırlatma mesajı', type: 'text' }],
  detect: async (actor, settings) => {
    const { overdueOpenInvoices } = await import('@/lib/features/finance/receivables.server');
    const rows = await overdueOpenInvoices(actor.tenantId);
    const tone = await tones(actor.tenantId, rows.map((r) => r.customerId));
    const firm = await firmName(actor.tenantId);
    return detectOverdue(rows.map((r) => ({
      invoiceId: r.id, number: r.number, orderId: r.orderId, orderNumber: r.orderNumber, customer: r.customer, tone: (r.customerId && tone.get(r.customerId)) || 'formal', firm,
      dueOn: r.dueOn, openAmount: r.open, currency: 'TRY',
    })), istanbulToday(), settings);
  },
  apply: async (tx, actor, p) => {
    const [i] = await tx`SELECT status FROM invoices WHERE tenant_id = ${actor.tenantId} AND id = ${p.invoiceId}`;
    if (!i || i.status !== 'issued') throw new WorkOrderApiError('Fatura artık açık değil; öneri geçersiz', 409);
    await noteMessage(tx, actor.tenantId, actor.userId, 'order', p.orderId, 'payment_reminder', p.message);
    return { invoiceId: p.invoiceId, href: '/finance/receivables', message: p.message ?? null };
  },
});

// 5 · Scrap anomaly -------------------------------------------------------------------------------

registerDetector({
  key: 'scrap_anomaly', label: 'Fire anomalisi', icon: 'TrendingUp', roles: MANAGERS, access: { module: 'production', action: 'edit' }, defaults: { enabled: true, quietDays: 14, threshold: 3 },
  thresholdLabel: 'En az kaç fire olunca baksın',
  payloadSchema: z.object({ dimension: z.enum(['item', 'color', 'worker', 'center']), key: z.string(), label: z.string(), workOrderId: z.string().uuid().nullable(), topReason: z.string().nullable() }),
  detect: async (actor, settings) => {
    if (!(await tableExists('production_scrap_events'))) return [];
    // Each event with its dimensions and its 30-day window (0 = last 30 days, 1..3 = the windows before).
    const ev = await sql`SELECT e.work_order_id, e.item_id, e.reason_code, e.created_by, w.title, w.configuration->>'bodyName' AS color, op.work_center_code AS center,
        i.name AS item_name, u.name AS worker_name, floor(extract(epoch FROM (now() - e.created_at)) / 2592000)::int AS win, e.created_at
      FROM production_scrap_events e JOIN work_orders w ON w.id = e.work_order_id AND w.tenant_id = e.tenant_id
      LEFT JOIN production_operations op ON op.id = e.operation_id LEFT JOIN inventory_items i ON i.id = e.item_id LEFT JOIN users u ON u.id = e.created_by
      WHERE e.tenant_id = ${actor.tenantId} AND e.created_at >= now() - interval '120 days'`;
    const labels = new Map<string, string>((await sql`SELECT code, label FROM production_reason_codes WHERE tenant_id = ${actor.tenantId} AND kind = 'scrap'`).map((r: Row) => [String(r.code), String(r.label)] as [string, string]));
    const dims: Array<[ScrapRow['dimension'], (e: Row) => string | null, (e: Row) => string]> = [
      ['item', (e) => (e.item_id ? String(e.item_id) : null), (e) => e.item_name ?? 'Malzeme'],
      ['color', (e) => e.color ?? null, (e) => `Renk ${e.color}`],
      ['worker', (e) => (e.created_by ? String(e.created_by) : null), (e) => e.worker_name ?? 'Usta'],
      ['center', (e) => e.center ?? null, (e) => e.center],
    ];
    const rows: ScrapRow[] = [];
    for (const [dimension, keyOf, labelOf] of dims) {
      const groups = new Map<string, Row[]>();
      for (const e of ev) { const k = keyOf(e); if (k) groups.set(k, [...(groups.get(k) ?? []), e]); }
      for (const [key, list] of groups) {
        const recent = list.filter((e) => e.win === 0);
        if (!recent.length) continue;
        const reasons = new Map<string, number>();
        for (const e of recent) reasons.set(e.reason_code, (reasons.get(e.reason_code) ?? 0) + 1);
        const top = [...reasons.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
        const latest = [...recent].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
        rows.push({ dimension, key, label: labelOf(list[0]), recent: recent.length, baseline: [1, 2, 3].map((w) => list.filter((e) => e.win === w).length), topReason: top ? labels.get(top) ?? top : null, sampleWorkOrderId: String(latest.work_order_id), sampleLabel: latest.title ?? null });
      }
    }
    return detectScrapAnomalies(rows, settings);
  },
  apply: async (tx, actor, p) => {
    if (!p.workOrderId) return { reviewed: true };
    const todo = await addTodo(tx, actor.tenantId, 'work_order', p.workOrderId, `Fire incelemesi: ${p.label}${p.topReason ? ` · ${p.topReason}` : ''}`, istanbulToday(), actor.userId, 'assistant_scrap_review');
    return { todoId: todo, href: `/work-orders/${p.workOrderId}` };
  },
});

// 6 · Capacity conflict ---------------------------------------------------------------------------

registerDetector({
  key: 'capacity', label: 'Kapasite çakışması', icon: 'CalendarClock', roles: MANAGERS, access: { module: 'production', action: 'edit' }, defaults: { enabled: true, quietDays: 2 },
  payloadSchema: z.object({ lateWorkOrderId: z.string().uuid(), moveWorkOrderId: z.string().uuid().nullable() }),
  detect: async (actor) => {
    if (!(await tableExists('production_operations'))) return [];
    const { schedulingSnapshot, scheduleSnapshot } = await import('@/lib/features/manufacturing/planning.service');
    const inputs = await schedulingSnapshot(sql, actor.tenantId);
    const schedule = scheduleSnapshot(inputs, new Date().toISOString());
    const titles = new Map<string, Row>((await sql`SELECT id, title, priority, due_at FROM work_orders WHERE tenant_id = ${actor.tenantId} AND status IN ('open', 'in_progress', 'blocked')`).map((w: Row) => [String(w.id), w] as [string, Row]));
    // One row per job: its last operation's end, its station, due date and whether the plan is late.
    const jobs = new Map<string, ScheduledJob>();
    for (const t of schedule.tasks as Row[]) {
      const id = String(t.workOrderId ?? '');
      const w = titles.get(id);
      if (!id || !w) continue;
      const end = (t.segments as Row[]).map((s) => String(s.end)).sort().pop() ?? null;
      if (!end) continue;
      const prev = jobs.get(id);
      if (!prev || end > prev.finishAt) jobs.set(id, { workOrderId: id, label: w.title ?? 'İş emri', center: String(t.workCenterCode), dueAt: t.dueAt ?? (w.due_at ? new Date(w.due_at).toISOString() : null), finishAt: end, priority: (w.priority ?? 'medium') as ScheduledJob['priority'], late: Boolean(t.late) || Boolean(prev?.late) });
    }
    return detectCapacity([...jobs.values()]);
  },
  apply: async (tx, actor, p) => {
    const [late] = await tx`SELECT id, priority, status FROM work_orders WHERE tenant_id = ${actor.tenantId} AND id = ${p.lateWorkOrderId} FOR UPDATE`;
    if (!late) throw new WorkOrderApiError('İş emri bulunamadı', 404);
    if (!['open', 'in_progress', 'blocked'].includes(late.status)) throw new WorkOrderApiError('İş emri artık açık değil; öneri geçersiz', 409);
    // Raise to high, never lower a critical job.
    if (late.priority !== 'critical' && late.priority !== 'high') {
      await tx`UPDATE work_orders SET priority = 'high', updated_at = now() WHERE id = ${p.lateWorkOrderId}`;
      await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'work_order', entityId: p.lateWorkOrderId, action: 'priority_changed', changes: { öncelik: { from: late.priority, to: 'high' } }, note: 'Asistan: kapasite çakışması' });
    }
    if (p.moveWorkOrderId) {
      const [move] = await tx`SELECT priority, status FROM work_orders WHERE tenant_id = ${actor.tenantId} AND id = ${p.moveWorkOrderId} FOR UPDATE`;
      if (move && ['open', 'in_progress', 'blocked'].includes(move.status) && (move.priority === 'medium' || move.priority === 'high')) {
        await tx`UPDATE work_orders SET priority = 'low', updated_at = now() WHERE id = ${p.moveWorkOrderId}`;
        await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'work_order', entityId: p.moveWorkOrderId, action: 'priority_changed', changes: { öncelik: { from: move.priority, to: 'low' } }, note: 'Asistan: kapasite çakışması (kayan iş)' });
      }
    }
    return { href: '/production', raised: p.lateWorkOrderId, lowered: p.moveWorkOrderId };
  },
});

// 7 · Document / maintenance expiry ---------------------------------------------------------------

registerDetector({
  key: 'expiry', label: 'Belge / bakım süresi', icon: 'FileClock', roles: MANAGERS, access: { module: 'fleet', action: 'edit' }, defaults: { enabled: true, quietDays: 7, threshold: 15 },
  thresholdLabel: 'Bitişe kaç gün kala hatırlatsın',
  payloadSchema: z.object({ vehicleId: z.string().uuid(), kind: z.string(), dueOn: isoDay }),
  detect: async (actor, settings) => {
    if (!(await tableExists('vehicles'))) return [];
    const docs = await sql`SELECT DISTINCT ON (d.vehicle_id, d.kind) d.vehicle_id, d.kind, d.expires_on, v.plate FROM vehicle_documents d JOIN vehicles v ON v.id = d.vehicle_id
      WHERE d.tenant_id = ${actor.tenantId} AND v.status <> 'sold' AND d.expires_on IS NOT NULL ORDER BY d.vehicle_id, d.kind, d.expires_on DESC`;
    const service = await sql`SELECT DISTINCT ON (m.vehicle_id) m.vehicle_id, m.next_due_on, v.plate FROM vehicle_maintenance m JOIN vehicles v ON v.id = m.vehicle_id
      WHERE m.tenant_id = ${actor.tenantId} AND v.status <> 'sold' ORDER BY m.vehicle_id, m.done_on DESC, m.created_at DESC`;
    const plate = (p: string) => p.replace(/^(\d{2})([A-Z]+)(\d+)$/, '$1 $2 $3');
    const rows: ExpiryRow[] = [
      ...docs.map((d: Row) => ({ vehicleId: String(d.vehicle_id), plate: plate(d.plate), kind: d.kind, kindLabel: DOCUMENT_KIND_LABELS[d.kind as DocumentKind] ?? d.kind, dueOn: day(d.expires_on)!, source: 'document' as const })),
      ...service.filter((m: Row) => m.next_due_on).map((m: Row) => ({ vehicleId: String(m.vehicle_id), plate: plate(m.plate), kind: 'maintenance', kindLabel: 'Bakım', dueOn: day(m.next_due_on)!, source: 'maintenance' as const })),
    ];
    return detectExpiries(rows, istanbulToday(), settings);
  },
  apply: async (tx, actor, p) => {
    const label = p.kind === 'maintenance' ? 'Bakım' : DOCUMENT_KIND_LABELS[p.kind as DocumentKind] ?? p.kind;
    const due = p.dueOn > istanbulToday() ? p.dueOn : istanbulToday();
    const todo = await addTodo(tx, actor.tenantId, 'vehicle', p.vehicleId, `${label} yenile / randevu al`, due, actor.userId, 'assistant_expiry');
    return { todoId: todo, href: `/vehicles/${p.vehicleId}` };
  },
});

// 8 · Offcut use ----------------------------------------------------------------------------------

registerDetector({
  key: 'offcut', label: 'Artık parça fırsatı', icon: 'Recycle', roles: MANAGERS, access: { module: 'production', action: 'edit' }, defaults: { enabled: true, quietDays: 7 },
  payloadSchema: z.object({ workOrderId: z.string().uuid(), lotIds: z.array(z.string().uuid()).min(1) }),
  detect: async (actor) => {
    if (!(await tableExists('stock_lots'))) return [];
    const remnants = await sql`SELECT l.id, l.lot_number, l.item_id, l.metadata->>'color' AS color, l.length_m, l.created_at FROM stock_lots l JOIN warehouses w ON w.id = l.warehouse_id
      WHERE l.tenant_id = ${actor.tenantId} AND l.status = 'available' AND w.warehouse_type = 'REUSABLE_REMNANTS' AND coalesce(l.length_m, 0) > 0 LIMIT 500`;
    if (!remnants.length) return [];
    const jobs = await sql`SELECT id, title, configuration->>'bodyName' AS color, bom_snapshot->'cuts' AS cuts FROM work_orders
      WHERE tenant_id = ${actor.tenantId} AND recipe_id IS NOT NULL AND status IN ('open', 'in_progress') AND cut_plan_id IS NULL AND jsonb_typeof(bom_snapshot->'cuts') = 'array' LIMIT 200`;
    const [pref] = (await tableExists('manufacturing_preferences')) ? await sql`SELECT kerf_mm FROM manufacturing_preferences WHERE tenant_id = ${actor.tenantId}` : [];
    const now = Date.now();
    return detectOffcuts(
      remnants.map((r: Row) => ({ lotId: String(r.id), lotNumber: r.lot_number, itemId: String(r.item_id), color: r.color ?? null, lengthMm: Math.round(Number(r.length_m) * 1000), ageDays: Math.floor((now - Date.parse(r.created_at)) / 86_400_000) })),
      jobs.flatMap((j: Row) => (j.cuts as Row[]).filter((c) => c?.itemId && Number(c.lengthMm) > 0).map((c) => ({ workOrderId: String(j.id), label: j.title ?? 'İş emri', itemId: String(c.itemId), color: j.color ?? null, lengthMm: Number(c.lengthMm), quantity: Math.max(1, Math.round(Number(c.quantity ?? 1))) }))),
      pref ? Number(pref.kerf_mm) : 3,
    );
  },
  apply: async (tx, actor, p) => {
    const lots = await tx`SELECT lot_number FROM stock_lots WHERE tenant_id = ${actor.tenantId} AND id = ANY(${p.lotIds}::uuid[]) AND status = 'available'`;
    if (lots.length !== p.lotIds.length) throw new WorkOrderApiError('Artık parçalardan biri artık uygun değil; öneri yenilenecek', 409);
    const todo = await addTodo(tx, actor.tenantId, 'work_order', p.workOrderId, `Kesimde artık kullan: ${lots.map((l: Row) => l.lot_number).join(', ')}`, istanbulToday(), actor.userId, 'assistant_offcut');
    return { todoId: todo, href: `/work-orders/${p.workOrderId}` };
  },
});
