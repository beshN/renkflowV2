import 'server-only';

import { z } from 'zod';
import { sql, withTransaction } from '@/lib/db';
import { columnExists, tableExists } from '@/lib/db/schema-guard';
import { recordAudit } from '@/lib/audit/audit-log';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { resolveMemberAccess } from '@/lib/security/member-access.server';
import { can } from '@/lib/security/access-matrix';
import { istanbulToday } from '@/lib/features/sales/order-status.server';
import { registerDetector, detectorKind } from './runner.server';
import { addTodo } from './defs.server';
import { colorIssues, customerIssues, todoIssues, type FieldChange, type QualityPayload } from './quality';

type Row = Record<string, any>;
const CLOSED = ['shipped', 'delivered', 'completed', 'cancelled'];
const Change = z.object({ table: z.enum(['customers', 'order_items', 'quotation_items']), id: z.string().uuid(), column: z.enum(['is_active', 'phone', 'full_name', 'color']), from: z.union([z.string(), z.boolean(), z.null()]), to: z.union([z.string(), z.boolean(), z.null()]) });
// Which columns each table may have changed (the payload is checked against this, not trusted).
const ALLOWED: Record<FieldChange['table'], FieldChange['column'][]> = { customers: ['is_active', 'phone', 'full_name'], order_items: ['color'], quotation_items: ['color'] };

/** A fix touches order or quote lines too: the person needs those rights, not only customer edit. */
async function requireFixRights(actor: { tenantId: string; userId: string; role: string }, changes: FieldChange[]) {
  const access = await resolveMemberAccess(actor.userId, actor.tenantId);
  const need: Array<['customers' | 'orders' | 'quotations', 'edit']> = [...new Set(changes.map((c) => (c.table === 'customers' ? 'customers' : c.table === 'order_items' ? 'orders' : 'quotations')))].map((m) => [m, 'edit']);
  if (!access || access.deactivated || !['owner', 'admin', 'office'].includes(actor.role) || !need.every(([m, a]) => can(access, m, a)))
    throw new WorkOrderApiError('Bu düzeltme için yetkiniz yok', 403);
}

/** Every change applies only if the value is still what the finding saw; otherwise nothing changes. */
async function applyChanges(tx: any, tenantId: string, changes: FieldChange[], direction: 'forward' | 'back') {
  for (const c of changes) {
    if (!ALLOWED[c.table].includes(c.column)) throw new WorkOrderApiError('Geçersiz düzeltme', 400);
    const [expect, set] = direction === 'forward' ? [c.from, c.to] : [c.to, c.from];
    const scope = c.table === 'customers' ? sql`tenant_id = ${tenantId}`
      : c.table === 'order_items' ? sql`order_id IN (SELECT id FROM orders WHERE tenant_id = ${tenantId})` : sql`tenant_id = ${tenantId}`;
    const [row] = await tx`SELECT ${tx(c.column)} AS v FROM ${tx(c.table)} WHERE id = ${c.id} AND ${scope} FOR UPDATE`;
    if (!row) throw new WorkOrderApiError('Kayıt bulunamadı', 404);
    if (row.v !== expect) throw new WorkOrderApiError('Kayıt bu arada değişmiş; düzeltme uygulanmadı.', 409);
    await tx`UPDATE ${tx(c.table)} SET ${tx(c.column)} = ${set} WHERE id = ${c.id}`;
  }
}

