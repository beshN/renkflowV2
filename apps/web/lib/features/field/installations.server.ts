import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { sql, withTransaction } from '@/lib/db';
import { changedFields, recordAudit } from '@/lib/audit/audit-log';
import { tableExists } from '@/lib/db/schema-guard';
import { consumeRateLimit } from '@/lib/security/rate-limit';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import {
  DEFAULT_INSTALL_CHECKLIST, INSTALLATION_STATUSES, installationConflicts, mapLink, minuteOf,
  type InstallationStatus, type PlannedInstallation,
} from './engine';
import { hasCap, isoDay, nextNumber, requireCap, requireChain } from './common.server';

const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const SIGNOFF_DAYS = 14;

type Row = Record<string, any>;

/**
 * An installation as people see it. A worker (field crew) gets the technical view: no customer
 * name, address, phone or prices; only the work, the day and the crew.
 */
function dto(r: Row, technical: boolean) {
  const base = {
    id: String(r.id), number: r.installation_number as string, orderId: String(r.order_id), orderNumber: r.order_number as string,
    crew: (r.crew ?? []).map(String), crewNames: (r.crew_names ?? []) as string[], crewName: r.crew_name ?? null,
    date: isoDay(r.scheduled_date), startTime: r.start_time ?? null, durationMinutes: Number(r.duration_minutes), status: r.status as InstallationStatus,
    issues: (r.issues ?? []) as Array<{ kind: 'missing' | 'damage'; text: string; at: string; by: string | null }>, notes: r.notes ?? null,
    startedAt: r.started_at, completedAt: r.completed_at, signed: Boolean(r.signed_at), signedAt: r.signed_at, version: Number(r.version),
    productName: r.product_name ?? null, checklistDone: Number(r.checklist_done ?? 0), checklistTotal: Number(r.checklist_total ?? 0),
  };
  if (technical) return { ...base, technicalView: true as const };
  // Who signed is the customer's name: office only.
  return { ...base, signedName: r.signed_name ?? null, customerName: r.customer_name ?? null, address: r.address ?? null, mapUrl: mapLink(r.address), orderStatus: r.order_status ?? null, signoffOpen: Boolean(r.signoff_token_hash && !r.signed_at && r.signoff_expires_at && new Date(r.signoff_expires_at) > new Date()) };
}

const SELECT = `i.*, o.order_number, o.customer_name, o.product_name, o.status AS order_status,
  (SELECT array_agg(coalesce(u.name, u.email) ORDER BY u.name) FROM users u WHERE u.id = ANY(i.crew)) AS crew_names,
  (SELECT count(*) FILTER (WHERE c.done_at IS NOT NULL)::int FROM record_checklist_items c WHERE c.tenant_id = i.tenant_id AND c.entity_type = 'installation' AND c.entity_id = i.id) AS checklist_done,
  (SELECT count(*)::int FROM record_checklist_items c WHERE c.tenant_id = i.tenant_id AND c.entity_type = 'installation' AND c.entity_id = i.id) AS checklist_total`;

/** Whether this person only sees installations they are on, as a technical view. */
const fieldOnly = (actor: WorkOrderActor) => actor.role === 'worker';

async function load(db: any, actor: WorkOrderActor, id: string, lock = false) {
  const [r] = lock
    ? await db`SELECT * FROM installations WHERE tenant_id = ${actor.tenantId} AND id = ${id} FOR UPDATE`
    : await db`SELECT * FROM installations WHERE tenant_id = ${actor.tenantId} AND id = ${id}`;
  if (!r || (fieldOnly(actor) && !(r.crew ?? []).map(String).includes(actor.userId))) throw new WorkOrderApiError('Montaj bulunamadı', 404);
  return r;
}

function planned(r: Row): PlannedInstallation {
  return { id: String(r.id), date: isoDay(r.scheduled_date) ?? '', startMinute: minuteOf(r.start_time) ?? 8 * 60, durationMinutes: Number(r.duration_minutes), crew: (r.crew ?? []).map(String), status: r.status, label: r.installation_number };
}

