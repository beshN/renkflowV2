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
// GET — Müşteri detayı
// ============================================

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 });
    }

    const tenantId = await getTenantId(session.user.id);
    if (!tenantId) return NextResponse.json({ error: 'Tenant bulunamadı.' }, { status: 403 });

    const customerId = params.id;

    const rows = await sql`
      SELECT * FROM customers
      WHERE id = ${customerId} AND tenant_id = ${tenantId} AND is_active = true
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Müşteri bulunamadı.' }, { status: 404 });
    }

    return NextResponse.json({ customer: rows[0] });
  } catch (error: any) {
    console.error('[Customer GET]', error);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}

// ============================================
// PUT — Müşteri güncelle
// ============================================

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 });
    }

    const tenantId = await getTenantId(session.user.id);
    if (!tenantId) return NextResponse.json({ error: 'Tenant bulunamadı.' }, { status: 403 });

    const customerId = params.id;
    const body = await req.json();
    
    // Yalnızca güncellenen alanları al
    const allowedFields = [
      'full_name', 'company_name', 'email', 'phone', 'address',
      'tax_number', 'tax_office', 'billing_address', 'shipping_address',
      'credit_limit', 'payment_terms', 'notes', 'contacts'
    ];

    const updates: Record<string, any> = {};
    for (const field of allowedFields) {
      // Body camelCase geleceği için eşleştirme:
      const camelCaseField = field.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      if (body[camelCaseField] !== undefined) {
        updates[field] = body[camelCaseField];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Güncellenecek alan bulunamadı.' }, { status: 400 });
    }

    // Mevcut kaydı al (log için)
    const oldRows = await sql`SELECT * FROM customers WHERE id = ${customerId} AND tenant_id = ${tenantId}`;
    if (oldRows.length === 0) {
      return NextResponse.json({ error: 'Müşteri bulunamadı.' }, { status: 404 });
    }
    const oldCustomer = oldRows[0] as any;

    // Dinamik UPDATE sorgusu
    const setQuery = Object.entries(updates).map(([k, v]) => {
        if (k === 'contacts') return sql`${sql(k)} = ${JSON.stringify(v)}::jsonb`;
        return sql`${sql(k)} = ${v}`;
    });
    
    const setFragment = setQuery.reduce((acc, curr, i) => {
        if (i === 0) return curr;
        return sql`${acc}, ${curr}`;
    });

    const newRows = await sql`
      UPDATE customers 
      SET ${setFragment}, updated_at = now()
      WHERE id = ${customerId} AND tenant_id = ${tenantId}
      RETURNING *
    `;

    const newCustomer = newRows[0] as any;

    // Değişiklikleri hesapla
    const changes: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (key === 'contacts') continue; // JSON karşılaştırması karışık olduğu için atlıyoruz
      if (oldCustomer[key] !== value) {
        changes[key] = { from: oldCustomer[key], to: value };
      }
    }

    // Log activity
    if (Object.keys(changes).length > 0) {
      await sql`
        INSERT INTO activity_logs (tenant_id, entity_type, entity_id, action, actor_id, actor_name, changes)
        SELECT ${tenantId}, 'customer', ${customerId}, 'field_updated', ${session.user.id}, u.name, ${JSON.stringify(changes)}::jsonb
        FROM users u WHERE u.id = ${session.user.id}
      `;
    }

    return NextResponse.json({ customer: newCustomer });
  } catch (error: any) {
    console.error('[Customer PUT]', error);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}

// ============================================
// DELETE — Müşteriyi inaktif yap
// ============================================

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 });
    }

    const tenantId = await getTenantId(session.user.id);
    if (!tenantId) return NextResponse.json({ error: 'Tenant bulunamadı.' }, { status: 403 });

    const customerId = params.id;

    await sql`
      UPDATE customers 
      SET is_active = false, updated_at = now()
      WHERE id = ${customerId} AND tenant_id = ${tenantId}
    `;

    // Log activity
    await sql`
      INSERT INTO activity_logs (tenant_id, entity_type, entity_id, action, actor_id, actor_name)
      SELECT ${tenantId}, 'customer', ${customerId}, 'deleted', ${session.user.id}, u.name
      FROM users u WHERE u.id = ${session.user.id}
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Customer DELETE]', error);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}
