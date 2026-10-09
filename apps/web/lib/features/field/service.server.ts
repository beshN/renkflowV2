import 'server-only';

import { z } from 'zod';
import { sql, withTransaction } from '@/lib/db';
import { changedFields, recordAudit } from '@/lib/audit/audit-log';
import { tableExists } from '@/lib/db/schema-guard';
import { istanbulToday } from '@/lib/features/sales/order-status.server';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import {
  DEFAULT_WARRANTY_MONTHS, TICKET_CATEGORIES, TICKET_STATUSES, serviceReport, ticketStatusProblem, warrantyStatus,
  type TicketStatus,
} from './engine';
import { hasCap, isoDay, nextNumber, requireCap, requireChain } from './common.server';
import { resolveMemberAccess } from '@/lib/security/member-access.server';
import { can } from '@/lib/security/access-matrix';

type Row = Record<string, any>;
const fieldOnly = (actor: WorkOrderActor) => actor.role === 'worker';

export async function warrantyMonths(tenantId: string) {
  const [r] = await sql`SELECT warranty_months FROM service_settings WHERE tenant_id = ${tenantId}`;
  return r ? Number(r.warranty_months) : DEFAULT_WARRANTY_MONTHS;
}

export async function saveWarrantyMonths(actor: WorkOrderActor, raw: unknown) {
  await requireChain();
  await requireCap(actor, 'settings', 'edit', 'Garanti süresini değiştirme');
  const months = z.object({ warrantyMonths: z.coerce.number().int().min(0).max(240) }).strict().parse(raw).warrantyMonths;
  const before = await warrantyMonths(actor.tenantId);
  await withTransaction(async (tx: any) => {
    await tx`INSERT INTO service_settings (tenant_id, warranty_months, updated_by) VALUES (${actor.tenantId}, ${months}, ${actor.userId})
      ON CONFLICT (tenant_id) DO UPDATE SET warranty_months = EXCLUDED.warranty_months, updated_by = EXCLUDED.updated_by, updated_at = now()`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'tenant_settings', entityId: actor.tenantId, action: 'warranty_changed', changes: { garantiAy: { from: before, to: months } } });
  });
  return { warrantyMonths: months };
}

/** A ticket as people see it; the field crew gets the technical view (no customer, no order value). */
function dto(r: Row, technical: boolean) {
  const base = {
    id: String(r.id), number: r.ticket_number as string, title: r.title as string, description: r.description ?? null, category: r.category as string,
    priority: r.priority as string, status: r.status as TicketStatus, assignedTo: r.assigned_to ? String(r.assigned_to) : null, assigneeName: r.assignee_name ?? null,
    orderId: r.order_id ? String(r.order_id) : null, orderNumber: r.order_number ?? null, installationId: r.installation_id ? String(r.installation_id) : null,
    productFamily: r.product_family ?? null, inWarranty: Boolean(r.in_warranty), warrantyEndsOn: isoDay(r.warranty_ends_on),
    parts: (r.parts ?? []) as Array<{ name: string; quantity: number }>, laborMinutes: Number(r.labor_minutes), resolution: r.resolution ?? null,
    openedAt: r.opened_at, resolvedAt: r.resolved_at, closedAt: r.closed_at, version: Number(r.version),
  };
  return technical ? { ...base, technicalView: true as const } : { ...base, customerName: r.customer_name ?? null, customerId: r.customer_id ? String(r.customer_id) : null };
}

/** The lead whose quote was converted into this order (none for orders made otherwise). */
const leadBehindOrder = (db: any, tenantId: string, orderId: string) => db`
  SELECT l.id, l.lead_number, l.source, l.quotation_id, l.product_family FROM leads l JOIN quotations q ON q.id = l.quotation_id AND q.tenant_id = l.tenant_id
  WHERE l.tenant_id = ${tenantId} AND q.converted_to_order_id = ${orderId} LIMIT 1`;

const SELECT = `t.*, o.order_number, o.customer_name, u.name AS assignee_name`;
const FROM = `FROM service_tickets t LEFT JOIN orders o ON o.id = t.order_id AND o.tenant_id = t.tenant_id LEFT JOIN users u ON u.id = t.assigned_to`;

