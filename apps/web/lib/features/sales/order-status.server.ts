import 'server-only';

import { columnExists } from '@/lib/db/schema-guard';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';
import { transitionProblem } from '@/lib/features/orders/transition-rules';

export const istanbulToday = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date());

/**
 * The one gate every order status change passes (inside the caller's transaction, with the order
 * row locked): the move must be allowed, stopping/cancelling/going back needs a reason, the change is
 * written to the trail, the promise freezes at approval and the delivery day is noted.
 */
export async function applyOrderStatus(
  tx: any,
  o: { tenantId: string; orderId: string; from: string; to: string; actorId?: string | null; actorName?: string | null; note?: string | null },
) {
  const problem = transitionProblem(o.from, o.to, o.note);
  if (problem) throw new WorkOrderApiError(problem, 409);
  if (o.from === o.to) return false;
  await tx`UPDATE orders SET status=${o.to}, version=version+1, updated_at=now() WHERE tenant_id=${o.tenantId} AND id=${o.orderId}`;
  if (await columnExists('orders', 'promised_date')) {
    if (o.to === 'approved') await tx`UPDATE orders SET promised_date = delivery_date WHERE tenant_id=${o.tenantId} AND id=${o.orderId} AND promised_date IS NULL AND delivery_date IS NOT NULL`;
    if (o.to === 'delivered' || o.to === 'completed') await tx`UPDATE orders SET delivered_on = ${istanbulToday()} WHERE tenant_id=${o.tenantId} AND id=${o.orderId} AND delivered_on IS NULL`;
  }
  const name = o.actorName ?? (o.actorId ? (await tx`SELECT name FROM users WHERE id=${o.actorId}`)[0]?.name : null) ?? 'Kullanıcı';
  await tx`INSERT INTO activity_logs(tenant_id,entity_type,entity_id,action,actor_id,actor_name,note,changes)
    VALUES(${o.tenantId},'order',${o.orderId},'status_changed',${o.actorId ?? null},${name},${o.note?.trim() || null},${JSON.stringify({ durum: { from: o.from, to: o.to } })}::text::jsonb)`;
  return true;
}
