import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sql, withTransaction } from '@/lib/db';
import { columnExists, tableExists } from '@/lib/db/schema-guard';
import { hasPermission } from '@/lib/auth/permissions';
import { recordAudit } from '@/lib/audit/audit-log';
import { createNotification } from '@/lib/notifications/service';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { executeProcurement, requireProcurementRead, requireProcurementWrite } from '@/lib/features/manufacturing/purchasing.service';
import { thresholdRows } from '@/lib/features/inventory/thresholds';
import { available, reorderLevels, thresholdStatus } from '@/lib/features/inventory/reorder';
import { istanbulToday } from '@/lib/features/sales/order-status.server';
import { compareResponses, priceHistory, shortage, supplierScore, type Need } from './engine';

/** Tur D tables (migration 043); before it runs these features answer 409 and the rest is unchanged. */
export const stockDepthAvailable = () => tableExists('purchase_rfqs');
async function requireDepth() {
  if (!(await stockDepthAvailable())) throw new WorkOrderApiError('Satın alma derinliği bu kurulumda henüz etkin değil (veritabanı güncellemesi bekleniyor)', 409);
}
const iso = (d: unknown) => (d ? new Date(d as string).toISOString().slice(0, 10) : null);
const addDays = (day: string, n: number) => new Date(Date.parse(day + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10);
const realDate = (s: string) => { const d = new Date(s + 'T00:00:00Z'); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; };
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(realDate, 'Tarih geçersiz');

// Reorder policy ----------------------------------------------------------------------------------

/** Items with a minimum: stock, what is held and on its way, the policy, the levels and what to do. */
export async function reorderOverview(actor: WorkOrderActor) {
  requireProcurementRead(actor);
  const rows = await thresholdRows(sql, actor.tenantId);
  return {
    policyAvailable: await columnExists('inventory_items', 'max_stock'),
    rows: rows.map((r) => {
      const status = thresholdStatus(r);
      return {
        itemId: r.itemId, sku: r.sku, name: r.name, uom: r.uom, minStock: r.minStock, onHand: r.onHand, reserved: r.reserved,
        available: Math.round(available(r) * 1000) / 1000, incoming: r.incoming, drafted: r.drafted, policy: r.policy ?? null,
        levels: reorderLevels(r), state: status.state,
        suggested: status.state === 'draftable' ? { quantity: status.line.quantity, supplierName: status.supplierName, lengthMm: status.line.lengthMm ?? null } : null,
        reason: status.state === 'unknown' ? status.reason : null,
      };
    }),
  };
}

const PolicySchema = z.object({
  minStock: z.coerce.number().min(0).max(10_000_000),
  maxStock: z.coerce.number().min(0).max(10_000_000).nullable(),
  leadTimeDays: z.coerce.number().int().min(0).max(365).nullable(),
  orderMultiple: z.coerce.number().positive().max(1_000_000).nullable(),
}).strict().refine((p) => p.maxStock == null || p.maxStock >= p.minStock, 'Azami stok asgariden küçük olamaz');

/** The item's reorder policy (stock keepers), with the change in the trail. */
export async function saveReorderPolicy(actor: WorkOrderActor, itemId: string, raw: unknown) {
  if (actor.role === 'worker' || !hasPermission(actor.role, 'inventory.edit')) throw new WorkOrderApiError('Stok politikası değiştirme yetkiniz yok', 403);
  if (!(await columnExists('inventory_items', 'max_stock'))) throw new WorkOrderApiError('Bu kurulumda henüz etkin değil (veritabanı güncellemesi bekleniyor)', 409);
  z.string().uuid().parse(itemId);
  const p = PolicySchema.parse(raw);
  await withTransaction(async (tx: any) => {
    const [before] = await tx`SELECT min_stock, max_stock, lead_time_days, order_multiple FROM inventory_items WHERE tenant_id = ${actor.tenantId} AND id = ${itemId} FOR UPDATE`;
    if (!before) throw new WorkOrderApiError('Stok kalemi bulunamadı', 404);
    await tx`UPDATE inventory_items SET min_stock = ${p.minStock}, max_stock = ${p.maxStock}, lead_time_days = ${p.leadTimeDays}, order_multiple = ${p.orderMultiple}, updated_at = now() WHERE tenant_id = ${actor.tenantId} AND id = ${itemId}`;
    const pairs: Array<[string, unknown, unknown]> = [
      ['asgari', Number(before.min_stock), p.minStock], ['azami', before.max_stock == null ? null : Number(before.max_stock), p.maxStock],
      ['tedarik süresi', before.lead_time_days, p.leadTimeDays], ['sipariş katı', before.order_multiple == null ? null : Number(before.order_multiple), p.orderMultiple],
    ];
    const changes = Object.fromEntries(pairs.filter(([, a, b]) => (a ?? null) !== (b ?? null)).map(([k, a, b]) => [k, { from: a ?? null, to: b ?? null }]));
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'inventory_item', entityId: itemId, action: 'reorder_policy_set', changes });
  });
  return reorderOverview(actor);
}

