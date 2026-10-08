import 'server-only';

import { sql } from '@/lib/db';
import { recordAudit } from '@/lib/audit/audit-log';
import { createNotification } from '@/lib/notifications/service';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { recordPlatformAvailable } from './service';

/**
 * Simple automation: "when an order reaches X, do Y" for things inside the firm only — create an
 * activity, assign it, notify people. A rule never writes to a customer. Each rule runs once per
 * record (record_rule_runs) and only for records that changed after the rule was switched on, so
 * turning a rule on does not flood the firm with work for old orders.
 */
export const RULES = [
  { key: 'order_approved_production', label: 'Onaylanan sipariş → "Üretim emrini aç" aktivitesi (üretim sorumlusuna)' },
  { key: 'order_late_notify', label: 'Termini geçen sipariş → yöneticilere bildirim' },
  { key: 'order_delivered_feedback', label: 'Teslim edilen sipariş → "Geri bildirim al" aktivitesi (2 gün sonra, kayıt sahibine)' },
] as const;
export type RuleKey = (typeof RULES)[number]['key'];

const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date());
const plusDays = (iso: string, n: number) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10);

/** The firm's rule switches; a rule seen for the first time is switched on from now. */
async function ruleStates(tenantId: string) {
  for (const r of RULES) await sql`INSERT INTO record_rules (tenant_id, rule_key) VALUES (${tenantId}, ${r.key}) ON CONFLICT DO NOTHING`;
  const rows = await sql`SELECT rule_key, enabled, updated_at FROM record_rules WHERE tenant_id = ${tenantId}`;
  return new Map<string, { enabled: boolean; since: Date }>(rows.map((r: any) => [r.rule_key as string, { enabled: Boolean(r.enabled), since: new Date(r.updated_at) }]));
}

/** Claims a (rule, record) pair; false when it already ran. */
async function claim(db: any, tenantId: string, rule: RuleKey, entityId: string) {
  const rows = await db`INSERT INTO record_rule_runs (tenant_id, rule_key, entity_type, entity_id) VALUES (${tenantId}, ${rule}, 'order', ${entityId}) ON CONFLICT DO NOTHING RETURNING 1`;
  return rows.length > 0;
}

async function addActivity(tenantId: string, rule: RuleKey, orderId: string, kind: string, title: string, dueOn: string, assigneeId: string | null) {
  await sql`INSERT INTO record_activities (tenant_id, entity_type, entity_id, kind, title, due_on, assignee_id, rule_key) VALUES (${tenantId}, 'order', ${orderId}, ${kind}, ${title}, ${dueOn}, ${assigneeId}, ${rule})`;
  await recordAudit(sql, { tenantId, actorId: null, entityType: 'order', entityId: orderId, action: 'activity_planned', changes: { activity: { from: null, to: `${title} · ${dueOn}` } }, metadata: { rule } });
}

/**
 * Looks at the firm's orders and applies the rules that are on. Safe to run any time and as often
 * as wanted (after a status change, when "Bugün" opens): each pair runs once.
 */
