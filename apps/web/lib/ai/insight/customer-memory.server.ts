import 'server-only';

import { z } from 'zod';
import { sql } from '@/lib/db';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { resolveMemberAccess } from '@/lib/security/member-access.server';
import { can } from '@/lib/security/access-matrix';
import { getAiSettings, featureOn } from '@/lib/ai/gate.server';
import { customerMemory } from './customer-memory';

type Row = Record<string, any>;
const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : String(d ?? '')).slice(0, 10);

/** The customer card's "what we know" from records, within the reader's rights (prices, finance). */
export async function customerMemoryFor(actor: WorkOrderActor, customerId: string) {
  z.string().uuid().parse(customerId);
  const access = await resolveMemberAccess(actor.userId, actor.tenantId);
  if (!access || access.deactivated || actor.role === 'worker' || !can(access, 'customers', 'view')) throw new WorkOrderApiError('Müşteri bilgisini görme yetkiniz yok', 403);
  const ai = await getAiSettings(actor.tenantId);
  if (ai.mode === 'off' || !featureOn(ai, 'customer_memory')) return { available: false as const, facts: [] };
  const [c] = await sql`SELECT id FROM customers WHERE tenant_id = ${actor.tenantId} AND id = ${customerId}`;
  if (!c) throw new WorkOrderApiError('Müşteri bulunamadı', 404);
  const seeOrders = can(access, 'orders', 'view');
  const seeQuotes = can(access, 'quotations', 'view');
  const financeVisible = can(access, 'finance', 'view');
  const [orders, quotes] = await Promise.all([
    seeOrders ? sql`SELECT o.id, o.order_number, o.created_at, o.total_amount, o.status, array_remove(array_agg(DISTINCT oi.color), NULL) AS colors
      FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id WHERE o.tenant_id = ${actor.tenantId} AND o.customer_id = ${customerId} GROUP BY o.id ORDER BY o.created_at DESC LIMIT 100` : [],
    seeQuotes ? sql`SELECT q.id, q.quotation_number, q.created_at, q.status, array_remove(array_agg(DISTINCT qi.color), NULL) AS colors
      FROM quotations q LEFT JOIN quotation_items qi ON qi.quotation_id = q.id WHERE q.tenant_id = ${actor.tenantId} AND q.customer_id = ${customerId} GROUP BY q.id ORDER BY q.created_at DESC LIMIT 100` : [],
  ]);
  let overdue: Row[] = [];
  if (financeVisible) {
    const { overdueOpenInvoices } = await import('@/lib/features/finance/receivables.server');
    overdue = (await overdueOpenInvoices(actor.tenantId)).filter((i) => i.customerId === customerId);
  }
  const facts = customerMemory({
    orders: orders.map((o: Row) => ({ id: String(o.id), number: o.order_number, date: iso(o.created_at), total: Number(o.total_amount ?? 0), status: String(o.status), colors: (o.colors ?? []).filter(Boolean) })),
    quotes: quotes.map((q: Row) => ({ id: String(q.id), number: q.quotation_number, date: iso(q.created_at), status: String(q.status), colors: (q.colors ?? []).filter(Boolean) })),
    overdue: overdue.map((i) => ({ number: i.number, dueOn: i.dueOn, open: Number(i.open), orderId: i.orderId })),
    hidePrices: access.hidden.includes('price'), financeVisible,
  });
  return { available: true as const, facts };
}