registerDetector({
  key: 'data_quality', label: 'Veri kalitesi', icon: 'ShieldCheck', roles: ['owner', 'admin', 'office'], access: { module: 'customers', action: 'edit' }, defaults: { enabled: true, quietDays: 30 },
  payloadSchema: z.object({ issue: z.enum(['duplicate_customer', 'phone_format', 'name_spelling', 'color_spelling', 'zero_price', 'unit_mismatch']), changes: z.array(Change).max(200), todo: z.object({ entityType: z.string(), entityId: z.string().uuid(), title: z.string() }).nullable() }),
  detect: async (actor) => {
    const active = await columnExists('customers', 'is_active');
    const customers = await sql`SELECT c.id, c.full_name, c.phone, c.email, ${active ? sql`c.is_active` : sql`true`} AS active, c.created_at,
      (SELECT count(*)::int FROM orders o WHERE o.tenant_id = c.tenant_id AND o.customer_id = c.id) AS orders
      FROM customers c WHERE c.tenant_id = ${actor.tenantId} ORDER BY c.created_at LIMIT 2000`;
    const items = await sql`SELECT 'order_items' AS t, oi.id, o.id AS parent, o.order_number AS label, oi.color FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.tenant_id = ${actor.tenantId} AND o.status <> ALL(${CLOSED}) AND oi.color IS NOT NULL AND oi.color <> ''
      UNION ALL SELECT 'quotation_items', qi.id, q.id, q.quotation_number, qi.color FROM quotation_items qi JOIN quotations q ON q.id = qi.quotation_id
        WHERE q.tenant_id = ${actor.tenantId} AND q.status = 'draft' AND qi.color IS NOT NULL AND qi.color <> '' LIMIT 3000`;
    const zero = await sql`SELECT q.id, q.quotation_number, count(*)::int AS n FROM quotations q JOIN quotation_items qi ON qi.quotation_id = q.id
      WHERE q.tenant_id = ${actor.tenantId} AND q.status = 'sent' AND qi.unit_price = 0 GROUP BY q.id LIMIT 100`;
    const units = (await tableExists('purchase_order_lines')) ? await sql`SELECT DISTINCT po.id, po.purchase_order_number, i.name, l.uom, i.stock_uom FROM purchase_order_lines l
      JOIN purchase_orders po ON po.id = l.purchase_order_id JOIN inventory_items i ON i.id = l.item_id
      WHERE l.tenant_id = ${actor.tenantId} AND po.status IN ('draft', 'submitted', 'partially_received') AND i.stock_uom IS NOT NULL AND l.uom <> i.stock_uom LIMIT 100` : [];
    const findings = [
      // Without the active flag (older databases) a duplicate cannot be set aside reversibly: not suggested.
      ...customerIssues(customers.map((c: Row) => ({ id: String(c.id), name: c.full_name ?? '', phone: c.phone, email: c.email, active: c.active !== false, orders: Number(c.orders), createdAt: new Date(c.created_at).toISOString() }))).filter((f) => active || f.payload.issue !== 'duplicate_customer'),
      ...colorIssues(items.map((r: Row) => ({ table: r.t, id: String(r.id), parentId: String(r.parent), parentLabel: r.label, color: r.color }))),
      ...todoIssues(zero.map((z: Row) => ({ quotationId: String(z.id), number: z.quotation_number, lines: z.n })), units.map((u: Row) => ({ poId: String(u.id), number: u.purchase_order_number, itemName: u.name, lineUom: u.uom, itemUom: u.stock_uom }))),
    ];
    return { findings: findings.slice(0, 40), partial: customers.length >= 2000 || items.length >= 3000 || findings.length > 40 };
  },
  apply: async (tx, actor, p) => {
    if (p.todo) {
      const id = await addTodo(tx, actor.tenantId, p.todo.entityType, p.todo.entityId, p.todo.title, istanbulToday(), actor.userId, `assistant_quality_${p.issue}`);
      return { todoId: id };
    }
    await requireFixRights(actor, p.changes as FieldChange[]);
    await applyChanges(tx, actor.tenantId, p.changes as FieldChange[], 'forward');
    for (const c of p.changes) await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: c.table === 'customers' ? 'customer' : c.table, entityId: c.id, action: 'data_quality_fixed', changes: { [c.column]: { from: c.from, to: c.to } }, metadata: { issue: p.issue, reversible: true } });
    return { changed: p.changes.length, undoable: true };
  },
});

/** Undo an approved data fix: each value goes back only if it still holds what the fix wrote. */
export async function undoQualityFix(actor: WorkOrderActor, suggestionId: string) {
  z.string().uuid().parse(suggestionId);
  return withTransaction(async (tx: any) => {
    const [s] = await tx`SELECT id, kind, status, payload, result FROM ai_suggestions WHERE tenant_id = ${actor.tenantId} AND id = ${suggestionId} FOR UPDATE`;
    if (!s || s.kind !== detectorKind('data_quality')) throw new WorkOrderApiError('Düzeltme bulunamadı', 404);
    if (s.status !== 'approved' || !s.result?.undoable) throw new WorkOrderApiError('Bu öneri geri alınabilir bir düzeltme değil', 409);
    if (s.result?.undoneAt) throw new WorkOrderApiError('Bu düzeltme zaten geri alındı', 409);
    const p = s.payload as QualityPayload;
    await requireFixRights(actor, p.changes);
    await applyChanges(tx, actor.tenantId, p.changes, 'back');
    for (const c of p.changes) await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: c.table === 'customers' ? 'customer' : c.table, entityId: c.id, action: 'data_quality_undone', changes: { [c.column]: { from: c.to, to: c.from } }, metadata: { issue: p.issue, suggestionId } });
    await tx`UPDATE ai_suggestions SET result = result || ${JSON.stringify({ undoneAt: new Date().toISOString(), undoneBy: actor.userId })}::text::jsonb WHERE id = ${suggestionId}`;
    return { undone: p.changes.length };
  });
}

/** Recently applied fixes that can still be undone (settings → Asistan → Veri kalitesi). */
export async function recentQualityFixes(actor: WorkOrderActor) {
  const rows = await sql`SELECT id, title, decided_at, result FROM ai_suggestions WHERE tenant_id = ${actor.tenantId} AND kind = ${detectorKind('data_quality')} AND status = 'approved'
    AND (result->>'undoable')::boolean IS TRUE AND decided_at > now() - interval '30 days' ORDER BY decided_at DESC LIMIT 20`;
  return rows.map((r: Row) => ({ id: String(r.id), title: r.title, decidedAt: new Date(r.decided_at).toISOString(), undone: Boolean(r.result?.undoneAt) }));
}
