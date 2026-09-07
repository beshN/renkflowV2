import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { sql } from '@/lib/db';

async function getTenantId(userId: string): Promise<string | null> {
  const rows = await sql`
    SELECT tenant_id FROM tenant_members WHERE user_id = ${userId} ORDER BY created_at ASC LIMIT 1
  `;
  return (rows[0] as any)?.tenant_id || null;
}

// ============================================
// GET — Müşteri listesi
// ============================================

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 });
    }

    const tenantId = await getTenantId(session.user.id);
    if (!tenantId) return NextResponse.json({ error: 'Tenant bulunamadı.' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') || '25', 10));
    const offset = (page - 1) * pageSize;

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
          ${search ? sql`AND (c.full_name ILIKE ${'%' + search + '%'} OR c.company_name ILIKE ${'%' + search + '%'} OR c.phone ILIKE ${'%' + search + '%'})` : sql``}
        GROUP BY c.id
        ORDER BY total_revenue DESC NULLS LAST, c.full_name ASC
        LIMIT ${pageSize} OFFSET ${offset}
      `,
      sql`
        SELECT COUNT(*) AS total
        FROM customers c
        WHERE c.tenant_id = ${tenantId}
          AND c.is_active = true
          ${search ? sql`AND (c.full_name ILIKE ${'%' + search + '%'} OR c.company_name ILIKE ${'%' + search + '%'})` : sql``}
      `,
    ]);

    return NextResponse.json({
      customers: rows,
      total: parseInt((countRows[0] as any)?.total || '0', 10),
      page,
      pageSize,
    });
  } catch (error: any) {
    console.error('[Customers GET]', error);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}

// ============================================
// POST — Yeni müşteri oluştur
// ============================================

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 });
    }

    const tenantId = await getTenantId(session.user.id);
    if (!tenantId) return NextResponse.json({ error: 'Tenant bulunamadı.' }, { status: 403 });

    const body = await req.json();
    const {
      fullName, companyName, email, phone, address,
      taxNumber, taxOffice, billingAddress, shippingAddress,
      creditLimit, paymentTerms, notes, contacts,
    } = body;

    if (!fullName?.trim()) {
      return NextResponse.json({ error: 'Müşteri adı zorunludur.' }, { status: 400 });
    }

    const rows = await sql`
      INSERT INTO customers (
        tenant_id, full_name, company_name, email, phone, address,
        tax_number, tax_office, billing_address, shipping_address,
        credit_limit, payment_terms, notes, contacts
      ) VALUES (
        ${tenantId}, ${fullName.trim()}, ${companyName || null}, ${email || null},
        ${phone || null}, ${address || null}, ${taxNumber || null}, ${taxOffice || null},
        ${billingAddress || null}, ${shippingAddress || null},
        ${creditLimit || null}, ${paymentTerms || 30}, ${notes || null},
        ${JSON.stringify(contacts || [])}::jsonb
      )
      RETURNING *
    `;

    // Log activity
    await sql`
      INSERT INTO activity_logs (tenant_id, entity_type, entity_id, action, actor_id, actor_name)
      SELECT ${tenantId}, 'customer', ${(rows[0] as any).id}, 'created', ${session.user.id}, u.name
      FROM users u WHERE u.id = ${session.user.id}
    `;

    return NextResponse.json({ customer: rows[0] }, { status: 201 });
  } catch (error: any) {
    console.error('[Customers POST]', error);
    return NextResponse.json({ error: 'Müşteri oluşturulamadı.' }, { status: 500 });
  }
}