// Shortage on an order ----------------------------------------------------------------------------

/**
 * Materials an order's configured lines need against what is free: a line with a work order needs
 * what that job lists; a line without one, its quoted bill of materials × quantity.
 */
export async function orderShortage(actor: Pick<WorkOrderActor, 'tenantId'>, orderId: string) {
  const t = actor.tenantId;
  if (!(await columnExists('order_items', 'product_configuration'))) return { lines: [], configured: 0 };
  const items = await sql`SELECT i.id, i.quantity, i.product_configuration,
      (SELECT w.id FROM work_orders w WHERE w.tenant_id = ${t} AND w.order_item_id = i.id AND w.status <> 'cancelled' ORDER BY w.created_at DESC LIMIT 1) AS job_id
    FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.tenant_id = ${t} AND o.id = ${orderId} AND i.product_configuration IS NOT NULL`;
  const needs: Array<{ itemId: string; quantity: number }> = [];
  const jobIds = items.map((i: any) => i.job_id).filter(Boolean);
  const jobMaterials = jobIds.length ? await sql`SELECT work_order_id, item_id, required_qty FROM work_order_materials WHERE tenant_id = ${t} AND work_order_id = ANY(${jobIds}::uuid[])` : [];
  for (const i of items) {
    if (i.job_id) for (const m of jobMaterials.filter((x: any) => x.work_order_id === i.job_id)) needs.push({ itemId: m.item_id, quantity: Number(m.required_qty) });
    else for (const m of i.product_configuration?.bom?.materials ?? []) needs.push({ itemId: m.itemId, quantity: Number(m.quantity) * Number(i.quantity) });
  }
  if (!needs.length) return { lines: [], configured: items.length };
  const ids = [...new Set(needs.map((n) => n.itemId))];
  const [meta, stock, held, incoming] = await Promise.all([
    sql`SELECT id, name, stock_uom FROM inventory_items WHERE tenant_id = ${t} AND id = ANY(${ids}::uuid[])`,
    sql`SELECT b.item_id, sum(b.on_hand_qty) AS qty FROM stock_balances b JOIN warehouses w ON w.id = b.warehouse_id AND w.tenant_id = b.tenant_id
      WHERE b.tenant_id = ${t} AND b.item_id = ANY(${ids}::uuid[]) AND w.warehouse_type IN ('RAW', 'REUSABLE_REMNANTS') GROUP BY b.item_id`,
    sql`SELECT rl.item_id, sum(rl.reserved_qty - rl.consumed_qty - rl.released_qty) AS qty,
        sum(CASE WHEN rh.order_id = ${orderId} OR rh.work_order_id = ANY(${jobIds.length ? jobIds : [randomUUID()]}::uuid[]) THEN rl.reserved_qty - rl.consumed_qty - rl.released_qty ELSE 0 END) AS mine
      FROM stock_reservation_lines rl JOIN stock_reservations rh ON rh.id = rl.reservation_id
      WHERE rl.tenant_id = ${t} AND rh.status = 'active' AND rl.item_id = ANY(${ids}::uuid[]) GROUP BY rl.item_id`,
    sql`SELECT l.item_id, sum(greatest(l.ordered_qty - l.received_qty, 0)) AS qty FROM purchase_order_lines l JOIN purchase_orders po ON po.id = l.purchase_order_id AND po.tenant_id = l.tenant_id
      WHERE l.tenant_id = ${t} AND l.item_id = ANY(${ids}::uuid[]) AND po.status IN ('submitted', 'partially_received') GROUP BY l.item_id`,
  ]);
  const by = (rows: any[], id: string, k = 'qty') => Number(rows.find((r) => r.item_id === id)?.[k] ?? 0);
  const fullNeeds: Need[] = needs.map((n) => {
    const m = meta.find((x: any) => x.id === n.itemId);
    return { ...n, name: m?.name ?? 'Bilinmeyen malzeme', uom: m?.stock_uom ?? '' };
  });
  return {
    configured: items.length,
    lines: shortage(fullNeeds, (id) => ({ onHand: by(stock, id), reservedByOthers: by(held, id) - by(held, id, 'mine'), reservedForThis: by(held, id, 'mine'), incoming: by(incoming, id) })),
  };
}

