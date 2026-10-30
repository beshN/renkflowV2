import 'server-only';

import { z } from 'zod';
import { sql, withTransaction } from '@/lib/db';
import { tableExists, columnExists } from '@/lib/db/schema-guard';
import { recordAudit } from '@/lib/audit/audit-log';
import { createNotification } from '@/lib/notifications/service';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { RECORDS } from '@/lib/features/records/registry';
import { schedulingSnapshot, scheduleSnapshot } from '@/lib/features/manufacturing/planning.service';
import { DEFAULT_REASONS, REASON_KINDS, dailyCapacity, istanbulDay, pareto, planHistory, reasonCodeFrom, type ReasonKind } from './engine';

const OFFICE = ['owner', 'admin', 'office'];
/** Who records scrap and delays: the shop floor and the office (the same roles as production commands). */
const FLOOR = ['owner', 'admin', 'office', 'worker'];
const realDate = (s: string) => { const d = new Date(s + 'T00:00:00Z'); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; };
const MANAGERS = ['owner', 'admin'];

/** Tur C tables (migration 042); before it runs these features answer 409 and nothing else changes. */
export const productionDepthAvailable = () => tableExists('production_reason_codes');
async function requireDepth() {
  if (!(await productionDepthAvailable())) throw new WorkOrderApiError('Fire/gecikme kayıtları bu kurulumda henüz etkin değil (veritabanı güncellemesi bekleniyor)', 409);
}
const need = (actor: WorkOrderActor, roles: string[], what: string) => {
  if (!roles.includes(actor.role)) throw new WorkOrderApiError(`${what} yetkiniz yok`, 403);
};

/** The job as this person may see it (a worker only their own), or 404; locked when about to be written. */
async function openJob(db: any, actor: WorkOrderActor, id: string, lock = false) {
  z.string().uuid().parse(id);
  if (!RECORDS.work_order.canView(actor.role)) throw new WorkOrderApiError('İş emri görme yetkiniz yok', 403);
  const head = await RECORDS.work_order.head(db, actor, id);
  if (!head) throw new WorkOrderApiError('İş emri bulunamadı', 404);
  const [job] = lock
    ? await db`SELECT id, title, order_id, status FROM work_orders WHERE tenant_id = ${actor.tenantId} AND id = ${id} FOR UPDATE`
    : await db`SELECT id, title, order_id, status FROM work_orders WHERE tenant_id = ${actor.tenantId} AND id = ${id}`;
  return job as { id: string; title: string; order_id: string | null; status: string };
}

// Reason catalogue --------------------------------------------------------------------------------

/** The firm's reasons of one kind (seeded with the defaults the first time). */
export async function reasonCodes(tenantId: string, kind: ReasonKind, includeInactive = false): Promise<Array<{ code: string; label: string; active: boolean }>> {
  if (!(await productionDepthAvailable())) return DEFAULT_REASONS[kind].map((r) => ({ ...r, active: true }));
  const defaults = DEFAULT_REASONS[kind];
  await sql`INSERT INTO production_reason_codes (tenant_id, kind, code, label, position)
    SELECT ${tenantId}, ${kind}, d.code, d.label, d.position FROM unnest(${defaults.map((d) => d.code)}::text[], ${defaults.map((d) => d.label)}::text[], ${defaults.map((_, i) => i)}::int[]) AS d(code, label, position)
    WHERE NOT EXISTS (SELECT 1 FROM production_reason_codes WHERE tenant_id = ${tenantId} AND kind = ${kind})
    ON CONFLICT DO NOTHING`;
  const rows = await sql`SELECT code, label, active FROM production_reason_codes WHERE tenant_id = ${tenantId} AND kind = ${kind} AND (${includeInactive} OR active) ORDER BY position, label`;
  return rows.map((r: any) => ({ code: r.code as string, label: r.label as string, active: Boolean(r.active) }));
}

export async function allReasonCodes(actor: WorkOrderActor) {
  need(actor, OFFICE, 'Neden kodlarını görme');
  return Object.fromEntries(await Promise.all(REASON_KINDS.map(async (k) => [k, await reasonCodes(actor.tenantId, k, true)] as const)));
}

const ReasonSchema = z.object({
  kind: z.enum(REASON_KINDS),
  code: z.string().regex(/^[a-z0-9_]{2,40}$/).optional(),
  label: z.string().trim().min(1).max(60),
  active: z.boolean().default(true),
}).strict();

