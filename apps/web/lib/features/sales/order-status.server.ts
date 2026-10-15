import { requireCommercialApproval } from '../orders/quote-file.server';
import 'server-only';

import { columnExists } from '@/lib/db/schema-guard';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';
import { transitionProblem } from '@/lib/features/orders/transition-rules';

export const istanbulToday = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date());

const PAST_APPROVAL = ['approved', 'preparing_materials', 'ready_for_production', 'in_production', 'quality_check', 'ready', 'ready_for_shipment', 'shipped', 'delivered', 'completed'];

/**
 * Dates that follow the status, for every path that moves an order (manual, production, shipping):
 * the promise freezes from the planned date once the order is approved or beyond, and the day it
 * reaches the customer is noted. Before migration 041 it does nothing.
 */
export async function noteOrderDates(tx: any, tenantId: string, orderId: string, to: string) {
  if (!(await columnExists('orders', 'promised_date'))) return;
  if (PAST_APPROVAL.includes(to)) await tx`UPDATE orders SET promised_date = delivery_date WHERE tenant_id=${tenantId} AND id=${orderId} AND promised_date IS NULL AND delivery_date IS NOT NULL`;
  if (to === 'delivered' || to === 'completed') await tx`UPDATE orders SET delivered_on = ${istanbulToday()} WHERE tenant_id=${tenantId} AND id=${orderId} AND delivered_on IS NULL`;
}

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
  if(PAST_APPROVAL.includes(o.to)&&o.to!=='approved'&&await columnExists('orders','quotation_id')){
    const [file]=await tx`SELECT to_jsonb(orders)->>'technical_file_required' AS required FROM orders WHERE tenant_id=${o.tenantId} AND id=${o.orderId}`;
    if(file?.required==='true'&&!(await tx`SELECT id FROM order_technical_revisions WHERE tenant_id=${o.tenantId} AND order_id=${o.orderId} AND status='approved'`).length)throw new WorkOrderApiError('Siparişin teknik planı onaylanmadan üretim veya teslim aşamasına geçilemez',409);
  }
  if(PAST_APPROVAL.includes(o.to)) await requireCommercialApproval(tx,o.tenantId,o.orderId,o.from==='on_hold');
  await tx`UPDATE orders SET status=${o.to}, version=version+1, updated_at=now() WHERE tenant_id=${o.tenantId} AND id=${o.orderId}`;
  await noteOrderDates(tx, o.tenantId, o.orderId, o.to);
  const name = o.actorName ?? (o.actorId ? (await tx`SELECT name FROM users WHERE id=${o.actorId}`)[0]?.name : null) ?? 'Kullanıcı';
  await tx`INSERT INTO activity_logs(tenant_id,entity_type,entity_id,action,actor_id,actor_name,note,changes)
    VALUES(${o.tenantId},'order',${o.orderId},'status_changed',${o.actorId ?? null},${name},${o.note?.trim() || null},${JSON.stringify({ durum: { from: o.from, to: o.to } })}::text::jsonb)`;
  return true;
}