/** For the order screen (customer data: not for workers). */
export async function orderMaterialStatus(actor: WorkOrderActor, orderId: string) {
  if (actor.role === 'worker' || !hasPermission(actor.role, 'orders.view')) throw new WorkOrderApiError('Sipariş görme yetkiniz yok', 403);
  z.string().uuid().parse(orderId);
  const [o] = await sql`SELECT id FROM orders WHERE tenant_id = ${actor.tenantId} AND id = ${orderId}`;
  if (!o) throw new WorkOrderApiError('Sipariş bulunamadı', 404);
  return orderShortage(actor, orderId);
}

/**
 * After an order is approved: when material is missing, the production lead (or the managers) hear
 * of it, by material name and quantity only. Best effort: never fails the approval.
 */
export async function notifyShortageOnApproval(tenantId: string, orderId: string, actorId: string) {
  try {
    const result = await orderShortage({ tenantId }, orderId);
    const missing = result.lines.filter((l) => l.missing > 0);
    if (!missing.length) return 0;
    const [order] = await sql`SELECT order_number FROM orders WHERE tenant_id = ${tenantId} AND id = ${orderId}`;
    await recordAudit(sql, { tenantId, actorId: null, entityType: 'order', entityId: orderId, action: 'material_shortage', metadata: { lines: missing.map((l) => `${l.name} −${l.missing} ${l.uom}`) } });
    const [pref] = (await columnExists('manufacturing_preferences', 'production_lead_user_id'))
      ? await sql`SELECT production_lead_user_id AS lead FROM manufacturing_preferences WHERE tenant_id = ${tenantId}` : [];
    const people = pref?.lead ? [pref.lead as string] : (await sql`SELECT user_id FROM tenant_members WHERE tenant_id = ${tenantId} AND role IN ('owner', 'admin')`).map((m: any) => m.user_id as string);
    const text = missing.slice(0, 4).map((l) => `${l.name} ${l.missing} ${l.uom}`).join(', ') + (missing.length > 4 ? ` +${missing.length - 4}` : '');
    for (const p of people)
      if (p !== actorId)
        await createNotification(p, tenantId, 'order:updated', `Malzeme eksik: ${order?.order_number ?? 'sipariş'}`, text, { href: '/purchases', entityType: 'order', entityId: orderId })
          .catch((e) => console.error('[stock] shortage notice', e instanceof Error ? e.message : e));
    return missing.length;
  } catch (e) {
    console.error('[stock] shortage check', e instanceof Error ? e.message : e);
    return 0;
  }
}

// Requests for quotation --------------------------------------------------------------------------