/** Installations in [from, to] (or all upcoming), with the crew conflicts among them. */
export async function listInstallations(actor: WorkOrderActor, range: { from?: string | null; to?: string | null } = {}) {
  await requireChain();
  await requireCap(actor, 'installations', 'view', 'Montajları görme');
  const from = range.from && /^\d{4}-\d{2}-\d{2}$/.test(range.from) ? range.from : null;
  const to = range.to && /^\d{4}-\d{2}-\d{2}$/.test(range.to) ? range.to : null;
  const rows = await sql.unsafe(`SELECT ${SELECT} FROM installations i JOIN orders o ON o.id = i.order_id AND o.tenant_id = i.tenant_id
    WHERE i.tenant_id = $1 AND ($2::date IS NULL OR i.scheduled_date >= $2::date OR i.scheduled_date IS NULL) AND ($3::date IS NULL OR i.scheduled_date <= $3::date OR i.scheduled_date IS NULL)
      AND ($4::uuid IS NULL OR $4::uuid = ANY(i.crew))
    ORDER BY i.scheduled_date NULLS FIRST, i.start_time NULLS LAST LIMIT 500`, [actor.tenantId, from, to, fieldOnly(actor) ? actor.userId : null]);
  const conflicts = installationConflicts(rows.map(planned));
  return { installations: rows.map((r: Row) => dto(r, fieldOnly(actor))), conflicts };
}

export async function getInstallation(actor: WorkOrderActor, id: string) {
  await requireChain();
  await requireCap(actor, 'installations', 'view', 'Montajı görme');
  await load(sql, actor, id);
  const [r] = await sql.unsafe(`SELECT ${SELECT} FROM installations i JOIN orders o ON o.id = i.order_id AND o.tenant_id = i.tenant_id WHERE i.tenant_id = $1 AND i.id = $2`, [actor.tenantId, id]);
  return { ...dto(r, fieldOnly(actor)), conflicts: await conflictsFor(sql, actor.tenantId, id, isoDay(r.scheduled_date)) };
}

const PlanInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullish(),
  durationMinutes: z.coerce.number().int().min(15).max(1440).optional(),
  crew: z.array(z.string().uuid()).max(20).optional(),
  crewName: z.string().trim().max(80).nullish(),
  address: z.string().trim().max(500).nullish(),
  notes: z.string().trim().max(4000).nullish(),
}).strict();

async function checkCrew(db: any, tenantId: string, crew: string[]) {
  if (!crew.length) return;
  const rows = await db`SELECT user_id FROM tenant_members WHERE tenant_id = ${tenantId} AND user_id = ANY(${crew}::uuid[])`;
  if (rows.length !== new Set(crew).size) throw new WorkOrderApiError('Ekipteki herkes bu firmanın üyesi olmalı', 400);
}

async function conflictsFor(db: any, tenantId: string, id: string, date: string | null) {
  if (!date) return [];
  const sameDay = await db`SELECT * FROM installations WHERE tenant_id = ${tenantId} AND scheduled_date = ${date}`;
  return installationConflicts(sameDay.map(planned)).filter((c) => c.a === id || c.b === id);
}

/**
 * One click from an order to its installation plan: the day (the order's delivery date when not
 * given), the crew, the site address (the customer's), and the standard checklist.
 */
export async function planInstallation(actor: WorkOrderActor, orderId: string, raw: unknown) {
  await requireChain();
  await requireCap(actor, 'installations', 'create', 'Montaj planlama');
  if (fieldOnly(actor)) throw new WorkOrderApiError('Montajı ofis planlar', 403);
  const d = PlanInput.parse(raw ?? {});
  return withTransaction(async (tx: any) => {
    const [o] = await tx`SELECT o.id, o.order_number, o.delivery_date, o.status, c.address AS customer_address, c.shipping_address
      FROM orders o LEFT JOIN customers c ON c.id = o.customer_id AND c.tenant_id = o.tenant_id WHERE o.tenant_id = ${actor.tenantId} AND o.id = ${orderId} FOR UPDATE OF o`;
    if (!o) throw new WorkOrderApiError('Sipariş bulunamadı', 404);
    if (o.status === 'cancelled') throw new WorkOrderApiError('İptal edilmiş siparişe montaj planlanamaz', 409);
    const crew = [...new Set(d.crew ?? [])];
    await checkCrew(tx, actor.tenantId, crew);
    const number = await nextNumber(tx, actor.tenantId, 'installations', 'installation_number', 'MNT');
    const date = d.date ?? isoDay(o.delivery_date);
    const [row] = await tx`INSERT INTO installations (tenant_id, installation_number, order_id, crew, crew_name, scheduled_date, start_time, duration_minutes, address, notes, created_by)
      VALUES (${actor.tenantId}, ${number}, ${orderId}, ${crew}::uuid[], ${d.crewName || null}, ${date}, ${d.startTime ?? '09:00'}, ${d.durationMinutes ?? 240},
        ${d.address || o.shipping_address || o.customer_address || null}, ${d.notes || null}, ${actor.userId}) RETURNING id`;
    if (await tableExists('record_checklist_items')) {
      let position = 0;
      for (const title of DEFAULT_INSTALL_CHECKLIST)
        await tx`INSERT INTO record_checklist_items (tenant_id, entity_type, entity_id, title, position, created_by) VALUES (${actor.tenantId}, 'installation', ${row.id}, ${title}, ${position++}, ${actor.userId})`;
    }
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'installation', entityId: row.id, action: 'created', metadata: { number, orderId, date, crew: crew.length } });
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'order', entityId: orderId, action: 'installation_planned', metadata: { installationId: row.id, number, date } });
    return { id: String(row.id), number, conflicts: await conflictsFor(tx, actor.tenantId, String(row.id), date) };
  });
}

