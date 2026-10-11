import { redactedJson } from '@/lib/security/field-access.server';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { requireSameOrigin, requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { customerErrorResponse, parseCustomerUpdate, requireCustomerActor } from '@/lib/features/customers/api';

type CustomerRouteContext = {
  params: Promise<{ id: string }>;
};

const notFound = () => redactedJson({ error: 'Müşteri bulunamadı.' }, { status: 404 });
/** numeric columns come back as strings ('1000.00'); compare by value, not by type. */
function sameValue(stored: unknown, next: unknown) {
  if (typeof next === 'number') return stored !== null && stored !== undefined && Number(stored) === next;
  return (stored ?? null) === (next ?? null);
}
async function customerId(params: CustomerRouteContext['params']) {
  const { id } = await params;
  return z.string().uuid().safeParse(id).success ? id : null;
}

// ============================================
// GET — Müşteri detayı
// ============================================

export async function GET(_req: NextRequest, { params }: CustomerRouteContext) {
  try {
    const { tenantId } = await requireCustomerActor('customers.view');
    const id = await customerId(params);
    if (!id) return notFound();

    const rows = await sql`
      SELECT * FROM customers
      WHERE id = ${id} AND tenant_id = ${tenantId} AND is_active = true
    `;
    if (rows.length === 0) return notFound();
    return redactedJson({ customer: rows[0] });
  } catch (error) {
    return customerErrorResponse(error, 'Müşteri alınamadı.');
  }
}

// ============================================
// PUT — Müşteri güncelle
// ============================================

export async function PUT(req: NextRequest, { params }: CustomerRouteContext) {
  try {
    requireSameOriginJson(req, 200_000);
    const actor = await requireCustomerActor('customers.edit');
    const id = await customerId(params);
    if (!id) return notFound();
    const updates = parseCustomerUpdate(await req.json());

    const oldRows = await sql`SELECT * FROM customers WHERE id = ${id} AND tenant_id = ${actor.tenantId} AND is_active = true`;
    if (oldRows.length === 0) return notFound();
    const oldCustomer = oldRows[0] as Record<string, unknown>;

    const setFragment = updates
      .map(([column, value]) => (column === 'contacts' ? sql`${sql(column)} = ${JSON.stringify(value)}::jsonb` : sql`${sql(column)} = ${value as string | number | null}`))
      .reduce((acc, curr) => sql`${acc}, ${curr}`);

    const newRows = await sql`
      UPDATE customers
      SET ${setFragment}, updated_at = now()
      WHERE id = ${id} AND tenant_id = ${actor.tenantId} AND is_active = true
      RETURNING *
    `;
    if (newRows.length === 0) return notFound();

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const [column, value] of updates) {
      if (column === 'contacts') continue;
      if (!sameValue(oldCustomer[column], value)) changes[column] = { from: oldCustomer[column], to: value };
    }
    if (Object.keys(changes).length > 0) {
      await sql`
        INSERT INTO activity_logs (tenant_id, entity_type, entity_id, action, actor_id, actor_name, changes)
        SELECT ${actor.tenantId}, 'customer', ${id}, 'field_updated', ${actor.userId}, u.name, ${JSON.stringify(changes)}::jsonb
        FROM users u WHERE u.id = ${actor.userId}
      `;
    }

    return redactedJson({ customer: newRows[0] });
  } catch (error) {
    return customerErrorResponse(error, 'Müşteri güncellenemedi.');
  }
}

// ============================================
// DELETE — Müşteriyi pasif yap
// ============================================

export async function DELETE(req: NextRequest, { params }: CustomerRouteContext) {
  try {
    requireSameOrigin(req);
    const actor = await requireCustomerActor('customers.delete');
    const id = await customerId(params);
    if (!id) return notFound();

    const rows = await sql`
      UPDATE customers
      SET is_active = false, updated_at = now()
      WHERE id = ${id} AND tenant_id = ${actor.tenantId} AND is_active = true
      RETURNING id
    `;
    if (rows.length === 0) return notFound();

    await sql`
      INSERT INTO activity_logs (tenant_id, entity_type, entity_id, action, actor_id, actor_name)
      SELECT ${actor.tenantId}, 'customer', ${id}, 'deleted', ${actor.userId}, u.name
      FROM users u WHERE u.id = ${actor.userId}
    `;

    return redactedJson({ success: true });
  } catch (error) {
    return customerErrorResponse(error, 'Müşteri silinemedi.');
  }
}