const RfqSchema = z.object({
  currency: z.enum(['TRY', 'EUR', 'USD', 'GBP']).default('TRY'),
  dueOn: DATE.optional(),
  notes: z.string().trim().max(2000).optional(),
  supplierIds: z.array(z.string().uuid()).min(1, 'En az bir tedarikçi seçin').max(20),
  lines: z.array(z.object({
    itemId: z.string().uuid(), warehouseId: z.string().uuid(), quantity: z.coerce.number().positive().max(1_000_000),
    lengthMm: z.coerce.number().int().min(100).max(30000).optional(), color: z.string().trim().max(100).default(''),
  })).min(1).max(100),
}).strict();

export async function listRfqs(actor: WorkOrderActor) {
  requireProcurementRead(actor);
  if (!(await stockDepthAvailable())) return { available: false, rfqs: [] };
  const today = istanbulToday();
  const rfqs = await sql`SELECT r.*, po.purchase_order_number FROM purchase_rfqs r LEFT JOIN purchase_orders po ON po.id = r.purchase_order_id
    WHERE r.tenant_id = ${actor.tenantId} ORDER BY r.created_at DESC LIMIT 50`;
  const ids = rfqs.map((r: any) => r.id);
  const [lines, responses, suppliers] = ids.length ? await Promise.all([
    sql`SELECT l.*, i.name AS item_name, i.stock_uom FROM purchase_rfq_lines l JOIN inventory_items i ON i.id = l.item_id WHERE l.tenant_id = ${actor.tenantId} AND l.rfq_id = ANY(${ids}::uuid[]) ORDER BY l.position`,
    sql`SELECT r.*, s.name AS supplier_name FROM purchase_rfq_responses r JOIN suppliers s ON s.id = r.supplier_id WHERE r.tenant_id = ${actor.tenantId} AND r.rfq_id = ANY(${ids}::uuid[])`,
    sql`SELECT id, name FROM suppliers WHERE tenant_id = ${actor.tenantId}`,
  ]) : [[], [], []];
  return {
    available: true,
    rfqs: rfqs.map((r: any) => {
      const own = lines.filter((l: any) => l.rfq_id === r.id).map((l: any) => ({ id: l.id, itemId: l.item_id, itemName: l.item_name, uom: l.stock_uom, quantity: Number(l.quantity), lengthMm: l.length_mm, color: l.color, warehouseId: l.warehouse_id }));
      const answers = responses.filter((x: any) => x.rfq_id === r.id).map((x: any) => ({ supplierId: x.supplier_id, supplierName: x.supplier_name, leadTimeDays: x.lead_time_days, validUntil: iso(x.valid_until), note: x.note, prices: (x.prices as Array<{ lineId: string; unitPrice: number }>).map((p) => ({ lineId: p.lineId, unitPrice: Number(p.unitPrice) })) }));
      return {
        id: r.id, number: r.rfq_number, status: r.status, currency: r.currency, dueOn: iso(r.due_on), notes: r.notes, version: r.version, createdAt: r.created_at,
        suppliers: (r.supplier_ids as string[]).map((id) => ({ id, name: suppliers.find((s: any) => s.id === id)?.name ?? '—' })),
        awardedSupplierId: r.awarded_supplier_id, purchaseOrderNumber: r.purchase_order_number ?? null,
        lines: own, responses: answers, comparison: compareResponses(own.map((l: any) => ({ id: l.id, quantity: l.quantity })), answers, today),
      };
    }),
  };
}

