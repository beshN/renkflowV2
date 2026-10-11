import 'server-only';

import { z } from 'zod';
import { sql, withTransaction } from '@/lib/db';
import { hasPermission } from '@/lib/auth/permissions';
import { recordAudit } from '@/lib/audit/audit-log';
import { createNotification } from '@/lib/notifications/service';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import {
  allocatePayments, changeImpact, lineDeliveryStatus, money, planProblem, PRODUCTION_FIELDS, slipDays,
  type LineChange, type LineState,
} from './engine';
import { istanbulToday } from './order-status.server';
import { salesAvailable } from './quotes.server';
import { rebuildConfiguredJob } from '@/lib/features/manufacturing/platform.service';

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tarih YYYY-AA-GG olmalı');
const iso = (d: unknown) => (d ? new Date(d as string).toISOString().slice(0, 10) : null);

/** Customer data: never a worker. Viewing needs orders.view; changing needs orders.edit (plans also accounts). */
function canView(actor: WorkOrderActor) {
  return actor.role !== 'worker' && hasPermission(actor.role, 'orders.view');
}
function requireView(actor: WorkOrderActor) {
  if (!canView(actor)) throw new WorkOrderApiError('Sipariş görme yetkiniz yok', 403);
}
function requireEdit(actor: WorkOrderActor, accounts = false) {
  if (actor.role === 'worker' || !(hasPermission(actor.role, 'orders.edit') || (accounts && actor.role === 'accountant')))
    throw new WorkOrderApiError('Sipariş değiştirme yetkiniz yok', 403);
}
async function requireSales() {
  if (!(await salesAvailable())) throw new WorkOrderApiError('Teklif/sipariş derinliği bu kurulumda henüz etkin değil (veritabanı güncellemesi bekleniyor)', 409);
}
async function lockOrder(tx: any, tenantId: string, id: string) {
  z.string().uuid().parse(id);
  const [o] = await tx`SELECT * FROM orders WHERE tenant_id = ${tenantId} AND id = ${id} FOR UPDATE`;
  if (!o) throw new WorkOrderApiError('Sipariş bulunamadı', 404);
  return o;
}

/** Each line with what was delivered and the work orders behind it. */
async function lineStates(db: any, tenantId: string, orderId: string): Promise<Array<LineState & { configured: boolean; unitPrice: number; totalPrice: number; widthMm: number | null; heightMm: number | null; projectionMm: number | null; color: string | null; notes: string | null }>> {
  // Delivered = deliveries entered here + production shipments marked delivered for the line's work orders.
  const items = await db`SELECT i.*,
      coalesce((SELECT sum(d.quantity) FROM order_deliveries d WHERE d.tenant_id = ${tenantId} AND d.order_item_id = i.id), 0)
      + coalesce((SELECT sum(s.quantity) FROM production_shipments s JOIN work_orders w ON w.id = s.work_order_id AND w.tenant_id = s.tenant_id
          WHERE s.tenant_id = ${tenantId} AND w.order_item_id = i.id AND s.status = 'delivered'), 0) AS delivered
    FROM order_items i WHERE i.order_id = ${orderId} ORDER BY i.created_at, i.id`;
  const jobs = await db`SELECT order_item_id, status, produced_qty FROM work_orders WHERE tenant_id = ${tenantId} AND order_id = ${orderId}`;
  return items.map((i: any) => ({
    orderItemId: i.id, productName: i.product_name, quantity: Number(i.quantity), delivered: Number(i.delivered),
    unitPrice: Number(i.unit_price), totalPrice: Number(i.total_price),
    widthMm: i.width_mm == null ? null : Number(i.width_mm),
    configured: Boolean(i.product_configuration),
    heightMm: i.product_configuration ? (i.mounting_height_mm == null ? null : Number(i.mounting_height_mm)) : i.height_mm == null ? null : Number(i.height_mm),
    projectionMm: i.projection_mm == null ? null : Number(i.projection_mm), color: i.color ?? null, notes: i.notes ?? null,
    workOrders: jobs.filter((j: any) => j.order_item_id === i.id).map((j: any) => ({ status: j.status, producedQty: Number(j.produced_qty ?? 0) })),
  }));
}

