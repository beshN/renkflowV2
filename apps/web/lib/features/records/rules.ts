import 'server-only';

import { sql, withTransaction } from '@/lib/db';
import { recordAudit } from '@/lib/audit/audit-log';
import { createNotification } from '@/lib/notifications/service';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { RECORDS } from './registry';
import { recordPlatformAvailable } from './service';

/**
 * Simple automation: "when an order reaches X, do Y" for things inside the firm only — create an
 * activity, assign it, notify people. A rule never writes to a customer.
 *
 * Each rule runs once per order (record_rule_runs). When a rule is switched on, the orders already
 * in its state are recorded as handled (the baseline), so switching on never floods the firm with
 * work for old orders; from then on each order that enters the state is handled once. Orders that
 * changed in the last two minutes are left out of the baseline, so the change that triggered the
 * first run is still handled.
 */
export const RULES = [
  { key: 'order_approved_production', label: 'Onaylanan sipariş → "Üretim emrini aç" aktivitesi (üretim sorumlusuna)' },
  { key: 'order_late_notify', label: 'Termini geçen sipariş → yöneticilere bildirim' },
  { key: 'order_delivered_feedback', label: 'Teslim edilen sipariş → "Geri bildirim al" aktivitesi (2 gün sonra, kayıt sahibine)' },
] as const;
export type RuleKey = (typeof RULES)[number]['key'];

const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date());
const plusDays = (iso: string, n: number) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10);

/** Orders currently in the state each rule reacts to (one filter for the baseline and the scan). */
function matching(tenantId: string, rule: RuleKey, day: string) {
  if (rule === 'order_approved_production') return sql`SELECT o.id, o.updated_at FROM orders o WHERE o.tenant_id = ${tenantId} AND o.status IN ('approved', 'preparing_materials', 'ready_for_production')`;
  if (rule === 'order_late_notify') return sql`SELECT o.id, o.updated_at FROM orders o WHERE o.tenant_id = ${tenantId} AND o.delivery_date < ${day}::date AND o.status NOT IN ('completed', 'cancelled', 'delivered', 'shipped')`;
  return sql`SELECT o.id, o.updated_at FROM orders o WHERE o.tenant_id = ${tenantId} AND o.status IN ('completed', 'delivered')`;
}

/** Marks the orders already in the rule's state as handled, except those that changed just now. */
async function baseline(tenantId: string, rule: RuleKey) {
  await sql`INSERT INTO record_rule_runs (tenant_id, rule_key, entity_type, entity_id)
    SELECT ${tenantId}, ${rule}, 'order', m.id FROM (${matching(tenantId, rule, today())}) m
    WHERE m.updated_at < now() - interval '2 minutes'
    ON CONFLICT DO NOTHING`;
}

/** The firm's switches; a rule seen for the first time is on, with its baseline taken now. */
async function ruleStates(tenantId: string) {
  const created = await sql`INSERT INTO record_rules (tenant_id, rule_key) SELECT ${tenantId}, k FROM unnest(${RULES.map((r) => r.key)}::text[]) AS k ON CONFLICT DO NOTHING RETURNING rule_key`;
  for (const r of created) await baseline(tenantId, r.rule_key as RuleKey);
  const rows = await sql`SELECT rule_key, enabled FROM record_rules WHERE tenant_id = ${tenantId}`;
  return new Map<string, boolean>(rows.map((r: any) => [r.rule_key as string, Boolean(r.enabled)]));
}

/** Claims the pair and applies its effect in one transaction: a failure leaves the rule to run again. */
async function applyOnce(tenantId: string, rule: RuleKey, orderId: string, effect: (tx: any) => Promise<void>) {
  return withTransaction(async (tx: any) => {
    const claimed = await tx`INSERT INTO record_rule_runs (tenant_id, rule_key, entity_type, entity_id) VALUES (${tenantId}, ${rule}, 'order', ${orderId}) ON CONFLICT DO NOTHING RETURNING 1`;
    if (!claimed.length) return false;
    await effect(tx);
    return true;
  });
}

async function addActivity(tx: any, tenantId: string, rule: RuleKey, orderId: string, kind: string, title: string, dueOn: string, assigneeId: string | null) {
  await tx`INSERT INTO record_activities (tenant_id, entity_type, entity_id, kind, title, due_on, assignee_id, rule_key) VALUES (${tenantId}, 'order', ${orderId}, ${kind}, ${title}, ${dueOn}, ${assigneeId}, ${rule})`;
  await recordAudit(tx, { tenantId, actorId: null, entityType: 'order', entityId: orderId, action: 'activity_planned', changes: { activity: { from: null, to: `${title} · ${dueOn}` } }, metadata: { rule } });
}

/** A person may be given an order activity only if their role opens orders (workers never do). */
async function orderAssignee(tenantId: string, userId: string | null | undefined) {
  if (!userId) return null;
  const [m] = await sql`SELECT role FROM tenant_members WHERE tenant_id = ${tenantId} AND user_id = ${userId}`;
  return m && RECORDS.order.canView(m.role) ? (userId as string) : null;
}

