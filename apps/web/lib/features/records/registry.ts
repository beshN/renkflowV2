import 'server-only';

import { hasPermission, type UserRole } from '@/lib/auth/permissions';
import { can } from '@/lib/security/access-matrix';
import { resolveMemberAccess } from '@/lib/security/member-access.server';
import { tableExists } from '@/lib/db/schema-guard';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { RECORD_TYPES, type RecordType } from './types';

export type RecordHead = { type: RecordType; id: string; title: string; subtitle: string | null; href: string };
export type RelatedLink = { key: string; label: string; count: number; href: string };

type Def = {
  label: string;
  /** Who may open the record (and comment, follow). */
  canView: (role: UserRole) => boolean;
  /** Who may change its tags, owner, due date, checklist and activities. */
  canEdit: (role: UserRole) => boolean;
  /** Entity types the audit trail has used for this record. */
  auditTypes: string[];
  head: (db: any, actor: WorkOrderActor, id: string) => Promise<RecordHead | null>;
  related: (db: any, actor: WorkOrderActor, id: string) => Promise<RelatedLink[]>;
  /** A further check on the member's own access matrix (beyond the base role), when the module has one. */
  allows?: (actor: Pick<WorkOrderActor, 'tenantId' | 'userId'>, need: 'view' | 'edit') => Promise<boolean>;
};

const OFFICE: UserRole[] = ['owner', 'admin', 'office'];
const OFFICE_AND_ACCOUNTS: UserRole[] = ['owner', 'admin', 'office', 'accountant'];
const n = (v: unknown) => Number(v) || 0;
/** The member's fleet cell (a custom role can take the fleet away from an admin). */
const fleetCell = async (a: Pick<WorkOrderActor, 'tenantId' | 'userId'>, need: 'view' | 'edit') => {
  const access = await resolveMemberAccess(a.userId, a.tenantId);
  return Boolean(access && !access.deactivated && can(access, 'fleet', 'view') && can(access, 'fleet', need));
};
const optional = async (table: string, query: () => Promise<any[]>) => ((await tableExists(table)) ? query() : [{ n: 0 }]);

/**
 * Every record the platform serves, with its own permission rules: customer data (orders,
 * quotations, customers, suppliers) never opens for a worker; a worker sees a work order only when
 * it is assigned to them (the same rule as the factory screen).
 */