/** The order's commercial depth for its screen: promise, lines and deliveries, plan and changes. */
export async function orderSales(actor: WorkOrderActor, id: string) {
  requireView(actor);
  if (!(await salesAvailable())) return { available: false as const };
  z.string().uuid().parse(id);
  const [o] = await sql`SELECT id, status, total_amount, currency, delivery_date, promised_date, delivered_on FROM orders WHERE tenant_id = ${actor.tenantId} AND id = ${id}`;
  if (!o) throw new WorkOrderApiError('Sipariş bulunamadı', 404);
  const today = istanbulToday();
  const [lines, deliveries, plan, [paid], changes] = await Promise.all([
    lineStates(sql, actor.tenantId, id),
    sql`SELECT d.id, d.order_item_id, d.quantity, d.delivered_on, d.note, d.created_at, u.name AS by_name FROM order_deliveries d LEFT JOIN users u ON u.id = d.created_by
      WHERE d.tenant_id = ${actor.tenantId} AND d.order_id = ${id} ORDER BY d.delivered_on, d.created_at`,
    sql`SELECT seq, label, due_on, amount FROM order_payment_plans WHERE tenant_id = ${actor.tenantId} AND order_id = ${id} ORDER BY seq`,
    sql`SELECT coalesce(sum(amount), 0) AS total FROM payments WHERE tenant_id = ${actor.tenantId} AND order_id = ${id} AND currency = ${o.currency}`,
    sql`SELECT c.*, u.name AS by_name, v.name AS decided_name FROM order_change_requests c LEFT JOIN users u ON u.id = c.created_by LEFT JOIN users v ON v.id = c.decided_by
      WHERE c.tenant_id = ${actor.tenantId} AND c.order_id = ${id} ORDER BY c.created_at DESC`,
  ]);
  const installments = plan.map((p: any) => ({ seq: p.seq, label: p.label, dueOn: iso(p.due_on)!, amount: Number(p.amount) }));
  const total = Number(o.total_amount);
  return {
    available: true as const,
    today,
    status: o.status as string,
    currency: o.currency as string,
    totalAmount: total,
    dates: { planned: iso(o.delivery_date), promised: iso(o.promised_date), delivered: iso(o.delivered_on), slipDays: slipDays(iso(o.promised_date), iso(o.delivered_on), today) },
    lines: lines.map((l) => ({ ...l, remaining: money(l.quantity - l.delivered), deliveryStatus: lineDeliveryStatus(l.quantity, l.delivered), workOrders: l.workOrders.length })),
    deliveries: deliveries.map((d: any) => ({ id: d.id, orderItemId: d.order_item_id, quantity: Number(d.quantity), deliveredOn: iso(d.delivered_on), note: d.note, by: d.by_name ?? null })),
    plan: { ...allocatePayments(installments, Number(paid.total), today), mismatch: installments.length ? planProblem(installments, total) : null },
    // A pending request shows its impact as it is now (production may have moved since it was opened).
    changes: changes.map((c: any) => ({ id: c.id, status: c.status, reason: c.reason, changes: c.changes, impact: c.status === 'pending' ? changeImpact(o.status, lines, c.changes) : c.impact, by: c.by_name ?? null, at: c.created_at, decidedBy: c.decided_name ?? null, decidedAt: c.decided_at, decisionNote: c.decision_note })),
  };
}

// Promise -----------------------------------------------------------------------------------------

