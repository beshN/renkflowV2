import { readJsonBody } from '@/lib/security/request-body.server';
import { redactedJson } from '@/lib/security/field-access.server';
import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { columnExists } from '@/lib/db/schema-guard';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { CreateCustomerSchema, customerErrorResponse, requireCustomerActor } from '@/lib/features/customers/api';

// ============================================
// GET — Müşteri listesi
// ============================================

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await requireCustomerActor('customers.view');

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get('search') || '').trim().slice(0, 120);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '25', 10) || 25));
    const offset = (page - 1) * pageSize;
    const like = '%' + search.replace(/[\\%_]/g, (c) => '\\' + c) + '%';

    // Typeahead (new order form): names and contacts only, no revenue aggregation.
    if (searchParams.get('suggest') === '1') {
      if (search.length < 2) return redactedJson({ customers: [] });
      const customers = await sql`
        SELECT id, full_name, company_name, email, phone
        FROM customers
        WHERE tenant_id = ${tenantId} AND is_active = true
          AND (full_name ILIKE ${like} OR company_name ILIKE ${like} OR phone ILIKE ${like} OR email ILIKE ${like})
        ORDER BY full_name ASC
        LIMIT 6
      `;
      return redactedJson({ customers });
    }

    const [rows, countRows] = await Promise.all([
      sql`
        SELECT
          c.id,
          c.full_name,
          c.company_name,
          c.phone,
          c.email,
          c.is_active,
          c.created_at,
          COUNT(o.id) AS order_count,
          COALESCE(SUM(o.total_amount), 0) AS total_revenue,
          MAX(o.created_at) AS last_order_at
        FROM customers c
        LEFT JOIN orders o ON o.customer_id = c.id AND o.tenant_id = c.tenant_id
        WHERE c.tenant_id = ${tenantId}
          AND c.is_active = true
          ${search ? sql`AND (c.full_name ILIKE ${like} OR c.company_name ILIKE ${like} OR c.phone ILIKE ${like})` : sql``}
        GROUP BY c.id
        ORDER BY total_revenue DESC NULLS LAST, c.full_name ASC
        LIMIT ${pageSize} OFFSET ${offset}
      `,
      sql`
        SELECT COUNT(*) AS total
        FROM customers c
        WHERE c.tenant_id = ${tenantId}
          AND c.is_active = true
          ${search ? sql`AND (c.full_name ILIKE ${like} OR c.company_name ILIKE ${like} OR c.phone ILIKE ${like})` : sql``}
      `,
    ]);

    return redactedJson({
      customers: rows,
      total: parseInt((countRows[0] as { total?: string })?.total || '0', 10),
      page,
      pageSize,
    });
  } catch (error) {
    return customerErrorResponse(error, 'Müşteriler alınamadı.');
  }
}

// ============================================
// POST — Yeni müşteri oluştur
// ============================================

export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 200_000);
    const actor = await requireCustomerActor('customers.create');
    const input = CreateCustomerSchema.parse(await readJsonBody(req, 200_000));

    const rows = await sql`
      INSERT INTO customers (
        tenant_id, full_name, company_name, email, phone, address,
        tax_number, tax_office, billing_address, shipping_address,
        credit_limit, payment_terms, notes, contacts
      ) VALUES (
        ${actor.tenantId}, ${input.fullName}, ${input.companyName}, ${input.email},
        ${input.phone}, ${input.address}, ${input.taxNumber}, ${input.taxOffice},
        ${input.billingAddress}, ${input.shippingAddress},
        ${input.creditLimit ?? null}, ${input.paymentTerms ?? 30}, ${input.notes},
        ${JSON.stringify(input.contacts || [])}::jsonb
      )
      RETURNING *
    `;
    // City and district exist from migration 054 on.
    if ((input.city || input.district) && (await columnExists('customers', 'city'))) {
      const [updated] = await sql`UPDATE customers SET city = ${input.city ?? null}, district = ${input.district ?? null} WHERE id = ${(rows[0] as { id: string }).id} RETURNING *`;
      rows[0] = updated;
    }

    await sql`
      INSERT INTO activity_logs (tenant_id, entity_type, entity_id, action, actor_id, actor_name)
      SELECT ${actor.tenantId}, 'customer', ${(rows[0] as { id: string }).id}, 'created', ${actor.userId}, u.name
      FROM users u WHERE u.id = ${actor.userId}
    `;

    return redactedJson({ customer: rows[0] }, { status: 201 });
  } catch (error) {
    return customerErrorResponse(error, 'Müşteri oluşturulamadı.');
  }
}
