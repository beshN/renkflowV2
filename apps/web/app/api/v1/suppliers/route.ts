import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireWorkOrderActor, requireWorkOrderPermission, WorkOrderApiError } from '@/lib/features/work-orders/security';

export async function GET(req: NextRequest) {
  try {
    const actor = await requireWorkOrderActor();
    
    const rows = await sql`
      SELECT 
        id,
        name,
        code,
        contact_name,
        phone,
        email,
        payment_terms,
        is_active,
        created_at
      FROM suppliers
      WHERE tenant_id = ${actor.tenantId}
      ORDER BY name ASC
    `;

    return NextResponse.json({
      success: true,
      data: rows
    });
  } catch (error) {
    if (error instanceof WorkOrderApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireWorkOrderActor();
    const body = await req.json();

    const rows = await sql`
      INSERT INTO suppliers (
        tenant_id, name, code, contact_name, phone, email, payment_terms, notes
      ) VALUES (
        ${actor.tenantId}, 
        ${body.name}, 
        ${body.code || null}, 
        ${body.contactName || null}, 
        ${body.phone || null}, 
        ${body.email || null}, 
        ${body.paymentTerms || 30}, 
        ${body.notes || null}
      )
      RETURNING *
    `;

    return NextResponse.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    if (error instanceof WorkOrderApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