/** The date promised to the customer; once set, moving it needs a reason (it is what lateness is measured against). */
export async function setPromisedDate(actor: WorkOrderActor, id: string, raw: unknown) {
  requireEdit(actor);
  await requireSales();
  const d = z.object({ date: DATE, reason: z.string().trim().max(500).optional() }).strict().parse(raw);
  await withTransaction(async (tx: any) => {
    const o = await lockOrder(tx, actor.tenantId, id);
    const before = iso(o.promised_date);
    if (before === d.date) return;
    if (before && (d.reason ?? '').length < 3) throw new WorkOrderApiError('Söz verilen tarihi değiştirmek için gerekçe yazın', 400);
    await tx`UPDATE orders SET promised_date = ${d.date}, version = version + 1, updated_at = now() WHERE tenant_id = ${actor.tenantId} AND id = ${id}`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'order', entityId: id, action: 'promise_changed', note: d.reason || null, changes: { 'söz tarihi': { from: before, to: d.date } } });
  });
  return orderSales(actor, id);
}

// Partial delivery --------------------------------------------------------------------------------

const DeliverySchema = z.object({
  deliveredOn: DATE,
  note: z.string().trim().max(500).optional(),
  lines: z.array(z.object({ orderItemId: z.string().uuid(), quantity: z.coerce.number().positive() })).min(1).max(100),
}).strict();

/**
 * Goods handed to the customer, line by line. A line cannot receive more than is left on it; when
 * every line is fully delivered the order's delivery day is noted.
 */
export async function recordDelivery(actor: WorkOrderActor, id: string, raw: unknown) {
  requireEdit(actor);
  await requireSales();
  const d = DeliverySchema.parse(raw);
  if (d.deliveredOn > istanbulToday()) throw new WorkOrderApiError('Teslim tarihi ileri bir gün olamaz', 400);
  await withTransaction(async (tx: any) => {
    const o = await lockOrder(tx, actor.tenantId, id);
    if (['cancelled', 'pending', 'new', 'pending_approval'].includes(o.status)) throw new WorkOrderApiError('Onaylanmamış ya da iptal edilmiş siparişe teslim girilemez', 409);
    const lines = await lineStates(tx, actor.tenantId, id);
    const summary: string[] = [];
    for (const l of d.lines) {
      const line = lines.find((x) => x.orderItemId === l.orderItemId);
      if (!line) throw new WorkOrderApiError('Satır bu siparişte yok', 400);
      const left = money(line.quantity - line.delivered);
      if (l.quantity > left + 1e-9) throw new WorkOrderApiError(`${line.productName}: kalan ${left}, ${l.quantity} teslim edilemez`, 409);
      await tx`INSERT INTO order_deliveries (tenant_id, order_id, order_item_id, quantity, delivered_on, note, created_by)
        VALUES (${actor.tenantId}, ${id}, ${l.orderItemId}, ${l.quantity}, ${d.deliveredOn}, ${d.note ?? null}, ${actor.userId})`;
      line.delivered = money(line.delivered + l.quantity);
      summary.push(`${line.productName} × ${l.quantity}`);
    }
    const complete = lines.every((l) => lineDeliveryStatus(l.quantity, l.delivered) === 'delivered');
    if (complete) await tx`UPDATE orders SET delivered_on = coalesce(delivered_on, ${d.deliveredOn}::date), updated_at = now() WHERE tenant_id = ${actor.tenantId} AND id = ${id}`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'order', entityId: id, action: 'delivery_recorded', note: d.note || null, metadata: { deliveredOn: d.deliveredOn, lines: summary, complete } });
  });
  return orderSales(actor, id);
}

// Payment plan ------------------------------------------------------------------------------------

const PlanSchema = z.object({
  installments: z.array(z.object({ label: z.string().trim().min(1).max(60), dueOn: DATE, amount: z.coerce.number() })).max(24),
}).strict();