export async function listTickets(actor: WorkOrderActor, status?: string | null) {
  await requireChain();
  await requireCap(actor, 'service', 'view', 'Servis kayıtlarını görme');
  const s = status && (TICKET_STATUSES as readonly string[]).includes(status) ? status : null;
  const rows = await sql.unsafe(`SELECT ${SELECT} ${FROM} WHERE t.tenant_id = $1 AND ($2::text IS NULL OR t.status = $2) AND ($3::uuid IS NULL OR t.assigned_to = $3::uuid)
    ORDER BY (t.status IN ('resolved','closed')), t.opened_at DESC LIMIT 500`, [actor.tenantId, s, fieldOnly(actor) ? actor.userId : null]);
  return rows.map((r: Row) => dto(r, fieldOnly(actor)));
}

async function load(db: any, actor: WorkOrderActor, id: string, lock = false) {
  const [r] = lock
    ? await db`SELECT * FROM service_tickets WHERE tenant_id = ${actor.tenantId} AND id = ${id} FOR UPDATE`
    : await db`SELECT * FROM service_tickets WHERE tenant_id = ${actor.tenantId} AND id = ${id}`;
  if (!r || (fieldOnly(actor) && String(r.assigned_to) !== actor.userId)) throw new WorkOrderApiError('Servis kaydı bulunamadı', 404);
  return r;
}

export async function getTicket(actor: WorkOrderActor, id: string) {
  await requireChain();
  await requireCap(actor, 'service', 'view', 'Servis kaydını görme');
  await load(sql, actor, id);
  const [r] = await sql.unsafe(`SELECT ${SELECT} ${FROM} WHERE t.tenant_id = $1 AND t.id = $2`, [actor.tenantId, id]);
  return dto(r, fieldOnly(actor));
}

const OpenInput = z.object({
  orderId: z.string().uuid().nullish(),
  installationId: z.string().uuid().nullish(),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(4000).nullish(),
  category: z.enum(TICKET_CATEGORIES).default('other'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  assignedTo: z.string().uuid().nullish(),
}).strict();

/**
 * One click from an order or installation to an after-sales ticket. The warranty is judged at
 * opening from the order's delivery day and the firm's warranty months, and kept on the ticket.
 */
export async function openTicket(actor: WorkOrderActor, raw: unknown) {
  await requireChain();
  await requireCap(actor, 'service', 'create', 'Servis kaydı açma');
  if (fieldOnly(actor)) throw new WorkOrderApiError('Servis kaydını ofis açar', 403);
  const d = OpenInput.parse(raw);
  const months = await warrantyMonths(actor.tenantId);
  return withTransaction(async (tx: any) => {
    let orderId = d.orderId ?? null;
    if (d.installationId) {
      const [i] = await tx`SELECT order_id FROM installations WHERE tenant_id = ${actor.tenantId} AND id = ${d.installationId}`;
      if (!i) throw new WorkOrderApiError('Montaj bulunamadı', 404);
      if (orderId && orderId !== String(i.order_id)) throw new WorkOrderApiError('Montaj bu siparişe ait değil', 400);
      orderId = String(i.order_id);
    }
    const [o] = orderId ? await tx`SELECT id, customer_id, delivered_on FROM orders WHERE tenant_id = ${actor.tenantId} AND id = ${orderId}` : [null];
    if (orderId && !o) throw new WorkOrderApiError('Sipariş bulunamadı', 404);
    if (d.assignedTo) {
      const [m] = await tx`SELECT 1 FROM tenant_members WHERE tenant_id = ${actor.tenantId} AND user_id = ${d.assignedTo} AND (to_jsonb(tenant_members) ->> 'deactivated_at') IS NULL`;
      if (!m) throw new WorkOrderApiError('Atanan kişi bu firmanın aktif üyesi değil', 400);
    }
    // The family from the lead whose quote became this very order, when there is one.
    const [fam] = orderId ? await leadBehindOrder(tx, actor.tenantId, orderId) : [null];
    const warranty = warrantyStatus(o?.delivered_on ? isoDay(o.delivered_on) : null, months, istanbulToday());
    const number = await nextNumber(tx, actor.tenantId, 'service_tickets', 'ticket_number', 'SRV');
    const [row] = await tx`INSERT INTO service_tickets (tenant_id, ticket_number, order_id, installation_id, customer_id, title, description, category, priority, status,
        assigned_to, product_family, in_warranty, warranty_ends_on, created_by)
      VALUES (${actor.tenantId}, ${number}, ${orderId}, ${d.installationId ?? null}, ${o?.customer_id ?? null}, ${d.title}, ${d.description || null}, ${d.category}, ${d.priority},
        ${d.assignedTo ? 'assigned' : 'open'}, ${d.assignedTo ?? null}, ${fam?.product_family ?? null}, ${warranty.covered}, ${warranty.endsOn}, ${actor.userId}) RETURNING id`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'service_ticket', entityId: row.id, action: 'created', metadata: { number, orderId, inWarranty: warranty.covered, warrantyEndsOn: warranty.endsOn } });
    if (orderId) await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'order', entityId: orderId, action: 'service_ticket_opened', metadata: { ticketId: row.id, number } });
    return { id: String(row.id), number, inWarranty: warranty.covered, warrantyEndsOn: warranty.endsOn, warrantyNote: warranty.reason };
  });
}