/** A request for prices to several suppliers (sent by the office itself: e-mail sending is not connected). */
export async function createRfq(actor: WorkOrderActor, raw: unknown) {
  requireProcurementWrite(actor);
  await requireDepth();
  const d = RfqSchema.parse(raw);
  const id = await withTransaction(async (tx: any) => {
    const suppliers = await tx`SELECT id FROM suppliers WHERE tenant_id = ${actor.tenantId} AND id = ANY(${d.supplierIds}::uuid[]) AND is_active = true`;
    if (suppliers.length !== new Set(d.supplierIds).size) throw new WorkOrderApiError('Aktif tedarikçi seçin', 400);
    for (const l of d.lines) {
      const [item] = await tx`SELECT stock_uom FROM inventory_items WHERE tenant_id = ${actor.tenantId} AND id = ${l.itemId} AND active = true AND item_type <> 'finished_good'`;
      if (!item) throw new WorkOrderApiError('Satın alınabilir stok kalemi seçin', 400);
      if (item.stock_uom === 'm' && (!l.lengthMm || !l.color)) throw new WorkOrderApiError('Profil için çubuk boyu ve renk gerekli', 400);
      if (!(await tx`SELECT 1 FROM warehouses WHERE tenant_id = ${actor.tenantId} AND id = ${l.warehouseId} AND active = true AND warehouse_type = 'RAW'`).length)
        throw new WorkOrderApiError('Hammadde deposu seçin', 400);
    }
    const number = 'TT-' + Date.now().toString(36).toUpperCase() + '-' + randomUUID().slice(0, 4);
    const [r] = await tx`INSERT INTO purchase_rfqs (tenant_id, rfq_number, currency, due_on, notes, supplier_ids, created_by)
      VALUES (${actor.tenantId}, ${number}, ${d.currency}, ${d.dueOn ?? null}, ${d.notes ?? null}, ${[...new Set(d.supplierIds)]}::uuid[], ${actor.userId}) RETURNING id`;
    for (const [i, l] of d.lines.entries())
      await tx`INSERT INTO purchase_rfq_lines (tenant_id, rfq_id, position, item_id, warehouse_id, quantity, length_mm, color)
        VALUES (${actor.tenantId}, ${r.id}, ${i}, ${l.itemId}, ${l.warehouseId}, ${l.quantity}, ${l.lengthMm ?? null}, ${l.color})`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'purchase_rfq', entityId: r.id, action: 'created', metadata: { number, lines: d.lines.length, suppliers: d.supplierIds.length } });
    return r.id as string;
  });
  return { id, ...(await listRfqs(actor)) };
}

const ResponseSchema = z.object({
  supplierId: z.string().uuid(),
  leadTimeDays: z.coerce.number().int().min(0).max(365).nullable().optional(),
  validUntil: DATE.nullable().optional(),
  note: z.string().trim().max(1000).optional(),
  prices: z.array(z.object({ lineId: z.string().uuid(), unitPrice: z.coerce.number().min(0).max(100_000_000) })).min(1).max(100),
}).strict();

/** A supplier's answer, typed by the office from the supplier's offer (replaces an earlier one). */
export async function recordRfqResponse(actor: WorkOrderActor, rfqId: string, raw: unknown) {
  requireProcurementWrite(actor);
  await requireDepth();
  z.string().uuid().parse(rfqId);
  const d = ResponseSchema.parse(raw);
  await withTransaction(async (tx: any) => {
    const [r] = await tx`SELECT * FROM purchase_rfqs WHERE tenant_id = ${actor.tenantId} AND id = ${rfqId} FOR UPDATE`;
    if (!r) throw new WorkOrderApiError('Teklif isteği bulunamadı', 404);
    if (r.status !== 'open') throw new WorkOrderApiError('Teklif isteği kapandı', 409);
    if (!(r.supplier_ids as string[]).includes(d.supplierId)) throw new WorkOrderApiError('Bu tedarikçiden teklif istenmedi', 400);
    const lineIds = (await tx`SELECT id FROM purchase_rfq_lines WHERE tenant_id = ${actor.tenantId} AND rfq_id = ${rfqId}`).map((l: any) => l.id as string);
    if (d.prices.some((p) => !lineIds.includes(p.lineId))) throw new WorkOrderApiError('Satır bu isteğe ait değil', 400);
    const [before] = await tx`SELECT prices FROM purchase_rfq_responses WHERE rfq_id = ${rfqId} AND supplier_id = ${d.supplierId}`;
    await tx`INSERT INTO purchase_rfq_responses (tenant_id, rfq_id, supplier_id, lead_time_days, valid_until, prices, note, recorded_by)
      VALUES (${actor.tenantId}, ${rfqId}, ${d.supplierId}, ${d.leadTimeDays ?? null}, ${d.validUntil ?? null}, ${JSON.stringify(d.prices)}::text::jsonb, ${d.note ?? null}, ${actor.userId})
      ON CONFLICT (rfq_id, supplier_id) DO UPDATE SET lead_time_days = EXCLUDED.lead_time_days, valid_until = EXCLUDED.valid_until, prices = EXCLUDED.prices, note = EXCLUDED.note, recorded_by = EXCLUDED.recorded_by, recorded_at = now()`;
    await tx`UPDATE purchase_rfqs SET version = version + 1 WHERE id = ${rfqId}`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'purchase_rfq', entityId: rfqId, action: 'response_recorded', metadata: { supplierId: d.supplierId, lines: d.prices.length, replaced: Boolean(before) } });
  });
  return listRfqs(actor);
}