/** The plan replaces the old one as a whole and must add up to the order total. An empty plan removes it. */
export async function setPaymentPlan(actor: WorkOrderActor, id: string, raw: unknown) {
  requireEdit(actor, true);
  await requireSales();
  const d = PlanSchema.parse(raw);
  await withTransaction(async (tx: any) => {
    const o = await lockOrder(tx, actor.tenantId, id);
    if (d.installments.length) {
      const problem = planProblem(d.installments, Number(o.total_amount));
      if (problem) throw new WorkOrderApiError(problem, 400);
    }
    const before = await tx`SELECT label, due_on, amount FROM order_payment_plans WHERE tenant_id = ${actor.tenantId} AND order_id = ${id} ORDER BY seq`;
    await tx`DELETE FROM order_payment_plans WHERE tenant_id = ${actor.tenantId} AND order_id = ${id}`;
    for (const [i, p] of d.installments.entries())
      await tx`INSERT INTO order_payment_plans (tenant_id, order_id, seq, label, due_on, amount, created_by) VALUES (${actor.tenantId}, ${id}, ${i + 1}, ${p.label}, ${p.dueOn}, ${money(p.amount)}, ${actor.userId})`;
    const show = (rows: Array<{ label: string; due_on?: unknown; dueOn?: string; amount: unknown }>) => rows.map((r) => `${r.label} ${iso(r.due_on ?? r.dueOn)} ${money(Number(r.amount)).toFixed(2)}`).join(' · ') || null;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'order', entityId: id, action: 'payment_plan_set', changes: { 'ödeme planı': { from: show(before), to: show(d.installments) } } });
  });
  return orderSales(actor, id);
}

// Change orders -----------------------------------------------------------------------------------

const ChangeSchema = z.object({
  reason: z.string().trim().min(3, 'Değişiklik gerekçesi yazın').max(1000),
  lines: z.array(z.object({
    orderItemId: z.string().uuid(),
    quantity: z.coerce.number().int().positive().optional(),
    widthMm: z.coerce.number().positive().max(100000).optional(),
    heightMm: z.coerce.number().positive().max(100000).optional(),
    projectionMm: z.coerce.number().positive().max(100000).optional(),
    color: z.string().trim().min(1).max(80).optional(),
    unitPrice: z.coerce.number().nonnegative().optional(),
    notes: z.string().trim().max(1000).optional(),
  }).strict()).min(1).max(50),
}).strict();

/**
 * A change request on a confirmed order: the production impact is worked out and shown before
 * anyone applies it. A change that cannot be made (closed order, delivered goods) is refused now.
 */
export async function proposeChange(actor: WorkOrderActor, id: string, raw: unknown) {
  requireEdit(actor);
  await requireSales();
  const d = ChangeSchema.parse(raw);
  const changes = d.lines.filter((l) => Object.keys(l).length > 1);
  if (!changes.length) throw new WorkOrderApiError('Değişen bir alan yok', 400);
  const id2 = await withTransaction(async (tx: any) => {
    const o = await lockOrder(tx, actor.tenantId, id);
    const impact = changeImpact(o.status, await lineStates(tx, actor.tenantId, id), changes as LineChange[]);
    if (impact.level === 'block') throw new WorkOrderApiError(impact.reasons.join('; '), 409);
    const [c] = await tx`INSERT INTO order_change_requests (tenant_id, order_id, changes, reason, impact, created_by)
      VALUES (${actor.tenantId}, ${id}, ${JSON.stringify(changes)}::text::jsonb, ${d.reason}, ${JSON.stringify(impact)}::text::jsonb, ${actor.userId}) RETURNING id`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'order', entityId: id, action: 'change_requested', note: d.reason, metadata: { changeId: c.id, impact: impact.level, lines: changes.length } });
    return c.id as string;
  });
  return { id: id2, ...(await orderSales(actor, id)) };
}

const DecideSchema = z.object({
  decision: z.enum(['apply', 'reject']),
  acknowledgeImpact: z.boolean().optional(),
  note: z.string().trim().max(1000).optional(),
}).strict();