/** Adds or renames a reason, or switches it off (codes are kept: old records still read). */
export async function saveReasonCode(actor: WorkOrderActor, raw: unknown) {
  need(actor, MANAGERS, 'Neden kodlarını değiştirme');
  await requireDepth();
  const r = ReasonSchema.parse(raw);
  const existing = await reasonCodes(actor.tenantId, r.kind, true);
  const code = r.code ?? reasonCodeFrom(r.label);
  // Rework commands take a fixed set of codes: their labels can be renamed, nothing added or switched off.
  if (r.kind === 'rework' && (!existing.some((e) => e.code === code) || !r.active))
    throw new WorkOrderApiError('Rework nedenleri yalnız yeniden adlandırılabilir', 400);
  await withTransaction(async (tx: any) => {
    const [before] = await tx`SELECT label, active FROM production_reason_codes WHERE tenant_id = ${actor.tenantId} AND kind = ${r.kind} AND code = ${code}`;
    await tx`INSERT INTO production_reason_codes (tenant_id, kind, code, label, active, position)
      VALUES (${actor.tenantId}, ${r.kind}, ${code}, ${r.label}, ${r.active}, (SELECT coalesce(max(position), 0) + 1 FROM production_reason_codes WHERE tenant_id = ${actor.tenantId} AND kind = ${r.kind}))
      ON CONFLICT (tenant_id, kind, code) DO UPDATE SET label = EXCLUDED.label, active = EXCLUDED.active`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'tenant_settings', entityId: actor.tenantId, action: 'reason_code_saved',
      changes: { [`${r.kind}:${code}`]: { from: before ? `${before.label}${before.active ? '' : ' (kapalı)'}` : null, to: `${r.label}${r.active ? '' : ' (kapalı)'}` } } });
  });
  return allReasonCodes(actor);
}

async function requireActiveReason(tenantId: string, kind: ReasonKind, code: string) {
  const list = await reasonCodes(tenantId, kind);
  const found = list.find((r) => r.code === code);
  if (!found) throw new WorkOrderApiError('Neden kodu seçin', 400);
  return found;
}

// Scrap -------------------------------------------------------------------------------------------

const ScrapSchema = z.object({
  reasonCode: z.string().min(2).max(40),
  quantity: z.coerce.number().positive().max(100000),
  lengthMm: z.coerce.number().positive().max(100000).optional(),
  itemId: z.string().uuid().optional(),
  operationId: z.string().uuid().optional(),
  note: z.string().trim().max(500).optional(),
  photos: z.array(z.string().max(500)).max(6).default([]),
}).strict();

/**
 * Scrap on a job, with the firm's reason: a worker on their own job, or the office. It is a record
 * for Pareto and cost follow-up; stock moves stay with the warehouse commands.
 */
export async function recordScrap(actor: WorkOrderActor, workOrderId: string, raw: unknown) {
  need(actor, FLOOR, 'Fire kaydetme');
  await requireDepth();
  const d = ScrapSchema.parse(raw);
  const reason = await requireActiveReason(actor.tenantId, 'scrap', d.reasonCode);
  await withTransaction(async (tx: any) => {
    const job = await openJob(tx, actor, workOrderId, true);
    if (job.status === 'cancelled') throw new WorkOrderApiError('İptal edilmiş iş emrine fire girilmez', 409);
    if (d.operationId && !(await tx`SELECT 1 FROM production_operations WHERE tenant_id = ${actor.tenantId} AND id = ${d.operationId} AND work_order_id = ${job.id}`).length)
      throw new WorkOrderApiError('Operasyon bu iş emrinde yok', 400);
    if (d.itemId && !(await tx`SELECT 1 FROM inventory_items WHERE tenant_id = ${actor.tenantId} AND id = ${d.itemId}`).length)
      throw new WorkOrderApiError('Malzeme bulunamadı', 400);
    await tx`INSERT INTO production_scrap_events (tenant_id, work_order_id, operation_id, item_id, quantity, length_mm, reason_code, note, photos, created_by)
      VALUES (${actor.tenantId}, ${job.id}, ${d.operationId ?? null}, ${d.itemId ?? null}, ${d.quantity}, ${d.lengthMm ?? null}, ${d.reasonCode}, ${d.note ?? null}, ${JSON.stringify(d.photos)}::text::jsonb, ${actor.userId})`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'work_order', entityId: job.id, action: 'scrap_recorded', note: d.note || null,
      metadata: { reason: reason.label, quantity: d.quantity, lengthMm: d.lengthMm ?? null } });
  });
  return workOrderDepth(actor, workOrderId);
}

// Delay -------------------------------------------------------------------------------------------