const STATUS_FLOW: Record<InstallationStatus, InstallationStatus[]> = { planned: ['in_progress', 'cancelled'], in_progress: ['done', 'planned'], done: [], cancelled: ['planned'] };

/**
 * Reschedule (calendar drag), change the crew, or move the status. A conflict does not block the
 * change; it is returned so the screen warns. The crew moves only their own job's status.
 */
export async function updateInstallation(actor: WorkOrderActor, id: string, raw: unknown) {
  await requireChain();
  await requireCap(actor, 'installations', 'edit', 'Montajı güncelleme');
  const d = PlanInput.extend({ status: z.enum(INSTALLATION_STATUSES).optional(), expectedVersion: z.number().int().optional() }).parse(raw);
  const result = await withTransaction(async (tx: any) => {
    const before = await load(tx, actor, id, true);
    if (d.expectedVersion !== undefined && Number(before.version) !== d.expectedVersion) throw new WorkOrderApiError('Montaj bu arada değişti; yenileyin', 409);
    const planning = d.date !== undefined || d.startTime !== undefined || d.durationMinutes !== undefined || d.crew !== undefined || d.crewName !== undefined || d.address !== undefined;
    if (planning && fieldOnly(actor)) throw new WorkOrderApiError('Montaj planını ofis değiştirir', 403);
    if (before.status === 'done' && planning) throw new WorkOrderApiError('Tamamlanan montaj yeniden planlanamaz', 409);
    const status: InstallationStatus = d.status ?? before.status;
    if (status !== before.status && !STATUS_FLOW[before.status as InstallationStatus].includes(status)) throw new WorkOrderApiError('Bu durum geçişine izin verilmiyor', 409);
    // The crew starts, finishes or steps back its own job; cancelling and reopening are the office's.
    if (fieldOnly(actor) && status !== before.status && (status === 'cancelled' || before.status === 'cancelled')) throw new WorkOrderApiError('Montajı iptal etmeyi ofis yapar', 403);
    const crew = d.crew ? [...new Set(d.crew)] : (before.crew ?? []).map(String);
    if (d.crew) await checkCrew(tx, actor.tenantId, crew);
    const next = {
      scheduled_date: d.date === undefined ? isoDay(before.scheduled_date) : d.date || null, start_time: d.startTime === undefined ? before.start_time : d.startTime || null,
      duration_minutes: d.durationMinutes ?? Number(before.duration_minutes), crew, crew_name: d.crewName === undefined ? before.crew_name : d.crewName || null,
      address: d.address === undefined ? before.address : d.address || null, notes: d.notes === undefined ? before.notes : d.notes || null, status,
    };
    await tx`UPDATE installations SET scheduled_date = ${next.scheduled_date}, start_time = ${next.start_time}, duration_minutes = ${next.duration_minutes}, crew = ${crew}::uuid[],
      crew_name = ${next.crew_name}, address = ${next.address}, notes = ${next.notes}, status = ${status},
      started_at = ${status === 'in_progress' && !before.started_at ? new Date() : before.started_at}, completed_at = ${status === 'done' ? before.completed_at ?? new Date() : null},
      version = version + 1, updated_at = now() WHERE tenant_id = ${actor.tenantId} AND id = ${id}`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'installation', entityId: id, action: status !== before.status ? 'status_changed' : 'updated',
      changes: changedFields({ ...before, scheduled_date: isoDay(before.scheduled_date), crew: (before.crew ?? []).map(String) }, next) });
    return { orderId: String(before.order_id), done: status === 'done' && before.status !== 'done', conflicts: await conflictsFor(tx, actor.tenantId, id, next.scheduled_date) };
  });
  if (result.done) await suggestDelivered(actor.tenantId, id, actor.userId, 'Montaj tamamlandı olarak işaretlendi.');
  return { conflicts: result.conflicts };
}

