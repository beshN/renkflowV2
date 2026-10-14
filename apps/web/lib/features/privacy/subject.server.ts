import 'server-only';

import { z } from 'zod';

import { recordAudit } from '@/lib/audit/audit-log';
import { columnExists, tableExists } from '@/lib/db/schema-guard';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';

// KVKK for the firm's own customers: the request register (m.11, answered within 30 days, m.13),
// a data export of everything held about a customer, and erasure by anonymisation.
//
// What erasure keeps: invoices, collections and the ledger. Commercial books and their documents
// must be kept for 10 years (TTK m.82) and tax records for 5 (VUK m.253); keeping them is a legal
// obligation (KVKK m.5/2-ç) and they are not changed.

type Db = any;
type Row = Record<string, any>;

export const REQUEST_KINDS = { access: 'Bilgi / veri dökümü', rectification: 'Düzeltme', erasure: 'Silme', objection: 'İtiraz', other: 'Diğer' } as const;
const DAY_MS = 86_400_000;
const istanbulToday = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date());
export const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

function requireManager(actor: WorkOrderActor) {
  if (!['owner', 'admin'].includes(actor.role)) throw new WorkOrderApiError('KVKK işlemlerini firma yöneticisi yapabilir.', 403);
}

async function ready() {
  if (!(await tableExists('data_subject_requests'))) throw new WorkOrderApiError('KVKK kayıtları bu kurulumda henüz etkin değil.', 503);
}

// --- Request register ----------------------------------------------------------------------------

export const NewRequest = z.object({
  kind: z.enum(Object.keys(REQUEST_KINDS) as [keyof typeof REQUEST_KINDS, ...(keyof typeof REQUEST_KINDS)[]]),
  subjectName: z.string().trim().min(1).max(200),
  subjectContact: z.string().trim().max(200).optional(),
  customerId: z.string().uuid().optional(),
  details: z.string().trim().max(4000).optional(),
  receivedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).strict();

export async function listRequests(db: Db, actor: WorkOrderActor) {
  requireManager(actor);
  await ready();
  const rows = await db`SELECT r.*, c.full_name AS customer_name FROM data_subject_requests r LEFT JOIN customers c ON c.id = r.customer_id
    WHERE r.tenant_id = ${actor.tenantId} ORDER BY (r.status = 'open') DESC, r.due_on, r.created_at DESC LIMIT 300`;
  const today = istanbulToday();
  const day = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10);
  return rows.map((r: Row) => ({
    id: String(r.id), kind: r.kind as keyof typeof REQUEST_KINDS, subjectName: r.subject_name as string, subjectContact: r.subject_contact ?? null,
    customerId: r.customer_id ? String(r.customer_id) : null, customerName: r.customer_name ?? null, details: r.details ?? null,
    receivedOn: day(r.received_on), dueOn: day(r.due_on), status: r.status as 'open' | 'completed' | 'rejected', resolution: r.resolution ?? null,
    overdue: r.status === 'open' && day(r.due_on) < today,
  }));
}

export async function createRequest(db: Db, actor: WorkOrderActor, raw: unknown) {
  requireManager(actor);
  await ready();
  const d = NewRequest.parse(raw);
  const receivedOn = d.receivedOn ?? istanbulToday();
  if (receivedOn > istanbulToday()) throw new WorkOrderApiError('Başvuru tarihi ileri bir gün olamaz', 400);
  if (d.customerId) {
    const [c] = await db`SELECT 1 FROM customers WHERE tenant_id = ${actor.tenantId} AND id = ${d.customerId}`;
    if (!c) throw new WorkOrderApiError('Müşteri bulunamadı', 404);
  }
  return db.begin(async (tx: Db) => {
    const [r] = await tx`INSERT INTO data_subject_requests (tenant_id, kind, subject_name, subject_contact, customer_id, details, received_on, due_on, created_by)
      VALUES (${actor.tenantId}, ${d.kind}, ${d.subjectName}, ${d.subjectContact || null}, ${d.customerId ?? null}, ${d.details || null}, ${receivedOn}, ${addDays(receivedOn, 30)}, ${actor.userId}) RETURNING id, due_on`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'privacy_request', entityId: r.id, action: 'privacy_request_received', metadata: { kind: d.kind } });
    return { id: String(r.id), dueOn: addDays(receivedOn, 30) };
  });
}

export async function closeRequest(db: Db, actor: WorkOrderActor, id: string, raw: unknown) {
  requireManager(actor);
  await ready();
  const d = z.object({ status: z.enum(['completed', 'rejected']), resolution: z.string().trim().min(3).max(4000) }).strict().parse(raw);
  await db.begin(async (tx: Db) => {
    const [r] = await tx`UPDATE data_subject_requests SET status = ${d.status}, resolution = ${d.resolution}, closed_by = ${actor.userId}, closed_at = now()
      WHERE tenant_id = ${actor.tenantId} AND id = ${id} AND status = 'open' RETURNING id`;
    if (!r) throw new WorkOrderApiError('Açık başvuru bulunamadı', 404);
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'privacy_request', entityId: id, action: 'privacy_request_closed', metadata: { status: d.status } });
  });
}