const DelaySchema = z.object({
  reasonCode: z.string().min(2).max(40),
  note: z.string().trim().max(500).optional(),
  expectedUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).strict();

/**
 * A delay on a job with its reason (one open at a time). The production lead hears of it (or the
 * managers when none is set), without customer or price.
 */
export async function reportDelay(actor: WorkOrderActor, workOrderId: string, raw: unknown) {
  need(actor, FLOOR, 'Gecikme bildirme');
  await requireDepth();
  const d = DelaySchema.parse(raw);
  if (d.expectedUntil && !realDate(d.expectedUntil)) throw new WorkOrderApiError('Tahmini bitiş tarihi geçersiz', 400);
  const reason = await requireActiveReason(actor.tenantId, 'delay', d.reasonCode);
  const job = await withTransaction(async (tx: any) => {
    // The job row is locked, so two reports at once cannot both pass the "one open delay" check.
    const j = await openJob(tx, actor, workOrderId, true);
    if (['done', 'cancelled'].includes(j.status)) throw new WorkOrderApiError('Kapanmış iş emrine gecikme girilmez', 409);
    const [open] = await tx`SELECT id FROM production_delays WHERE tenant_id = ${actor.tenantId} AND work_order_id = ${j.id} AND resolved_at IS NULL FOR UPDATE`;
    if (open) throw new WorkOrderApiError('Bu iş emrinde açık bir gecikme var; önce kapatın', 409);
    await tx`INSERT INTO production_delays (tenant_id, work_order_id, reason_code, note, expected_until, created_by)
      VALUES (${actor.tenantId}, ${j.id}, ${d.reasonCode}, ${d.note ?? null}, ${d.expectedUntil ?? null}, ${actor.userId})`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'work_order', entityId: j.id, action: 'delay_reported', note: d.note || null, metadata: { reason: reason.label, expectedUntil: d.expectedUntil ?? null } });
    return j;
  });
  const [pref] = (await columnExists('manufacturing_preferences', 'production_lead_user_id'))
    ? await sql`SELECT p.production_lead_user_id AS lead FROM manufacturing_preferences p JOIN tenant_members m ON m.tenant_id = p.tenant_id AND m.user_id = p.production_lead_user_id WHERE p.tenant_id = ${actor.tenantId} AND (to_jsonb(m) ->> 'deactivated_at') IS NULL`
    : [];
  const people = pref?.lead ? [pref.lead as string] : (await sql`SELECT user_id FROM tenant_members WHERE tenant_id = ${actor.tenantId} AND role IN ('owner', 'admin') AND (to_jsonb(tenant_members) ->> 'deactivated_at') IS NULL`).map((m: any) => m.user_id as string);
  for (const p of people)
    if (p !== actor.userId)
      await createNotification(p, actor.tenantId, 'order:delayed', `Gecikme: ${job.title}`, `${reason.label}${d.expectedUntil ? ` · tahmini ${d.expectedUntil}` : ''}`, { href: `/work-orders/${job.id}`, entityType: 'work_order', entityId: job.id })
        .catch((e) => console.error('[production] delay notice', e instanceof Error ? e.message : e));
  return workOrderDepth(actor, workOrderId);
}

/** Closing a delay: the office, or the person who reported it. */
export async function resolveDelay(actor: WorkOrderActor, workOrderId: string) {
  need(actor, FLOOR, 'Gecikme kapatma');
  await requireDepth();
  await withTransaction(async (tx: any) => {
    const job = await openJob(tx, actor, workOrderId, true);
    const [open] = await tx`SELECT * FROM production_delays WHERE tenant_id = ${actor.tenantId} AND work_order_id = ${job.id} AND resolved_at IS NULL FOR UPDATE`;
    if (!open) throw new WorkOrderApiError('Açık gecikme yok', 409);
    if (!OFFICE.includes(actor.role) && open.created_by !== actor.userId) throw new WorkOrderApiError('Gecikmeyi ofis ya da bildiren kapatır', 403);
    await tx`UPDATE production_delays SET resolved_at = now(), resolved_by = ${actor.userId} WHERE id = ${open.id}`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'work_order', entityId: job.id, action: 'delay_resolved', metadata: { reasonCode: open.reason_code } });
  });
  return workOrderDepth(actor, workOrderId);
}

