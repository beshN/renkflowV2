import 'server-only';

import { sql } from '@/lib/db';
import { columnExists, tableExists } from '@/lib/db/schema-guard';
import type { WorkOrderActor } from '@/lib/features/work-orders/security';
import { resolveMemberAccess } from '@/lib/security/member-access.server';
import { can } from '@/lib/security/access-matrix';
import { getAiSettings, featureOn } from '@/lib/ai/gate.server';
import { istanbulToday } from '@/lib/features/sales/order-status.server';
import { morningSummary, type MorningFacts } from './morning';

const CLOSED = ['shipped', 'delivered', 'completed', 'cancelled'];

/** The reader's morning lines: only what their role and rights let them see. */
export async function morningFor(actor: WorkOrderActor) {
  const ai = await getAiSettings(actor.tenantId);
  if (ai.mode === 'off' || !featureOn(ai, 'morning_summary')) return { available: false as const, greeting: '', lines: [] };
  const access = await resolveMemberAccess(actor.userId, actor.tenantId);
  if (!access || access.deactivated) return { available: false as const, greeting: '', lines: [] };
  const today = istanbulToday();
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  const facts: MorningFacts = { lateOrders: 0, dueToday: 0, pendingSuggestions: 0, staleQuotes: 0, overdue: null, myJobs: null };
  if (actor.role === 'worker') {
    const [j] = await sql`SELECT count(*)::int AS n, count(*) FILTER (WHERE due_at::date < ${today}::date)::int AS late,
      (array_agg(title ORDER BY due_at NULLS LAST))[1:3] AS titles
      FROM work_orders WHERE tenant_id = ${actor.tenantId} AND assigned_to = ${actor.userId} AND status IN ('open', 'in_progress') AND (due_at IS NULL OR due_at::date <= ${today}::date)`;
    facts.myJobs = { count: j.n, late: j.late, titles: (j.titles ?? []).filter(Boolean) };
  } else {
    if (can(access, 'orders', 'view')) {
      const due = (await columnExists('orders', 'promised_date')) ? sql`coalesce(promised_date, delivery_date::date)` : sql`delivery_date::date`;
      const [o] = await sql`SELECT count(*) FILTER (WHERE ${due} < ${today}::date)::int AS late, count(*) FILTER (WHERE ${due} = ${today}::date)::int AS today
        FROM orders o WHERE tenant_id = ${actor.tenantId} AND COALESCE((to_jsonb(o)->>'provisional')::boolean,false)=false AND status <> ALL(${CLOSED})`;
      [facts.lateOrders, facts.dueToday] = [o.late, o.today];
    }
    if (can(access, 'quotations', 'view'))
      facts.staleQuotes = (await sql`SELECT count(*)::int AS n FROM quotations WHERE tenant_id = ${actor.tenantId} AND status = 'sent' AND updated_at < now() - interval '3 days'`)[0].n;
    if (can(access, 'finance', 'view') && (await tableExists('invoices'))) {
      const { overdueOpenInvoices } = await import('@/lib/features/finance/receivables.server');
      const rows = await overdueOpenInvoices(actor.tenantId);
      facts.overdue = { count: rows.length, amount: rows.reduce((s, r) => s + Number(r.open), 0) };
    }
    const { listPendingSuggestions } = await import('@/lib/ai/suggestions/service');
    facts.pendingSuggestions = (await listPendingSuggestions(actor as any, { refresh: false })).length;
  }
  return { available: true as const, ...morningSummary(actor.role, facts, { hidePrices: access.hidden.includes('price'), hour }) };
}