const UpdateInput = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  assignedTo: z.string().uuid().nullish(),
  resolution: z.string().trim().max(4000).nullish(),
  parts: z.array(z.object({ name: z.string().trim().min(1).max(200), quantity: z.coerce.number().positive().max(100000) }).strict()).max(50).optional(),
  laborMinutes: z.coerce.number().int().min(0).max(100000).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  expectedVersion: z.number().int().optional(),
}).strict();

/** Assign, record parts and labour, move the status (resolving needs a written resolution). */
export async function updateTicket(actor: WorkOrderActor, id: string, raw: unknown) {
  await requireChain();
  await requireCap(actor, 'service', 'edit', 'Servis kaydını güncelleme');
  const d = UpdateInput.parse(raw);
  await withTransaction(async (tx: any) => {
    const before = await load(tx, actor, id, true);
    if (d.expectedVersion !== undefined && Number(before.version) !== d.expectedVersion) throw new WorkOrderApiError('Kayıt bu arada değişti; yenileyin', 409);
    if (fieldOnly(actor) && (d.assignedTo !== undefined || d.priority !== undefined)) throw new WorkOrderApiError('Atamayı ve önceliği ofis değiştirir', 403);
    if (before.status === 'closed') throw new WorkOrderApiError('Kapanmış kayıt değiştirilemez', 409);
    const assigned = d.assignedTo === undefined ? before.assigned_to : d.assignedTo;
    if (d.assignedTo) {
      const [m] = await tx`SELECT 1 FROM tenant_members WHERE tenant_id = ${actor.tenantId} AND user_id = ${d.assignedTo} AND (to_jsonb(tenant_members) ->> 'deactivated_at') IS NULL`;
      if (!m) throw new WorkOrderApiError('Atanan kişi bu firmanın aktif üyesi değil', 400);
    }
    let status: TicketStatus = d.status ?? before.status;
    if (!d.status && d.assignedTo && before.status === 'open') status = 'assigned';
    const resolution = d.resolution === undefined ? before.resolution : d.resolution || null;
    const problem = ticketStatusProblem(before.status, status, resolution);
    if (problem) throw new WorkOrderApiError(problem, 409);
    const next = {
      status, assigned_to: assigned, resolution, parts: d.parts ?? before.parts ?? [], labor_minutes: d.laborMinutes ?? Number(before.labor_minutes), priority: d.priority ?? before.priority,
    };
    await tx`UPDATE service_tickets SET status = ${status}, assigned_to = ${assigned}, resolution = ${resolution}, parts = ${JSON.stringify(next.parts)}::text::jsonb,
      labor_minutes = ${next.labor_minutes}, priority = ${next.priority},
      resolved_at = ${status === 'resolved' || status === 'closed' ? before.resolved_at ?? new Date() : null}, closed_at = ${status === 'closed' ? new Date() : null},
      version = version + 1, updated_at = now() WHERE tenant_id = ${actor.tenantId} AND id = ${id}`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'service_ticket', entityId: id, action: status !== before.status ? 'status_changed' : 'updated', changes: changedFields(before, next) });
  });
  return getTicket(actor, id);
}