export const RECORDS: Record<RecordType, Def> = {
  order: {
    label: 'Sipariş',
    canView: (r) => r !== 'worker' && hasPermission(r, 'orders.view'),
    canEdit: (r) => hasPermission(r, 'orders.edit'),
    auditTypes: ['order', 'orders'],
    head: async (db, a, id) => {
      const [o] = await db`SELECT order_number, customer_name FROM orders WHERE tenant_id = ${a.tenantId} AND id = ${id}`;
      return o ? { type: 'order', id, title: o.order_number, subtitle: o.customer_name, href: `/orders/${id}` } : null;
    },
    related: async (db, a, id) => {
      const [o] = await db`SELECT customer_id FROM orders WHERE tenant_id = ${a.tenantId} AND id = ${id}`;
      const [[q], [w], [s], [p]] = await Promise.all([
        db`SELECT count(*)::int AS n, min(id::text) AS first FROM quotations WHERE tenant_id = ${a.tenantId} AND converted_to_order_id = ${id}`,
        db`SELECT count(*)::int AS n FROM work_orders WHERE tenant_id = ${a.tenantId} AND order_id = ${id}`,
        optional('production_shipments', () => db`SELECT count(*)::int AS n FROM production_shipments WHERE tenant_id = ${a.tenantId} AND order_id = ${id}`),
        optional('payments', () => db`SELECT count(*)::int AS n FROM payments WHERE order_id = ${id}`),
      ]);
      return [
        { key: 'quotation', label: 'Teklif', count: n(q.n), href: q.first ? `/quotations/${q.first}` : '/quotations' },
        { key: 'work_orders', label: 'İş emri', count: n(w.n), href: `/work-orders?search=${encodeURIComponent(id)}` },
        { key: 'shipments', label: 'Sevkiyat', count: n(s.n), href: '/shipments' },
        { key: 'payments', label: 'Tahsilat', count: n(p.n), href: `/orders/${id}?tab=info` },
        ...(o?.customer_id ? [{ key: 'customer', label: 'Müşteri', count: 1, href: `/crm/${o.customer_id}` }] : []),
      ];
    },
  },
  quotation: {
    label: 'Teklif',
    canView: (r) => OFFICE_AND_ACCOUNTS.includes(r),
    canEdit: (r) => OFFICE.includes(r),
    auditTypes: ['quotation', 'quotations'],
    head: async (db, a, id) => {
      const [q] = await db`SELECT quotation_number, customer_name FROM quotations WHERE tenant_id = ${a.tenantId} AND id = ${id}`;
      return q ? { type: 'quotation', id, title: q.quotation_number, subtitle: q.customer_name, href: `/quotations/${id}` } : null;
    },
    related: async (db, a, id) => {
      const [q] = await db`SELECT converted_to_order_id, customer_id FROM quotations WHERE tenant_id = ${a.tenantId} AND id = ${id}`;
      return [
        ...(q?.converted_to_order_id ? [{ key: 'order', label: 'Sipariş', count: 1, href: `/orders/${q.converted_to_order_id}` }] : []),
        ...(q?.customer_id ? [{ key: 'customer', label: 'Müşteri', count: 1, href: `/crm/${q.customer_id}` }] : []),
      ];
    },
  },
  customer: {
    label: 'Müşteri',
    canView: (r) => r !== 'worker' && hasPermission(r, 'customers.view'),
    canEdit: (r) => hasPermission(r, 'customers.edit'),
    auditTypes: ['customer', 'customers'],
    head: async (db, a, id) => {
      const [c] = await db`SELECT full_name AS name FROM customers WHERE tenant_id = ${a.tenantId} AND id = ${id}`;
      return c ? { type: 'customer', id, title: c.name, subtitle: null, href: `/crm/${id}` } : null;
    },
    related: async (db, a, id) => {
      const [[o], [q]] = await Promise.all([
        db`SELECT count(*)::int AS n FROM orders WHERE tenant_id = ${a.tenantId} AND customer_id = ${id}`,
        db`SELECT count(*)::int AS n FROM quotations WHERE tenant_id = ${a.tenantId} AND customer_id = ${id}`,
      ]);
      return [
        { key: 'orders', label: 'Sipariş', count: n(o.n), href: `/crm/${id}` },
        { key: 'quotations', label: 'Teklif', count: n(q.n), href: `/crm/${id}` },
      ];
    },
  },
  work_order: {
    label: 'İş emri',
    canView: (r) => hasPermission(r, 'orders.view'),
    canEdit: (r) => OFFICE.includes(r),
    auditTypes: ['work_order', 'work_orders'],
    head: async (db, a, id) => {
      const [w] = await db`
        SELECT w.title, o.order_number FROM work_orders w LEFT JOIN orders o ON o.id = w.order_id AND o.tenant_id = w.tenant_id
        WHERE w.tenant_id = ${a.tenantId} AND w.id = ${id}
          AND (${a.role !== 'worker'} OR w.assigned_to = ${a.userId}
            OR EXISTS (SELECT 1 FROM production_operations p WHERE p.tenant_id = w.tenant_id AND p.work_order_id = w.id AND p.assigned_to = ${a.userId}))`;
      // A worker sees the job, not the customer order behind it.
      return w ? { type: 'work_order', id, title: w.title, subtitle: a.role === 'worker' ? null : w.order_number ?? null, href: `/work-orders/${id}` } : null;
    },
    related: async (db, a, id) => {
      const [w] = await db`SELECT order_id FROM work_orders WHERE tenant_id = ${a.tenantId} AND id = ${id}`;
      // A worker gets no link to the order (customer data).
      return w?.order_id && a.role !== 'worker' ? [{ key: 'order', label: 'Sipariş', count: 1, href: `/orders/${w.order_id}` }] : [];
    },
  },
  inventory_item: {
    label: 'Stok kalemi',
    canView: (r) => hasPermission(r, 'inventory.view'),
    canEdit: (r) => hasPermission(r, 'inventory.edit'),
    auditTypes: ['inventory_item'],
    head: async (db, a, id) => {
      const [i] = await db`SELECT name, sku FROM inventory_items WHERE tenant_id = ${a.tenantId} AND id = ${id}`;
      return i ? { type: 'inventory_item', id, title: i.name, subtitle: i.sku, href: `/inventory/${id}` } : null;
    },
    related: async (db, a, id) => {
      const [[l]] = await Promise.all([db`SELECT count(*)::int AS n FROM stock_lots WHERE tenant_id = ${a.tenantId} AND item_id = ${id} AND remaining_qty > 0`]);
      return [{ key: 'lots', label: 'Çubuk / lot', count: n(l.n), href: `/inventory/${id}` }];
    },
  },
  supplier: {
    label: 'Tedarikçi',
    canView: (r) => OFFICE_AND_ACCOUNTS.includes(r),
    canEdit: (r) => OFFICE_AND_ACCOUNTS.includes(r),
    auditTypes: ['supplier', 'suppliers'],
    head: async (db, a, id) => {
      const [s] = await db`SELECT name FROM suppliers WHERE tenant_id = ${a.tenantId} AND id = ${id}`;
      return s ? { type: 'supplier', id, title: s.name, subtitle: null, href: `/suppliers` } : null;
    },
    related: async (db, a, id) => {
      const [p] = await optional('purchase_orders', () => db`SELECT count(*)::int AS n FROM purchase_orders WHERE tenant_id = ${a.tenantId} AND supplier_id = ${id}`);
      return [{ key: 'purchases', label: 'Satın alma', count: n(p.n), href: '/purchases' }];
    },
  },
  lead: {
    label: 'Potansiyel müşteri',
    canView: (r) => ['owner', 'admin', 'office', 'accountant'].includes(r),
    canEdit: (r) => OFFICE.includes(r),
    auditTypes: ['lead'],
    head: async (db, a, id) => {
      const [l] = await optional('leads', () => db`SELECT lead_number, title, contact_name FROM leads WHERE tenant_id = ${a.tenantId} AND id = ${id}`);
      return l?.lead_number ? { type: 'lead', id, title: `${l.lead_number} · ${l.title}`, subtitle: l.contact_name, href: `/leads?open=${id}` } : null;
    },
    related: async (db, a, id) => {
      const [l] = await db`SELECT quotation_id, customer_id FROM leads WHERE tenant_id = ${a.tenantId} AND id = ${id}`;
      const [s] = await db`SELECT count(*)::int AS n FROM site_surveys WHERE tenant_id = ${a.tenantId} AND lead_id = ${id} AND status <> 'cancelled'`;
      return [
        { key: 'surveys', label: 'Keşif', count: n(s.n), href: `/leads?open=${id}` },
        ...(l?.quotation_id ? [{ key: 'quotation', label: 'Teklif', count: 1, href: `/quotations/${l.quotation_id}` }] : []),
        ...(l?.customer_id ? [{ key: 'customer', label: 'Müşteri', count: 1, href: `/crm/${l.customer_id}` }] : []),
      ];
    },
  },
  installation: {
    label: 'Montaj',
    canView: (r) => ['owner', 'admin', 'office', 'accountant', 'worker'].includes(r),
    canEdit: (r) => ['owner', 'admin', 'office', 'worker'].includes(r),
    auditTypes: ['installation'],
    head: async (db, a, id) => {
      const [i] = await optional('installations', () => db`
        SELECT i.installation_number, o.order_number FROM installations i JOIN orders o ON o.id = i.order_id AND o.tenant_id = i.tenant_id
        WHERE i.tenant_id = ${a.tenantId} AND i.id = ${id} AND (${a.role !== 'worker'} OR ${a.userId}::uuid = ANY(i.crew))`);
      // The crew sees the job by its number, not the customer behind the order.
      return i?.installation_number ? { type: 'installation', id, title: i.installation_number, subtitle: a.role === 'worker' ? null : i.order_number, href: `/installations?open=${id}` } : null;
    },
    related: async (db, a, id) => {
      const [i] = await db`SELECT order_id FROM installations WHERE tenant_id = ${a.tenantId} AND id = ${id}`;
      const [t] = await db`SELECT count(*)::int AS n FROM service_tickets WHERE tenant_id = ${a.tenantId} AND installation_id = ${id}`;
      return [
        ...(i?.order_id && a.role !== 'worker' ? [{ key: 'order', label: 'Sipariş', count: 1, href: `/orders/${i.order_id}` }] : []),
        { key: 'tickets', label: 'Servis', count: n(t.n), href: `/service` },
      ];
    },
  },
  service_ticket: {
    label: 'Servis kaydı',
    canView: (r) => ['owner', 'admin', 'office', 'accountant', 'worker'].includes(r),
    canEdit: (r) => ['owner', 'admin', 'office', 'worker'].includes(r),
    auditTypes: ['service_ticket'],
    head: async (db, a, id) => {
      const [t] = await optional('service_tickets', () => db`SELECT ticket_number, title FROM service_tickets WHERE tenant_id = ${a.tenantId} AND id = ${id}
        AND (${a.role !== 'worker'} OR assigned_to = ${a.userId})`);
      return t?.ticket_number ? { type: 'service_ticket', id, title: `${t.ticket_number} · ${t.title}`, subtitle: null, href: `/service?open=${id}` } : null;
    },
    related: async (db, a, id) => {
      const [t] = await db`SELECT order_id FROM service_tickets WHERE tenant_id = ${a.tenantId} AND id = ${id}`;
      return t?.order_id && a.role !== 'worker' ? [{ key: 'order', label: 'Sipariş', count: 1, href: `/orders/${t.order_id}` }] : [];
    },
  },
  vehicle: {
    label: 'Araç',
    canView: (r) => r === 'owner' || r === 'admin',
    canEdit: (r) => r === 'owner' || r === 'admin',
    auditTypes: ['vehicle'],
    allows: fleetCell,
    head: async (db, a, id) => {
      if (!(await fleetCell(a, 'view'))) return null;
      const [v] = await optional('vehicles', () => db`SELECT plate, make, model FROM vehicles WHERE tenant_id = ${a.tenantId} AND id = ${id}`);
      return v?.plate ? { type: 'vehicle', id, title: String(v.plate).replace(/^(\d{2})([A-Z]+)(\d+)$/, '$1 $2 $3'), subtitle: [v.make, v.model].filter(Boolean).join(' ') || null, href: `/vehicles/${id}` } : null;
    },
    related: async (db, a, id) => {
      const [d] = await db`SELECT count(*)::int AS n FROM vehicle_documents WHERE tenant_id = ${a.tenantId} AND vehicle_id = ${id}`;
      return [{ key: 'documents', label: 'Belge', count: n(d.n), href: `/vehicles/${id}` }];
    },
  },
};