// --- Export --------------------------------------------------------------------------------------

async function rowsIf(db: Db, table: string, query: () => Promise<Row[]>): Promise<Row[]> {
  return (await tableExists(table)) ? query() : [];
}

/** Everything held about a customer, as one JSON document (KVKK m.11 access request). */
export async function exportCustomerData(db: Db, actor: WorkOrderActor, customerId: string) {
  requireManager(actor);
  const t = actor.tenantId;
  const [customer] = await db`SELECT * FROM customers WHERE tenant_id = ${t} AND id = ${customerId}`;
  if (!customer) throw new WorkOrderApiError('Müşteri bulunamadı', 404);
  const orders = await db`SELECT id, order_number, status, product_name, customer_name, email, phone, total_amount, currency, delivery_date, created_at FROM orders WHERE tenant_id = ${t} AND customer_id = ${customerId} ORDER BY created_at`;
  const orderIds = orders.map((o: Row) => o.id);
  const document = {
    generatedAt: new Date().toISOString(),
    notice: 'KVKK m.11 kapsamında hazırlanan veri dökümü. Fatura ve tahsilat kayıtları yasal saklama yükümlülüğü (TTK m.82, VUK m.253) nedeniyle saklanmaktadır.',
    customer: { ...customer, tenant_id: undefined },
    orders,
    quotations: await rowsIf(db, 'quotations', () => db`SELECT quotation_number, status, customer_name, currency, created_at FROM quotations WHERE tenant_id = ${t} AND customer_id = ${customerId} ORDER BY created_at`),
    invoices: await rowsIf(db, 'invoices', () => db`SELECT invoice_number, status, issued_on, customer_name, customer_tax_number, customer_address, total, currency FROM invoices WHERE tenant_id = ${t} AND customer_id = ${customerId} ORDER BY created_at`),
    payments: orderIds.length ? await db`SELECT paid_at, amount, currency, method, reference FROM payments WHERE tenant_id = ${t} AND order_id = ANY(${orderIds}) ORDER BY paid_at` : [],
    installations: orderIds.length ? await rowsIf(db, 'installations', () => db`SELECT installation_number, status, start_time, address, signed_name FROM installations WHERE tenant_id = ${t} AND order_id = ANY(${orderIds})`) : [],
    leads: await rowsIf(db, 'leads', () => db`SELECT lead_number, title, contact_name, phone, email, address, stage, created_at FROM leads WHERE tenant_id = ${t} AND customer_id = ${customerId}`),
    serviceTickets: await rowsIf(db, 'service_tickets', () => db`SELECT ticket_number, title, status, created_at FROM service_tickets WHERE tenant_id = ${t} AND customer_id = ${customerId}`),
    privacyRequests: await rowsIf(db, 'data_subject_requests', () => db`SELECT kind, received_on, due_on, status, resolution FROM data_subject_requests WHERE tenant_id = ${t} AND customer_id = ${customerId}`),
  };
  await recordAudit(db, { tenantId: t, actorId: actor.userId, entityType: 'customer', entityId: customerId, action: 'personal_data_exported' });
  return document;
}

// --- Erasure -------------------------------------------------------------------------------------

/**
 * Anonymises a customer: name, contact details, addresses and free-text notes everywhere they were
 * copied. Invoices, collections and the ledger are kept unchanged (legal retention). Irreversible.
 */