/**
 * Choosing a supplier: its complete, unexpired answer becomes a draft purchase order (the normal
 * purchase command, to be checked and sent as usual); the request closes.
 */
export async function awardRfq(actor: WorkOrderActor, rfqId: string, raw: unknown) {
  requireProcurementWrite(actor);
  await requireDepth();
  z.string().uuid().parse(rfqId);
  const d = z.object({ supplierId: z.string().uuid(), version: z.number().int().positive() }).strict().parse(raw);
  const today = istanbulToday();
  await withTransaction(async (tx: any) => {
    const [r] = await tx`SELECT * FROM purchase_rfqs WHERE tenant_id = ${actor.tenantId} AND id = ${rfqId} FOR UPDATE`;
    if (!r) throw new WorkOrderApiError('Teklif isteği bulunamadı', 404);
    if (r.version !== d.version) throw new WorkOrderApiError('Teklif isteği değişti; güncel hali açın', 409);
    if (r.status !== 'open') throw new WorkOrderApiError('Teklif isteği kapandı', 409);
    const lines = await tx`SELECT * FROM purchase_rfq_lines WHERE tenant_id = ${actor.tenantId} AND rfq_id = ${rfqId} ORDER BY position`;
    const [resp] = await tx`SELECT * FROM purchase_rfq_responses WHERE tenant_id = ${actor.tenantId} AND rfq_id = ${rfqId} AND supplier_id = ${d.supplierId}`;
    if (!resp) throw new WorkOrderApiError('Bu tedarikçinin cevabı yok', 409);
    if (resp.valid_until && iso(resp.valid_until)! < today) throw new WorkOrderApiError('Tedarikçinin teklif süresi dolmuş', 409);
    const prices = resp.prices as Array<{ lineId: string; unitPrice: number }>;
    if (lines.some((l: any) => !prices.some((p) => p.lineId === l.id))) throw new WorkOrderApiError('Tedarikçi her satırı fiyatlamadı', 409);
    const order = await executeProcurement(tx, actor, 'procurement.purchase.create', {
      currency: r.currency, supplierId: d.supplierId, notes: `Teklif isteği ${r.rfq_number}`,
      expectedAt: resp.lead_time_days != null ? addDays(today, Number(resp.lead_time_days)) : undefined,
      lines: lines.map((l: any) => ({ itemId: l.item_id, warehouseId: l.warehouse_id, quantity: Number(l.quantity), unitPrice: Number(prices.find((p) => p.lineId === l.id)!.unitPrice), ...(l.length_mm ? { lengthMm: Number(l.length_mm) } : {}), color: l.color })),
    }, `rfq:${rfqId}`);
    await tx`UPDATE purchase_rfqs SET status = 'awarded', awarded_supplier_id = ${d.supplierId}, purchase_order_id = ${(order as any).id}, version = version + 1 WHERE id = ${rfqId}`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'purchase_rfq', entityId: rfqId, action: 'awarded', metadata: { supplierId: d.supplierId, purchaseOrderId: (order as any).id } });
  });
  return listRfqs(actor);
}