const FIELD_COLUMNS: Record<string, string> = { quantity: 'quantity', widthMm: 'width_mm', heightMm: 'height_mm', projectionMm: 'projection_mm', color: 'color', unitPrice: 'unit_price', notes: 'notes' };
const FIELD_LABELS: Record<string, string> = { quantity: 'adet', widthMm: 'genişlik', heightMm: 'yükseklik', projectionMm: 'açılım', color: 'renk', unitPrice: 'birim fiyat', notes: 'not' };

/**
 * Applies or rejects a pending change. The impact is worked out again at that moment (production may
 * have moved on); a warning must be acknowledged. Applying rewrites the lines, scales the order total
 * by the lines' change (keeping its discount and VAT share), leaves a field-by-field trace and tells
 * the people on the affected work orders, without prices or customer.
 */
export async function decideChange(actor: WorkOrderActor, orderId: string, changeId: string, raw: unknown) {
  requireEdit(actor);
  await requireSales();
  const d = DecideSchema.parse(raw);
  z.string().uuid().parse(changeId);
  const notices: Array<{ userId: string; title: string; message: string; workOrderId: string }> = [];
  await withTransaction(async (tx: any) => {
    // The firm's production lock first, as production commands take it: applying may rebuild a work
    // order, and nothing may start on it meanwhile (same lock order, no deadlock).
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${actor.tenantId},0))`;
    const o = await lockOrder(tx, actor.tenantId, orderId);
    const [c] = await tx`SELECT * FROM order_change_requests WHERE tenant_id = ${actor.tenantId} AND order_id = ${orderId} AND id = ${changeId} FOR UPDATE`;
    if (!c) throw new WorkOrderApiError('Değişiklik talebi bulunamadı', 404);
    if (c.status !== 'pending') throw new WorkOrderApiError('Bu talep zaten sonuçlandı', 409);
    if (d.decision === 'reject') {
      await tx`UPDATE order_change_requests SET status = 'rejected', decided_by = ${actor.userId}, decided_at = now(), decision_note = ${d.note ?? null} WHERE id = ${changeId}`;
      await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'order', entityId: orderId, action: 'change_rejected', note: d.note || null, metadata: { changeId } });
      return;
    }
    const lines = await lineStates(tx, actor.tenantId, orderId);
    const changes = c.changes as LineChange[];
    const impact = changeImpact(o.status, lines, changes);
    if (impact.level === 'block') throw new WorkOrderApiError(impact.reasons.join('; '), 409);
    if (impact.level === 'warn' && !d.acknowledgeImpact) throw new WorkOrderApiError(`Üretim etkisini onaylayın: ${impact.reasons.join('; ')}`, 409);
    const trace: Record<string, { from: unknown; to: unknown }> = {};
    const bomPending: string[] = [];
    let linesBefore = 0;
    let linesAfter = 0;
    for (const line of lines) linesBefore += line.totalPrice;
    linesAfter = linesBefore;
    for (const ch of changes) {
      const line = lines.find((l) => l.orderItemId === ch.orderItemId)!;
      const next = { ...line, ...Object.fromEntries(Object.entries(ch).filter(([k, v]) => k !== 'orderItemId' && v !== undefined)) } as typeof line & LineChange;
      for (const [field, column] of Object.entries(FIELD_COLUMNS)) {
        const to = (ch as any)[field];
        if (to === undefined) continue;
        const from = (line as any)[field];
        if (from === to) continue;
        trace[`${line.productName} ${FIELD_LABELS[field]}`] = { from, to };
        // A configured product's height is its mounting height (what its recipe reads).
        const target = field === 'heightMm' && line.configured ? 'mounting_height_mm' : column;
        await tx`UPDATE order_items SET ${tx(target)} = ${to} WHERE order_id = ${orderId} AND id = ${line.orderItemId}`;
      }
      // Only quantity or price move the line total, and the line keeps its discount (the stored total
      // is already discounted): it scales with quantity × unit price. Colour or measure alone leave it.
      const listBefore = line.quantity * line.unitPrice;
      const listAfter = Number(next.quantity) * Number(next.unitPrice);
      const repriced = ch.quantity !== undefined || ch.unitPrice !== undefined;
      const lineTotal = !repriced ? line.totalPrice : listBefore > 0 ? money(line.totalPrice * (listAfter / listBefore)) : money(listAfter);
      if (repriced && Math.abs(lineTotal - line.totalPrice) > 0.004) {
        await tx`UPDATE order_items SET total_price = ${lineTotal} WHERE order_id = ${orderId} AND id = ${line.orderItemId}`;
        linesAfter = linesAfter - line.totalPrice + lineTotal;
      }
      if (PRODUCTION_FIELDS.some((f) => ch[f] !== undefined)) {
        // A configured line gets its bill of materials again; an unstarted work order is rebuilt with it.
        const rebuild = await rebuildConfiguredJob(tx, actor, line.orderItemId, o.currency);
        if (rebuild.rebuilt && rebuild.workOrderId) trace[`${line.productName} iş emri`] = { from: rebuild.replaced ?? null, to: rebuild.workOrderId };
        if (!rebuild.rebuilt && rebuild.reason) bomPending.push(`${line.productName}: ${rebuild.reason}`);
        // Everyone on the line's work order hears of it: its owner and the people on its steps.
        const jobs = await tx`SELECT DISTINCT w.id, w.title, u.assigned_to FROM work_orders w
          CROSS JOIN LATERAL (SELECT w.assigned_to UNION SELECT p.assigned_to FROM production_operations p WHERE p.tenant_id = w.tenant_id AND p.work_order_id = w.id AND p.status <> 'cancelled') u(assigned_to)
          WHERE w.tenant_id = ${actor.tenantId} AND w.order_item_id = ${line.orderItemId} AND w.status <> 'cancelled' AND u.assigned_to IS NOT NULL`;
        const what = PRODUCTION_FIELDS.filter((f) => ch[f] !== undefined).map((f) => FIELD_LABELS[f]).join(', ');
        const message = rebuild.rebuilt && rebuild.workOrderId ? `${what} değişti; iş emri yeni ölçüyle yeniden açıldı.` : `${what} değişti. Kesime devam etmeden önce iş emrini kontrol edin.`;
        for (const j of jobs) if (j.assigned_to) notices.push({ userId: j.assigned_to, workOrderId: j.id, title: `İş emri değişti: ${j.title}`, message });
      }
    }
    const oldTotal = Number(o.total_amount);
    const newTotal = linesBefore > 0 ? money(oldTotal * (linesAfter / linesBefore)) : money(oldTotal + (linesAfter - linesBefore));
    if (Math.abs(newTotal - oldTotal) > 0.004) trace['sipariş tutarı'] = { from: oldTotal, to: newTotal };
    await tx`UPDATE orders SET total_amount = ${newTotal}, version = version + 1, updated_at = now() WHERE tenant_id = ${actor.tenantId} AND id = ${orderId}`;
    await tx`UPDATE order_change_requests SET status = 'applied', decided_by = ${actor.userId}, decided_at = now(), decision_note = ${d.note ?? null}, impact = ${JSON.stringify({ ...impact, reasons: [...impact.reasons, ...bomPending.map((p) => `Rework gerekli · ${p}`)] })}::text::jsonb WHERE id = ${changeId}`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'order', entityId: orderId, action: 'change_applied', note: d.note || c.reason, changes: trace, metadata: { changeId, impact: impact.level, reasons: impact.reasons, bomPending } });
  });
  for (const n of notices)
    if (n.userId !== actor.userId)
      await createNotification(n.userId, actor.tenantId, 'order:updated', n.title, n.message, { href: `/work-orders/${n.workOrderId}`, entityType: 'work_order', entityId: n.workOrderId })
        .catch((e) => console.error('[sales] change notice', e instanceof Error ? e.message : e));
  return orderSales(actor, orderId);
}