export async function runRecordRules(tenantId: string) {
  if (!(await recordPlatformAvailable())) return { ran: 0 };
  const states = await ruleStates(tenantId);
  const day = today();
  let ran = 0;
  const on = (k: RuleKey) => states.get(k)?.enabled ? states.get(k)!.since : null;

  const approvedSince = on('order_approved_production');
  if (approvedSince) {
    const [pref] = await sql`SELECT production_lead_user_id FROM manufacturing_preferences WHERE tenant_id = ${tenantId}`.catch(() => [] as any[]);
    const orders = await sql`SELECT o.id FROM orders o WHERE o.tenant_id = ${tenantId} AND o.status IN ('approved', 'preparing_materials', 'ready_for_production') AND o.updated_at >= ${approvedSince}
      AND NOT EXISTS (SELECT 1 FROM record_rule_runs r WHERE r.tenant_id = o.tenant_id AND r.rule_key = 'order_approved_production' AND r.entity_id = o.id) LIMIT 100`;
    for (const o of orders) if (await claim(sql, tenantId, 'order_approved_production', o.id)) {
      await addActivity(tenantId, 'order_approved_production', o.id, 'production', 'Üretim emrini aç', day, pref?.production_lead_user_id ?? null);
      ran++;
    }
  }

  const lateSince = on('order_late_notify');
  if (lateSince) {
    const orders = await sql`SELECT o.id, o.order_number, o.delivery_date FROM orders o WHERE o.tenant_id = ${tenantId} AND o.delivery_date < ${day}::date AND o.delivery_date >= ${lateSince}::date
      AND o.status NOT IN ('completed', 'cancelled', 'delivered', 'shipped')
      AND NOT EXISTS (SELECT 1 FROM record_rule_runs r WHERE r.tenant_id = o.tenant_id AND r.rule_key = 'order_late_notify' AND r.entity_id = o.id) LIMIT 100`;
    if (orders.length) {
      const managers = (await sql`SELECT user_id FROM tenant_members WHERE tenant_id = ${tenantId} AND role IN ('owner', 'admin')`).map((m: any) => m.user_id);
      for (const o of orders) if (await claim(sql, tenantId, 'order_late_notify', o.id)) {
        for (const m of managers) await createNotification(m, tenantId, 'order:delayed', `${o.order_number} gecikti`, 'Termin geçti; teslim planını gözden geçirin.', { href: `/orders/${o.id}`, entityType: 'order', entityId: o.id }).catch(() => undefined);
        await recordAudit(sql, { tenantId, actorId: null, entityType: 'order', entityId: o.id, action: 'late_notified', metadata: { rule: 'order_late_notify', managers: managers.length } });
        ran++;
      }
    }
  }

  const deliveredSince = on('order_delivered_feedback');
  if (deliveredSince) {
    // Assigned to the order's owner on the record (if one is set); otherwise left for the office to take.
    const orders = await sql`SELECT o.id, (SELECT m.assignee_id FROM record_meta m WHERE m.tenant_id = o.tenant_id AND m.entity_type = 'order' AND m.entity_id = o.id) AS owner_id FROM orders o WHERE o.tenant_id = ${tenantId} AND o.status IN ('completed', 'delivered') AND o.updated_at >= ${deliveredSince}
      AND NOT EXISTS (SELECT 1 FROM record_rule_runs r WHERE r.tenant_id = o.tenant_id AND r.rule_key = 'order_delivered_feedback' AND r.entity_id = o.id) LIMIT 100`;
    for (const o of orders) if (await claim(sql, tenantId, 'order_delivered_feedback', o.id)) {
      await addActivity(tenantId, 'order_delivered_feedback', o.id, 'feedback', 'Müşteriden geri bildirim al', plusDays(day, 2), o.owner_id ?? null);
      ran++;
    }
  }
  return { ran };
}

/** Rule switches for the settings screen (owner/admin). Switching on starts from now. */
export async function listRules(actor: WorkOrderActor) {
  if (!['owner', 'admin'].includes(actor.role)) throw new WorkOrderApiError('Kuralları yönetici düzenler', 403);
  if (!(await recordPlatformAvailable())) return { available: false, rules: [] };
  const states = await ruleStates(actor.tenantId);
  return { available: true, rules: RULES.map((r) => ({ ...r, enabled: states.get(r.key)?.enabled ?? true })) };
}
export async function setRule(actor: WorkOrderActor, key: string, enabled: boolean) {
  if (!['owner', 'admin'].includes(actor.role)) throw new WorkOrderApiError('Kuralları yönetici düzenler', 403);
  if (!RULES.some((r) => r.key === key)) throw new WorkOrderApiError('Bilinmeyen kural', 400);
  await sql`INSERT INTO record_rules (tenant_id, rule_key, enabled, updated_at) VALUES (${actor.tenantId}, ${key}, ${enabled}, now())
    ON CONFLICT (tenant_id, rule_key) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = CASE WHEN record_rules.enabled = EXCLUDED.enabled THEN record_rules.updated_at ELSE now() END`;
  await recordAudit(sql, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'tenant_settings', entityId: actor.tenantId, action: 'rule_changed', changes: { [key]: { from: !enabled, to: enabled } } });
  return listRules(actor);
}