/** Resolution times and recurring issues. */
export async function ticketReport(actor: WorkOrderActor) {
  await requireChain();
  await requireCap(actor, 'service', 'view', 'Servis raporu');
  const rows = await sql`SELECT id, order_id, category, product_family, opened_at, resolved_at FROM service_tickets WHERE tenant_id = ${actor.tenantId}`;
  const report = serviceReport(rows.map((r: Row) => ({ id: String(r.id), orderId: r.order_id ? String(r.order_id) : null, category: r.category, family: r.product_family ?? null, openedAt: new Date(r.opened_at).toISOString(), resolvedAt: r.resolved_at ? new Date(r.resolved_at).toISOString() : null })));
  const ids = report.recurring.byOrder.map((r) => r.orderId);
  const numbers = ids.length ? await sql`SELECT id, order_number FROM orders WHERE tenant_id = ${actor.tenantId} AND id = ANY(${ids}::uuid[])` : [];
  const byId = new Map(numbers.map((n: Row) => [String(n.id), n.order_number as string]));
  return { ...report, recurring: { ...report.recurring, byOrder: report.recurring.byOrder.map((r) => ({ ...r, orderNumber: byId.get(r.orderId) ?? null })) }, warrantyMonths: await warrantyMonths(actor.tenantId) };
}

/** Tickets of an order (chain panel). */
export async function ticketsForOrder(actor: WorkOrderActor, orderId: string, accessChecked = false) {
  if (!(await tableExists('service_tickets')) || (!accessChecked && !(await hasCap(actor, 'service', 'view')))) return [];
  const rows = await sql.unsafe(`SELECT ${SELECT} ${FROM} WHERE t.tenant_id = $1 AND t.order_id = $2 AND ($3::uuid IS NULL OR t.assigned_to = $3::uuid) ORDER BY t.opened_at DESC`,
    [actor.tenantId, orderId, fieldOnly(actor) ? actor.userId : null]);
  return rows.map((r: Row) => dto(r, fieldOnly(actor)));
}

/**
 * The whole chain of an order: lead and quote behind it, installations, sign-off, tickets,
 * warranty. The field crew sees it only for an order they work on, without the lead.
 */
export async function orderChain(actor: WorkOrderActor, orderId: string) {
  if (!(await tableExists('installations'))) return { available: false as const };
  const access = await resolveMemberAccess(actor.userId, actor.tenantId);
  if (!access || access.deactivated) throw new WorkOrderApiError('Unauthorized', 401);
  const cap = (m: Parameters<typeof can>[1], a: Parameters<typeof can>[2]) => can(access, m, a);
  const [o] = await sql`SELECT id, status, delivered_on FROM orders WHERE tenant_id = ${actor.tenantId} AND id = ${orderId}`;
  if (!o) throw new WorkOrderApiError('Sipariş bulunamadı', 404);
  const technical = fieldOnly(actor);
  const { installationsForOrder } = await import('./installations.server');
  const [lead, installations, tickets, months] = await Promise.all([
    !technical && cap('crm', 'view') ? leadBehindOrder(sql, actor.tenantId, orderId).then((rows: Row[]) => rows[0] ?? null) : Promise.resolve(null),
    cap('installations', 'view') ? installationsForOrder(actor, orderId, true) : Promise.resolve([]),
    cap('service', 'view') ? ticketsForOrder(actor, orderId, true) : Promise.resolve([]),
    warrantyMonths(actor.tenantId),
  ]);
  if (technical && !installations.length && !tickets.length) throw new WorkOrderApiError('Sipariş bulunamadı', 404);
  return {
    available: true as const,
    lead: lead ? { id: String(lead.id), number: lead.lead_number as string, source: lead.source as string, quotationId: lead.quotation_id ? String(lead.quotation_id) : null } : null,
    installations,
    tickets,
    warranty: warrantyStatus(isoDay(o.delivered_on), months, istanbulToday()),
    can: {
      planInstallation: !technical && cap('installations', 'create') && o.status !== 'cancelled',
      openTicket: !technical && cap('service', 'create'),
    },
  };
}
