import 'server-only';

import { sql } from '@/lib/db';
import { canAccessRoute, canViewFinancialFields, type UserRole } from '@/lib/features/auth/permissions';
import { containsPattern, foldSql, foldText } from '@/lib/shared/text/fold';

const PER_SECTION = 8;

export type { SearchHit, WorkspaceSearchResult } from './types';
import { SEARCH_MIN_LENGTH, type SearchHit, type WorkspaceSearchResult } from './types';

type Actor = { tenantId: string; userId: string; role: UserRole };

/** Case-, spacing- and Turkish-letter-insensitive "contains" on a column (same fold as the JS side). */
const folded = (column: unknown) => foldSql(sql, column);

/**
 * One search over the screens the role can open. Each section follows its screen's access rule
 * (canAccessRoute), and orders follow the same assignment/commercial boundary as the order list.
 */
export async function searchWorkspace(actor: Actor, rawQuery: string): Promise<WorkspaceSearchResult> {
  const query = rawQuery.trim().slice(0, 120);
  const limited = !canViewFinancialFields(actor.role);
  const empty: WorkspaceSearchResult = { query, orders: null, customers: null, quotations: null, stock: null, ordersLimitedToAssigned: limited };
  const can = (route: string) => canAccessRoute(actor.role, route);
  if (foldText(query).length < SEARCH_MIN_LENGTH) {
    return { ...empty, orders: can('/orders') ? [] : null, customers: can('/crm') ? [] : null, quotations: can('/quotations') ? [] : null, stock: can('/inventory') ? [] : null };
  }
  const like = containsPattern(foldText(query));

  const [orders, customers, quotations, stock] = await Promise.all([
    can('/orders') ? searchOrders(actor, like, limited) : null,
    can('/crm') ? searchCustomers(actor, like) : null,
    can('/quotations') ? searchQuotations(actor, like) : null,
    can('/inventory') ? searchStock(actor, like) : null,
  ]);
  return { query, orders, customers, quotations, stock, ordersLimitedToAssigned: limited };
}

async function searchOrders(actor: Actor, like: string, limited: boolean): Promise<SearchHit[]> {
  const rows = limited
    ? await sql`
        SELECT o.id, o.order_number, o.product_name, '' AS customer_name, o.status
        FROM orders o
        WHERE o.tenant_id = ${actor.tenantId}
          AND EXISTS (
            SELECT 1 FROM work_orders w
            WHERE w.tenant_id = o.tenant_id AND w.order_id = o.id
              AND (w.assigned_to = ${actor.userId} OR EXISTS (
                SELECT 1 FROM production_operations p
                WHERE p.tenant_id = w.tenant_id AND p.work_order_id = w.id AND p.assigned_to = ${actor.userId}))
          )
          AND (${folded(sql`o.order_number`)} LIKE ${like} OR ${folded(sql`o.product_name`)} LIKE ${like})
        ORDER BY o.created_at DESC
        LIMIT ${PER_SECTION}`
    : await sql`
        SELECT o.id, o.order_number, o.product_name, o.customer_name, o.status
        FROM orders o
        WHERE o.tenant_id = ${actor.tenantId}
          AND (${folded(sql`o.order_number`)} LIKE ${like} OR ${folded(sql`o.product_name`)} LIKE ${like}
            OR ${folded(sql`o.customer_name`)} LIKE ${like} OR ${folded(sql`o.notes`)} LIKE ${like})
        ORDER BY o.created_at DESC
        LIMIT ${PER_SECTION}`;
  return rows.map((r: any) => ({ id: r.id, title: r.order_number, subtitle: r.product_name || '', meta: r.customer_name || '', status: r.status, href: '/orders/' + r.id }));
}

async function searchCustomers(actor: Actor, like: string): Promise<SearchHit[]> {
  const rows = await sql`
    SELECT id, full_name, company_name, phone, email
    FROM customers
    WHERE tenant_id = ${actor.tenantId} AND is_active = true
      AND (${folded(sql`full_name`)} LIKE ${like} OR ${folded(sql`company_name`)} LIKE ${like}
        OR ${folded(sql`phone`)} LIKE ${like} OR ${folded(sql`email`)} LIKE ${like})
    ORDER BY full_name ASC
    LIMIT ${PER_SECTION}`;
  return rows.map((r: any) => ({ id: r.id, title: r.full_name, subtitle: r.company_name || '', meta: [r.phone, r.email].filter(Boolean).join(' · '), href: '/crm/' + r.id }));
}

async function searchQuotations(actor: Actor, like: string): Promise<SearchHit[]> {
  const rows = await sql`
    SELECT id, quotation_number, customer_name, status
    FROM quotations
    WHERE tenant_id = ${actor.tenantId}
      AND (${folded(sql`quotation_number`)} LIKE ${like} OR ${folded(sql`customer_name`)} LIKE ${like})
    ORDER BY created_at DESC
    LIMIT ${PER_SECTION}`;
  return rows.map((r: any) => ({ id: r.id, title: r.quotation_number, subtitle: r.customer_name || '', meta: '', status: r.status, href: '/quotations/' + r.id }));
}

async function searchStock(actor: Actor, like: string): Promise<SearchHit[]> {
  const rows = await sql`
    SELECT i.id, i.name, i.sku, i.stock_uom, COALESCE(SUM(b.on_hand_qty), 0) AS on_hand
    FROM inventory_items i
    LEFT JOIN stock_balances b ON b.item_id = i.id AND b.tenant_id = i.tenant_id
    WHERE i.tenant_id = ${actor.tenantId} AND i.active = true
      AND (${folded(sql`i.name`)} LIKE ${like} OR ${folded(sql`i.sku`)} LIKE ${like})
    GROUP BY i.id
    ORDER BY i.name ASC
    LIMIT ${PER_SECTION}`;
  return rows.map((r: any) => ({
    id: r.id,
    title: r.name,
    subtitle: r.sku || '',
    meta: 'Eldeki: ' + Number(r.on_hand).toLocaleString('tr-TR', { maximumFractionDigits: 3 }) + ' ' + (r.stock_uom || ''),
    href: '/inventory/' + r.id,
  }));
}