/** Missing parts or damage seen on site. */
export async function addIssue(actor: WorkOrderActor, id: string, raw: unknown) {
  await requireChain();
  await requireCap(actor, 'installations', 'edit', 'Eksik/hasar notu');
  const d = z.object({ kind: z.enum(['missing', 'damage']), text: z.string().trim().min(3).max(1000) }).strict().parse(raw);
  await withTransaction(async (tx: any) => {
    const before = await load(tx, actor, id, true);
    const issues = [...(before.issues ?? []), { kind: d.kind, text: d.text, at: new Date().toISOString(), by: actor.userId }];
    await tx`UPDATE installations SET issues = ${JSON.stringify(issues)}::text::jsonb, version = version + 1, updated_at = now() WHERE tenant_id = ${actor.tenantId} AND id = ${id}`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'installation', entityId: id, action: d.kind === 'missing' ? 'missing_noted' : 'damage_noted', note: d.text });
  });
}

/**
 * The customer's delivery sign-off link: valid for 14 days, shown once (only its hash is kept).
 * Only for a job on site or finished.
 */
export async function createSignoffLink(actor: WorkOrderActor, id: string) {
  await requireChain();
  await requireCap(actor, 'installations', 'edit', 'Teslim imza bağlantısı');
  if (fieldOnly(actor)) throw new WorkOrderApiError('İmza bağlantısını ofis gönderir', 403);
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SIGNOFF_DAYS * 86_400_000);
  await withTransaction(async (tx: any) => {
    const r = await load(tx, actor, id, true);
    if (r.signed_at) throw new WorkOrderApiError('Teslim zaten imzalandı', 409);
    if (r.status !== 'in_progress' && r.status !== 'done') throw new WorkOrderApiError('İmza bağlantısı montaj sahada ya da tamamlandığında gönderilir', 409);
    await tx`UPDATE installations SET signoff_token_hash = ${hashToken(token)}, signoff_expires_at = ${expires}, updated_at = now() WHERE tenant_id = ${actor.tenantId} AND id = ${id}`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'installation', entityId: id, action: 'signoff_link_created', metadata: { expiresAt: expires.toISOString() } });
  });
  return { path: `/teslim/${token}`, expiresAt: expires.toISOString() };
}

async function signoffRow(db: any, token: string, lock = false) {
  if (!TOKEN.test(token) || !(await tableExists('installations'))) return null;
  const [r] = lock
    ? await db`SELECT * FROM installations WHERE signoff_token_hash = ${hashToken(token)} FOR UPDATE`
    : await db`SELECT * FROM installations WHERE signoff_token_hash = ${hashToken(token)}`;
  if (!r || !r.signoff_expires_at || new Date(r.signoff_expires_at) < new Date()) return null;
  return r;
}

/** What the customer sees on the sign-off page: the work done, never prices or internal notes. */
export async function publicSignoff(token: string) {
  const r = await signoffRow(sql, token);
  if (!r) return null;
  const [[o], [t], items, checklist] = await Promise.all([
    sql`SELECT order_number, customer_name FROM orders WHERE tenant_id = ${r.tenant_id} AND id = ${r.order_id}`,
    sql`SELECT name FROM tenants WHERE id = ${r.tenant_id}`,
    // order_items has no tenant column: the order (already tenant-checked) scopes it.
    sql`SELECT i.product_name, i.quantity, i.width_mm, i.height_mm, i.color FROM order_items i JOIN orders o ON o.id = i.order_id
      WHERE o.tenant_id = ${r.tenant_id} AND i.order_id = ${r.order_id} ORDER BY i.created_at LIMIT 50`,
    (async () => ((await tableExists('record_checklist_items'))
      ? sql`SELECT title, done_at FROM record_checklist_items WHERE tenant_id = ${r.tenant_id} AND entity_type = 'installation' AND entity_id = ${r.id} ORDER BY position`
      : []))(),
  ]);
  return {
    firm: t?.name ?? '', number: r.installation_number as string, orderNumber: o?.order_number ?? '', customerName: o?.customer_name ?? '',
    date: isoDay(r.scheduled_date), status: r.status as string,
    items: (items as Row[]).map((i) => ({ productName: i.product_name, quantity: Number(i.quantity), widthMm: i.width_mm ? Number(i.width_mm) : null, heightMm: i.height_mm ? Number(i.height_mm) : null, color: i.color ?? null })),
    checklist: (checklist as Row[]).map((c) => ({ title: c.title as string, done: Boolean(c.done_at) })),
    issues: ((r.issues ?? []) as Row[]).map((i) => ({ kind: i.kind as string, text: i.text as string })),
    signed: r.signed_at ? { name: r.signed_name as string, at: r.signed_at } : null,
  };
}

