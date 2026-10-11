import 'server-only';

import { z } from 'zod';
import { sql } from '@/lib/db';
import { tableExists } from '@/lib/db/schema-guard';
import { applyOrderStatus } from '@/lib/features/sales/order-status.server';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';
import { registerSuggestionKind } from '../kinds';

export const MARK_DELIVERED_KIND = 'installation.mark_delivered';

const PayloadSchema = z.object({ orderId: z.string().uuid(), installationId: z.string().uuid() });
type Payload = z.infer<typeof PayloadSchema>;

/** Order statuses from which "delivered" is an allowed step (the state machine's rule). */
export const DELIVERABLE_FROM = ['ready', 'ready_for_shipment', 'shipped'];

/**
 * Files the suggestion for one installation's order when the order can take that step. One per
 * order (dedupe key); a rejected one is not filed again.
 */
export async function fileDeliveredSuggestion(tenantId: string, installationId: string, actorId: string | null, why: string | null) {
  const [r] = await sql`SELECT i.installation_number, i.signed_name, o.id AS order_id, o.order_number, o.status FROM installations i
    JOIN orders o ON o.id = i.order_id AND o.tenant_id = i.tenant_id WHERE i.tenant_id = ${tenantId} AND i.id = ${installationId} AND i.status = 'done'`;
  // Not deliverable yet (production not finished): refresh files it once it is.
  if (!r || !DELIVERABLE_FROM.includes(r.status)) return;
  const { fileSuggestion } = await import('../service');
  const done = `Montaj ${r.installation_number} tamamlandı${r.signed_name ? ` ve müşteri "${r.signed_name}" adıyla imzaladı` : ''}.`;
  await fileSuggestion(sql, tenantId, actorId, {
    kind: MARK_DELIVERED_KIND,
    title: `${r.order_number} teslim edildi olarak işaretlensin mi?`,
    rationale: `${why ? why + ' ' : ''}${done} Sipariş şu an "${r.status}". Onaylarsanız sipariş durum makinesinden geçerek "Teslim edildi" olur ve teslim günü yazılır.`,
    payload: { orderId: String(r.order_id), installationId },
    affected: [{ entityType: 'order', entityId: String(r.order_id), label: r.order_number, href: `/orders/${r.order_id}` }],
    source: 'system',
    dedupeKey: `delivered:${r.order_id}`,
  }, { notAgainAfterRejection: true });
}

/**
 * Catches the case where the customer signed (or the job was finished) before production was done:
 * once such an order reaches a deliverable status, the suggestion is filed. Orders that already have
 * a pending or rejected one are skipped, newest finished first.
 */
async function refresh(actor: { tenantId: string }) {
  if (!(await tableExists('installations'))) return;
  const rows = await sql`
    SELECT * FROM (
      SELECT DISTINCT ON (o.id) o.id AS order_id, i.id AS installation_id, i.completed_at
      FROM installations i JOIN orders o ON o.id = i.order_id AND o.tenant_id = i.tenant_id
      WHERE i.tenant_id = ${actor.tenantId} AND i.status = 'done' AND o.status = ANY(${DELIVERABLE_FROM})
        AND NOT EXISTS (SELECT 1 FROM ai_suggestions s WHERE s.tenant_id = i.tenant_id AND s.kind = ${MARK_DELIVERED_KIND}
          AND s.dedupe_key = 'delivered:' || o.id::text AND s.status IN ('pending', 'rejected'))
      ORDER BY o.id, i.completed_at DESC NULLS LAST
    ) x ORDER BY completed_at DESC NULLS LAST LIMIT 50`;
  for (const r of rows) await fileDeliveredSuggestion(actor.tenantId, String(r.installation_id), null, null);
}

/**
 * After an installation is finished or signed by the customer, the order may be marked delivered.
 * No model is involved; approval runs the order state machine like a manual move, so the same
 * rules (allowed step, delivery day, audit trail) apply.
 */
registerSuggestionKind<Payload>({
  kind: MARK_DELIVERED_KIND,
  label: 'Teslim edildi',
  payloadSchema: PayloadSchema,
  roles: ['owner', 'admin', 'office'],
  refresh,
  apply: async (tx, actor, payload) => {
    const [o] = await tx`SELECT status FROM orders WHERE tenant_id = ${actor.tenantId} AND id = ${payload.orderId} FOR UPDATE`;
    if (!o) throw new WorkOrderApiError('Sipariş bulunamadı', 404);
    const [i] = await tx`SELECT status FROM installations WHERE tenant_id = ${actor.tenantId} AND id = ${payload.installationId}`;
    if (!i || i.status !== 'done') throw new WorkOrderApiError('Montaj artık tamamlanmış görünmüyor; öneri geçersiz', 409);
    await applyOrderStatus(tx, { tenantId: actor.tenantId, orderId: payload.orderId, from: o.status, to: 'delivered', actorId: actor.userId, note: 'Montaj tamamlandı / teslim imzalandı' });
    return { orderId: payload.orderId, status: 'delivered' };
  },
});