/** What the job screen shows: scrap and delays with the firm's reasons (no prices, no customer). */
export async function workOrderDepth(actor: WorkOrderActor, workOrderId: string) {
  if (!(await productionDepthAvailable())) return { available: false as const };
  const job = await openJob(sql, actor, workOrderId);
  const [scrapReasons, delayReasons, scrap, delays, items] = await Promise.all([
    reasonCodes(actor.tenantId, 'scrap'),
    reasonCodes(actor.tenantId, 'delay'),
    sql`SELECT s.id, s.quantity, s.length_mm, s.reason_code, s.note, s.created_at, u.name AS by_name, i.name AS item_name FROM production_scrap_events s
      LEFT JOIN users u ON u.id = s.created_by LEFT JOIN inventory_items i ON i.id = s.item_id
      WHERE s.tenant_id = ${actor.tenantId} AND s.work_order_id = ${job.id} ORDER BY s.created_at DESC LIMIT 50`,
    sql`SELECT d.id, d.reason_code, d.note, d.expected_until, d.created_at, d.resolved_at, d.created_by, u.name AS by_name FROM production_delays d LEFT JOIN users u ON u.id = d.created_by
      WHERE d.tenant_id = ${actor.tenantId} AND d.work_order_id = ${job.id} ORDER BY d.created_at DESC LIMIT 20`,
    sql`SELECT DISTINCT i.id, i.name FROM work_order_materials m JOIN inventory_items i ON i.id = m.item_id AND i.tenant_id = m.tenant_id WHERE m.tenant_id = ${actor.tenantId} AND m.work_order_id = ${job.id} ORDER BY i.name`,
  ]);
  const labelOf = (list: Array<{ code: string; label: string }>, code: string) => list.find((r) => r.code === code)?.label ?? code;
  const allScrap = await reasonCodes(actor.tenantId, 'scrap', true);
  const allDelay = await reasonCodes(actor.tenantId, 'delay', true);
  const open = delays.find((d: any) => !d.resolved_at);
  return {
    available: true as const,
    status: job.status,
    reasons: { scrap: scrapReasons, delay: delayReasons },
    materials: items.map((i: any) => ({ id: i.id as string, name: i.name as string })),
    scrap: scrap.map((s: any) => ({ id: s.id, quantity: Number(s.quantity), lengthMm: s.length_mm == null ? null : Number(s.length_mm), reason: labelOf(allScrap, s.reason_code), note: s.note, at: s.created_at, by: s.by_name ?? null, item: s.item_name ?? null })),
    openDelay: open ? { id: open.id, reason: labelOf(allDelay, open.reason_code), note: open.note, expectedUntil: open.expected_until ? istanbulDay(new Date(open.expected_until).toISOString()) : null, at: open.created_at, by: open.by_name ?? null, canResolve: OFFICE.includes(actor.role) || open.created_by === actor.userId } : null,
    delays: delays.filter((d: any) => d.resolved_at).map((d: any) => ({ id: d.id, reason: labelOf(allDelay, d.reason_code), at: d.created_at, resolvedAt: d.resolved_at })),
  };
}

// Insights for the office -------------------------------------------------------------------------

/**
 * The production picture for the office: scrap, rework and delay reasons as Pareto over the last
 * 90 days, and each work centre's booked load for the next 7 days from the live schedule.
 */
export async function productionInsights(actor: WorkOrderActor) {
  need(actor, OFFICE, 'Üretim analizini görme');
  const available = await productionDepthAvailable();
  const [scrapReasons, reworkReasons, delayReasons] = await Promise.all((['scrap', 'rework', 'delay'] as const).map((k) => reasonCodes(actor.tenantId, k, true)));
  const label = (list: Array<{ code: string; label: string }>, code: string) => list.find((r) => r.code === code)?.label ?? code;
  const [scrapRows, delayRows, openDelays] = available
    ? await Promise.all([
        sql`SELECT reason_code AS code, count(*)::int AS count, sum(quantity)::float AS quantity FROM production_scrap_events WHERE tenant_id = ${actor.tenantId} AND created_at >= now() - interval '90 days' GROUP BY reason_code`,
        sql`SELECT reason_code AS code, count(*)::int AS count FROM production_delays WHERE tenant_id = ${actor.tenantId} AND created_at >= now() - interval '90 days' GROUP BY reason_code`,
        sql`SELECT d.id, d.reason_code, d.expected_until, d.created_at, w.id AS work_order_id, w.title FROM production_delays d JOIN work_orders w ON w.id = d.work_order_id AND w.tenant_id = d.tenant_id
          WHERE d.tenant_id = ${actor.tenantId} AND d.resolved_at IS NULL AND w.status NOT IN ('done', 'cancelled') ORDER BY d.created_at LIMIT 50`,
      ])
    : [[], [], []];
  const reworkRows = await sql`SELECT reason_code AS code, count(*)::int AS count, sum(affected_qty)::float AS quantity FROM production_rework WHERE tenant_id = ${actor.tenantId} AND created_at >= now() - interval '90 days' GROUP BY reason_code`;

  // Capacity from the same finite schedule the planning screen builds.
  const today = istanbulDay(new Date().toISOString());
  let capacity: ReturnType<typeof dailyCapacity> = [];
  let capacityError: string | null = null;
  try {
    const inputs = await schedulingSnapshot(sql, actor.tenantId);
    const schedule = scheduleSnapshot(inputs, new Date().toISOString());
    capacity = dailyCapacity(schedule.tasks as any, inputs.centers.map((c: any) => ({ code: c.code, name: c.name, parallelCapacity: c.parallel_capacity, shiftStart: c.shift_start, shiftEnd: c.shift_end, workDays: c.work_days })), today, 7);
  } catch (e) {
    capacityError = e instanceof Error ? e.message : 'Kapasite hesaplanamadı';
  }
  return {
    available,
    scrap: pareto(scrapRows.map((r: any) => ({ code: r.code, label: label(scrapReasons, r.code), count: r.count, quantity: Number(r.quantity) }))),
    rework: pareto(reworkRows.map((r: any) => ({ code: r.code, label: label(reworkReasons, r.code), count: r.count, quantity: Number(r.quantity) }))),
    delay: pareto(delayRows.map((r: any) => ({ code: r.code, label: label(delayReasons, r.code), count: r.count }))),
    openDelays: openDelays.map((d: any) => ({ id: d.id, reason: label(delayReasons, d.reason_code), expectedUntil: d.expected_until ? istanbulDay(new Date(d.expected_until).toISOString()) : null, since: d.created_at, workOrderId: d.work_order_id, title: d.title })),
    capacity,
    capacityError,
  };
}