export async function cancelRfq(actor: WorkOrderActor, rfqId: string) {
  requireProcurementWrite(actor);
  await requireDepth();
  await withTransaction(async (tx: any) => {
    const [r] = await tx`UPDATE purchase_rfqs SET status = 'cancelled', version = version + 1 WHERE tenant_id = ${actor.tenantId} AND id = ${rfqId} AND status = 'open' RETURNING rfq_number`;
    if (!r) throw new WorkOrderApiError('Açık teklif isteği bulunamadı', 409);
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'purchase_rfq', entityId: rfqId, action: 'cancelled', metadata: { number: r.rfq_number } });
  });
  return listRfqs(actor);
}

// Supplier scorecard and price history ------------------------------------------------------------

/** Every supplier's record (on time, rejects, lead time) and the prices paid per item over time. */
export async function supplierScorecards(actor: WorkOrderActor) {
  requireProcurementRead(actor);
  const [orders, points] = await Promise.all([
    sql`SELECT po.id, po.supplier_id, s.name AS supplier_name, po.expected_at, po.created_at,
        (SELECT min(gr.received_at) FROM goods_receipts gr WHERE gr.tenant_id = po.tenant_id AND gr.purchase_order_id = po.id AND gr.status = 'submitted') AS first_receipt,
        (SELECT coalesce(sum(gl.accepted_qty), 0) FROM goods_receipt_lines gl JOIN goods_receipts gr ON gr.id = gl.goods_receipt_id WHERE gr.tenant_id = po.tenant_id AND gr.purchase_order_id = po.id AND gr.status = 'submitted') AS accepted,
        (SELECT coalesce(sum(gl.rejected_qty), 0) FROM goods_receipt_lines gl JOIN goods_receipts gr ON gr.id = gl.goods_receipt_id WHERE gr.tenant_id = po.tenant_id AND gr.purchase_order_id = po.id AND gr.status = 'submitted') AS rejected
      FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id AND s.tenant_id = po.tenant_id
      WHERE po.tenant_id = ${actor.tenantId} AND po.status IN ('submitted', 'partially_received', 'received') AND po.created_at >= now() - interval '365 days'`,
    sql`SELECT l.item_id, i.name AS item_name, po.supplier_id, s.name AS supplier_name, coalesce(po.currency, 'TRY') AS currency, l.unit_price, po.created_at, po.purchase_order_number
      FROM purchase_order_lines l JOIN purchase_orders po ON po.id = l.purchase_order_id AND po.tenant_id = l.tenant_id
      JOIN inventory_items i ON i.id = l.item_id JOIN suppliers s ON s.id = po.supplier_id
      WHERE l.tenant_id = ${actor.tenantId} AND po.status IN ('submitted', 'partially_received', 'received') AND l.unit_price IS NOT NULL
      ORDER BY po.created_at DESC LIMIT 2000`,
  ]);
  const bySupplier = new Map<string, { name: string; rows: any[] }>();
  for (const o of orders) bySupplier.set(o.supplier_id, { name: o.supplier_name, rows: [...(bySupplier.get(o.supplier_id)?.rows ?? []), o] });
  return {
    suppliers: [...bySupplier.entries()].map(([id, g]) => ({
      supplierId: id, supplierName: g.name,
      ...supplierScore(g.rows.map((o: any) => ({ expectedAt: iso(o.expected_at), sentAt: new Date(o.created_at).toISOString(), firstReceiptAt: o.first_receipt ? new Date(o.first_receipt).toISOString() : null, accepted: Number(o.accepted), rejected: Number(o.rejected) }))),
    })).sort((a, b) => (b.score ?? -1) - (a.score ?? -1)),
    prices: priceHistory(points.map((p: any) => ({ itemId: p.item_id, itemName: p.item_name, supplierId: p.supplier_id, supplierName: p.supplier_name, currency: p.currency, unitPrice: Number(p.unit_price), at: new Date(p.created_at).toISOString(), orderNumber: p.purchase_order_number }))),
  };
}