export async function anonymizeCustomer(db: Db, actor: WorkOrderActor, customerId: string, raw: unknown) {
  requireManager(actor);
  const { confirmName, requestId } = z.object({ confirmName: z.string().trim().min(1), requestId: z.string().uuid().optional() }).strict().parse(raw);
  return db.begin(async (tx: Db) => {
    const [c] = await tx`SELECT id, full_name, tax_number, to_jsonb(customers) ->> 'anonymized_at' AS anonymized_at FROM customers WHERE tenant_id = ${actor.tenantId} AND id = ${customerId} FOR UPDATE`;
    if (!c) throw new WorkOrderApiError('Müşteri bulunamadı', 404);
    if (c.anonymized_at) throw new WorkOrderApiError('Bu müşterinin verileri zaten silinmiş', 409);
    if (confirmName.toLocaleLowerCase('tr') !== String(c.full_name).trim().toLocaleLowerCase('tr')) throw new WorkOrderApiError('Onay için müşterinin adını aynen yazın', 400);
    const placeholder = `Silinmiş kişi ${String(customerId).slice(0, 6)}`;
    const personalTax = typeof c.tax_number === 'string' && /^\d{11}$/.test(c.tax_number);
    const counts: Record<string, number> = {};
    const run = async (label: string, table: string, query: () => Promise<Row[]>) => {
      if (await tableExists(table)) counts[label] = (await query()).length;
    };

    // A person's TCKN is personal data; a company's name and VKN are not (KVKK covers natural persons).
    await tx`UPDATE customers SET full_name = ${placeholder}, email = NULL, phone = NULL, address = NULL, billing_address = NULL, shipping_address = NULL,
      contacts = '[]'::jsonb, notes = NULL,
      tax_number = CASE WHEN ${personalTax} THEN NULL ELSE tax_number END,
      company_name = CASE WHEN ${personalTax} THEN NULL ELSE company_name END,
      updated_at = now() WHERE id = ${customerId}`;
    if (await columnExists('customers', 'city')) await tx`UPDATE customers SET city = NULL, district = NULL WHERE id = ${customerId}`;
    if (await columnExists('customers', 'anonymized_at')) await tx`UPDATE customers SET anonymized_at = now() WHERE id = ${customerId}`;

    const orders = await tx`UPDATE orders SET customer_name = ${placeholder}, email = NULL, phone = NULL WHERE tenant_id = ${actor.tenantId} AND customer_id = ${customerId} RETURNING id`;
    counts.orders = orders.length;
    const orderIds = orders.map((o: Row) => o.id);
    await run('quotations', 'quotations', () => tx`UPDATE quotations SET customer_name = ${placeholder} WHERE tenant_id = ${actor.tenantId} AND customer_id = ${customerId} RETURNING id`);
    if (await columnExists('quotations', 'customer_decision_name')) {
      await tx`UPDATE quotations SET customer_decision_name = NULL, customer_decision_ip = NULL, customer_decision_agent = NULL, customer_decision_note = NULL WHERE tenant_id = ${actor.tenantId} AND customer_id = ${customerId}`;
    }
    await run('leads', 'leads', () => tx`UPDATE leads SET contact_name = ${placeholder}, phone = NULL, email = NULL, address = NULL WHERE tenant_id = ${actor.tenantId} AND customer_id = ${customerId} RETURNING id`);
    if (orderIds.length) {
      await run('installations', 'installations', () => tx`UPDATE installations SET address = NULL, signed_name = NULL, signed_ip = NULL, signed_note = NULL WHERE tenant_id = ${actor.tenantId} AND order_id = ANY(${orderIds}) RETURNING id`);
      await run('siteSurveys', 'site_surveys', () => tx`UPDATE site_surveys SET address = NULL WHERE tenant_id = ${actor.tenantId} AND order_id = ANY(${orderIds}) RETURNING id`);
      await run('trackingLinks', 'customer_tracking_links', () => tx`UPDATE customer_tracking_links SET revoked_at = coalesce(revoked_at, now()) WHERE tenant_id = ${actor.tenantId} AND order_id = ANY(${orderIds}) RETURNING id`);
      // Sent messages lose their recipient and content; unsent ones are not sent at all.
      await run('messages', 'notification_outbox', () => tx`UPDATE notification_outbox SET recipient = 'silindi:' || id, payload = '{}'::jsonb,
          status = CASE WHEN status IN ('pending', 'sending') THEN 'suppressed' ELSE status END
        WHERE tenant_id = ${actor.tenantId} AND order_id = ANY(${orderIds}) RETURNING id`);
    }
    // The audit trail keeps every event, but the old values recorded on this customer's own history
    // (e-mail, phone, address …) are personal data too: the values are removed under the logged
    // purge switch of migration 051. The erasure itself is recorded below.
    await tx`SELECT set_config('renkflow.audit_purge', 'on', true)`;
    const redacted = await tx`UPDATE activity_logs SET changes = CASE WHEN changes IS NULL OR changes = '{}'::jsonb THEN changes ELSE '{"kvkk":"silindi"}'::jsonb END,
        note = NULL, metadata = CASE WHEN metadata ? 'email' OR metadata ? 'phone' THEN metadata - 'email' - 'phone' ELSE metadata END
      WHERE tenant_id = ${actor.tenantId} AND entity_type = 'customer' AND entity_id = ${customerId} RETURNING id`;
    counts.auditValuesRedacted = redacted.length;
    await tx`SELECT set_config('renkflow.audit_purge', 'off', true)`;
    if (requestId) {
      await tx`UPDATE data_subject_requests SET status = 'completed', resolution = 'Kişisel veriler anonimleştirildi; fatura ve muhasebe kayıtları yasal saklama süresince korunur.', closed_by = ${actor.userId}, closed_at = now()
        WHERE tenant_id = ${actor.tenantId} AND id = ${requestId} AND status = 'open'`;
    }
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'customer', entityId: customerId, action: 'personal_data_erased', metadata: { counts, requestId: requestId ?? null } });
    return { placeholder, counts };
  });
}