/**
 * The customer signs the delivery: name and acceptance, with the time and address of the request.
 * The job becomes done, and a "mark the order delivered" suggestion waits for the office.
 */
export async function signDelivery(token: string, raw: unknown, client: { ip: string; agent: string }) {
  const limit = await consumeRateLimit('quoteDecision', `signoff:${client.ip || 'unknown'}`);
  if (!limit.allowed) throw new WorkOrderApiError('Çok fazla deneme; biraz sonra tekrar deneyin', 429);
  const d = z.object({ name: z.string().trim().min(3).max(120), accept: z.literal(true), note: z.string().trim().max(1000).nullish() }).strict().parse(raw);
  const signed = await withTransaction(async (tx: any) => {
    const r = await signoffRow(tx, token, true);
    if (!r) throw new WorkOrderApiError('Bu bağlantı geçersiz ya da süresi dolmuş', 404);
    if (r.signed_at) throw new WorkOrderApiError('Teslim zaten imzalandı', 409);
    // A job taken back to the plan or cancelled after the link was sent cannot be signed.
    if (r.status !== 'in_progress' && r.status !== 'done') throw new WorkOrderApiError('Bu montaj şu an teslim edilebilir durumda değil; firmayla görüşün', 409);
    await tx`UPDATE installations SET signed_name = ${d.name}, signed_at = now(), signed_ip = ${client.ip.slice(0, 80)}, signed_note = ${d.note || null},
      status = 'done', completed_at = coalesce(completed_at, now()), version = version + 1, updated_at = now() WHERE id = ${r.id}`;
    await recordAudit(tx, { tenantId: r.tenant_id, actorId: null, entityType: 'installation', entityId: r.id, action: 'delivery_signed', note: d.note || null, metadata: { name: d.name, ip: client.ip.slice(0, 80), agent: client.agent.slice(0, 200) } });
    return { tenantId: String(r.tenant_id), id: String(r.id) };
  });
  await suggestDelivered(signed.tenantId, signed.id, null, `Müşteri teslimi "${d.name}" adıyla imzaladı.`);
  return { ok: true };
}

/** Files the approval-gated "mark the order delivered" suggestion (the kind decides when it may). */
async function suggestDelivered(tenantId: string, installationId: string, actorId: string | null, why: string) {
  try {
    if (!(await tableExists('ai_suggestions'))) return;
    const { fileDeliveredSuggestion } = await import('@/lib/ai/suggestions/kinds/mark-delivered');
    await fileDeliveredSuggestion(tenantId, installationId, actorId, why);
  } catch (error) {
    console.error('[installations] delivered suggestion failed', error instanceof Error ? error.message : error);
  }
}

/** Installations of an order (for the order screen's chain panel). */
export async function installationsForOrder(actor: WorkOrderActor, orderId: string, accessChecked = false) {
  if (!(await tableExists('installations')) || (!accessChecked && !(await hasCap(actor, 'installations', 'view')))) return [];
  const rows = await sql.unsafe(`SELECT ${SELECT} FROM installations i JOIN orders o ON o.id = i.order_id AND o.tenant_id = i.tenant_id
    WHERE i.tenant_id = $1 AND i.order_id = $2 AND ($3::uuid IS NULL OR $3::uuid = ANY(i.crew)) ORDER BY i.created_at`, [actor.tenantId, orderId, fieldOnly(actor) ? actor.userId : null]);
  return rows.map((r: Row) => dto(r, fieldOnly(actor)));
}
