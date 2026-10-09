import 'server-only';

import { z } from 'zod';
import { applyOrderStatus } from '@/lib/features/sales/order-status.server';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';
import { registerSuggestionKind } from '../kinds';

export const MARK_DELIVERED_KIND = 'installation.mark_delivered';

const PayloadSchema = z.object({ orderId: z.string().uuid(), installationId: z.string().uuid() });
type Payload = z.infer<typeof PayloadSchema>;

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
  apply: async (tx, actor, payload) => {
    const [o] = await tx`SELECT status FROM orders WHERE tenant_id = ${actor.tenantId} AND id = ${payload.orderId} FOR UPDATE`;
    if (!o) throw new WorkOrderApiError('Sipariş bulunamadı', 404);
    const [i] = await tx`SELECT status FROM installations WHERE tenant_id = ${actor.tenantId} AND id = ${payload.installationId}`;
    if (!i || i.status !== 'done') throw new WorkOrderApiError('Montaj artık tamamlanmış görünmüyor; öneri geçersiz', 409);
    await applyOrderStatus(tx, { tenantId: actor.tenantId, orderId: payload.orderId, from: o.status, to: 'delivered', actorId: actor.userId, note: 'Montaj tamamlandı / teslim imzalandı' });
    return { orderId: payload.orderId, status: 'delivered' };
  },
});