export const isRecordType = (v: string): v is RecordType => (RECORD_TYPES as readonly string[]).includes(v);

/** Opens a record for this person or refuses: 404 when it does not exist for them, 403 when the role may not. */
export async function openRecord(db: any, actor: WorkOrderActor, type: string, id: string, need: 'view' | 'edit' = 'view') {
  if (!isRecordType(type)) throw new WorkOrderApiError('Bilinmeyen kayıt türü', 400);
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new WorkOrderApiError('Kayıt bulunamadı', 404);
  const def = RECORDS[type];
  if (!def.canView(actor.role)) throw new WorkOrderApiError('Bu kaydı görme yetkiniz yok', 403);
  if (need === 'edit' && !def.canEdit(actor.role)) throw new WorkOrderApiError('Bu kaydı değiştirme yetkiniz yok', 403);
  if (def.allows && !(await def.allows(actor, 'view'))) throw new WorkOrderApiError('Kayıt bulunamadı', 404);
  if (need === 'edit' && def.allows && !(await def.allows(actor, 'edit'))) throw new WorkOrderApiError('Bu kaydı değiştirme yetkiniz yok', 403);
  const head = await def.head(db, actor, id);
  if (!head) throw new WorkOrderApiError('Kayıt bulunamadı', 404);
  return { def, head };
}