const lastRun = new Map<string, number>();

/**
 * Applies the rules that are on. Safe to call any time; each (rule, order) runs once. Calls for the
 * same firm within a minute are skipped unless `force` (a status change just happened).
 */
export async function runRecordRules(tenantId: string, { force = false } = {}) {
  if (!(await recordPlatformAvailable())) return { ran: 0 };
  if (!force && Date.now() - (lastRun.get(tenantId) ?? 0) < 60_000) return { ran: 0 };
  lastRun.set(tenantId, Date.now());
  const on = await ruleStates(tenantId);
  const day = today();
  let ran = 0;
  const pending = (rule: RuleKey) => sql`SELECT m.id FROM (${matching(tenantId, rule, day)}) m
    WHERE NOT EXISTS (SELECT 1 FROM record_rule_runs r WHERE r.tenant_id = ${tenantId} AND r.rule_key = ${rule} AND r.entity_id = m.id) LIMIT 100`;

  if (on.get('order_approved_production')) {
    const [pref] = await sql`SELECT production_lead_user_id FROM manufacturing_preferences WHERE tenant_id = ${tenantId}`.catch(() => [] as any[]);
    // A production lead who is a worker cannot open orders: the activity stays with the office.
    const lead = await orderAssignee(tenantId, pref?.production_lead_user_id);
    for (const o of await pending('order_approved_production'))
      if (await applyOnce(tenantId, 'order_approved_production', o.id, (tx) => addActivity(tx, tenantId, 'order_approved_production', o.id, 'production', 'Üretim emrini aç', day, lead))) ran++;
  }

  if (on.get('order_late_notify')) {
    const late = await pending('order_late_notify');
    if (late.length) {
      const managers = (await sql`SELECT user_id FROM tenant_members WHERE tenant_id = ${tenantId} AND role IN ('owner', 'admin')`).map((m: any) => m.user_id);
      for (const o of late) {
        const done = await applyOnce(tenantId, 'order_late_notify', o.id, (tx) =>
          recordAudit(tx, { tenantId, actorId: null, entityType: 'order', entityId: o.id, action: 'late_notified', metadata: { rule: 'order_late_notify', managers: managers.length } }));
        if (!done) continue;
        ran++;
        const [order] = await sql`SELECT order_number FROM orders WHERE id = ${o.id}`;
        for (const m of managers)
          await createNotification(m, tenantId, 'order:delayed', `${order?.order_number ?? 'Sipariş'} gecikti`, 'Termin geçti; teslim planını gözden geçirin.', { href: `/orders/${o.id}`, entityType: 'order', entityId: o.id })
            .catch((e) => console.error('[records:rules] late notice', e instanceof Error ? e.message : e));
      }
    }
  }

  if (on.get('order_delivered_feedback')) {
    for (const o of await pending('order_delivered_feedback')) {
      // The order's owner on the record, if set and allowed to open orders; otherwise the office takes it.
      const [meta] = await sql`SELECT assignee_id FROM record_meta WHERE tenant_id = ${tenantId} AND entity_type = 'order' AND entity_id = ${o.id}`;
      const owner = await orderAssignee(tenantId, meta?.assignee_id);
      if (await applyOnce(tenantId, 'order_delivered_feedback', o.id, (tx) => addActivity(tx, tenantId, 'order_delivered_feedback', o.id, 'feedback', 'Müşteriden geri bildirim al', plusDays(day, 2), owner))) ran++;
    }
  }
  return { ran };
}

/** Rule switches for the settings screen (owner/admin). */
export async function listRules(actor: WorkOrderActor) {
  if (!['owner', 'admin'].includes(actor.role)) throw new WorkOrderApiError('Kuralları yönetici düzenler', 403);
  if (!(await recordPlatformAvailable())) return { available: false, rules: [] };
  const states = await ruleStates(actor.tenantId);
  return { available: true, rules: RULES.map((r) => ({ ...r, enabled: states.get(r.key) ?? true })) };
}

/** Switching a rule on takes a new baseline: orders that reached the state while it was off are not handled late. */
export async function setRule(actor: WorkOrderActor, key: string, enabled: boolean) {
  if (!['owner', 'admin'].includes(actor.role)) throw new WorkOrderApiError('Kuralları yönetici düzenler', 403);
  const rule = RULES.find((r) => r.key === key);
  if (!rule) throw new WorkOrderApiError('Bilinmeyen kural', 400);
  await ruleStates(actor.tenantId);
  const [before] = await sql`SELECT enabled FROM record_rules WHERE tenant_id = ${actor.tenantId} AND rule_key = ${key}`;
  if (Boolean(before?.enabled) !== enabled) {
    await sql`UPDATE record_rules SET enabled = ${enabled}, updated_at = now() WHERE tenant_id = ${actor.tenantId} AND rule_key = ${key}`;
    if (enabled) await baseline(actor.tenantId, rule.key);
    await recordAudit(sql, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'tenant_settings', entityId: actor.tenantId, action: 'rule_changed', changes: { [key]: { from: !enabled, to: enabled } } });
  }
  return listRules(actor);
}