/** Every plan made for the jobs of this plan, oldest first, with waste and the change from the one before. */
export async function cutPlanVersions(actor: WorkOrderActor, planId: string) {
  need(actor, OFFICE, 'Kesim planı geçmişini görme');
  z.string().uuid().parse(planId);
  const [plan] = await sql`SELECT work_order_ids FROM cutting_plans WHERE tenant_id = ${actor.tenantId} AND id = ${planId}`;
  if (!plan) throw new WorkOrderApiError('Kesim planı bulunamadı', 404);
  const rows = await sql`SELECT id, status, version, created_at, result FROM cutting_plans WHERE tenant_id = ${actor.tenantId} AND work_order_ids && ${plan.work_order_ids}::uuid[] ORDER BY created_at LIMIT 50`;
  return planHistory(rows.map((r: any) => ({ id: r.id, status: r.status, version: r.version, createdAt: new Date(r.created_at).toISOString(), result: r.result })));
}

// Bar length options ------------------------------------------------------------------------------

export async function barLengthOptions(actor: WorkOrderActor) {
  need(actor, OFFICE, 'Profil boyu seçeneklerini görme');
  if (!(await columnExists('manufacturing_preferences', 'bar_length_options_mm'))) return { available: false, options: [] as number[] };
  const [p] = await sql`SELECT bar_length_options_mm FROM manufacturing_preferences WHERE tenant_id = ${actor.tenantId}`;
  return { available: true, options: ((p?.bar_length_options_mm ?? []) as number[]).map(Number) };
}

export async function saveBarLengthOptions(actor: WorkOrderActor, raw: unknown) {
  need(actor, MANAGERS, 'Profil boyu seçeneklerini değiştirme');
  if (!(await columnExists('manufacturing_preferences', 'bar_length_options_mm'))) throw new WorkOrderApiError('Bu kurulumda henüz etkin değil (veritabanı güncellemesi bekleniyor)', 409);
  const options = [...new Set(z.object({ options: z.array(z.coerce.number().int().min(1000).max(15000)).max(8) }).strict().parse(raw).options)].sort((a, b) => a - b);
  await withTransaction(async (tx: any) => {
    const [before] = await tx`SELECT bar_length_options_mm FROM manufacturing_preferences WHERE tenant_id = ${actor.tenantId} FOR UPDATE`;
    if (before) await tx`UPDATE manufacturing_preferences SET bar_length_options_mm = ${options}::int[], updated_at = now() WHERE tenant_id = ${actor.tenantId}`;
    else await tx`INSERT INTO manufacturing_preferences (tenant_id, bar_length_options_mm) VALUES (${actor.tenantId}, ${options}::int[])`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'tenant_settings', entityId: actor.tenantId, action: 'bar_lengths_changed', changes: { 'profil boyları': { from: (before?.bar_length_options_mm ?? []).join(', ') || null, to: options.join(', ') || null } } });
  });
  return barLengthOptions(actor);
}
