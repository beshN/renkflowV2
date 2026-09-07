import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { sql } from '@/lib/db';

// Valid status transitions map
const VALID_TRANSITIONS: Record<string, string[]> = {
  new: ['pending_approval', 'approved', 'cancelled'],
  pending: ['pending_approval', 'approved', 'cancelled'],
  pending_approval: ['approved', 'cancelled', 'on_hold'],
  approved: ['preparing_materials', 'cancelled', 'on_hold'],
  preparing_materials: ['ready_for_production', 'on_hold'],
  ready_for_production: ['in_production', 'on_hold'],
  in_production: ['quality_check', 'ready_for_shipment', 'on_hold'],
  quality_check: ['ready_for_shipment', 'in_production'],
  ready_for_shipment: ['shipped', 'delivered'],
  shipped: ['completed', 'delivered'],
  delivered: ['completed'],
  on_hold: ['approved', 'preparing_materials', 'ready_for_production', 'in_production', 'cancelled'],
  completed: [],
  cancelled: [],
};

// Next.js 15: params is a Promise
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor.' }, { status: 401 });
    }

    const { id: orderId } = await params;
    const body = await req.json();
    const { newStatus, note } = body;

    if (!newStatus) {
      return NextResponse.json({ error: 'newStatus gereklidir.' }, { status: 400 });
    }

    const memberRows = await sql`
      SELECT tm.tenant_id, u.name AS user_name
      FROM tenant_members tm
      JOIN users u ON u.id = tm.user_id
      WHERE tm.user_id = ${session.user.id}
      ORDER BY tm.created_at ASC LIMIT 1
    `;
    const tenantId = (memberRows[0] as any)?.tenant_id;
    const actorName = (memberRows[0] as any)?.user_name || session.user.email;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant bulunamadı.' }, { status: 403 });
    }

    // Get current order status
    const orders = await sql`
      SELECT id, status, order_number, customer_name
      FROM orders
      WHERE tenant_id = ${tenantId} AND id = ${orderId}
    `;

    const order = orders[0] as any;
    if (!order) {
      return NextResponse.json({ error: 'Sipariş bulunamadı.' }, { status: 404 });
    }

    const currentStatus = order.status;
    const allowedNext = VALID_TRANSITIONS[currentStatus] || [];

    if (!allowedNext.includes(newStatus)) {
      return NextResponse.json(
        { error: `"${currentStatus}" durumundan "${newStatus}" durumuna geçiş yapılamaz. İzin verilen: ${allowedNext.join(', ') || 'yok'}` },
        { status: 400 }
      );
    }

    // Update order status
    await sql`
      UPDATE orders
      SET status = ${newStatus}, updated_at = now()
      WHERE tenant_id = ${tenantId} AND id = ${orderId}
    `;

    // Log activity
    await sql`
      INSERT INTO activity_logs (
        tenant_id, entity_type, entity_id, action,
        actor_id, actor_name, note, changes
      ) VALUES (
        ${tenantId}, 'order', ${orderId}, 'status_changed',
        ${session.user.id}, ${actorName},
        ${note || null},
        ${JSON.stringify({ durum: { from: currentStatus, to: newStatus } })}::jsonb
      )
    `;

    return NextResponse.json({ success: true, orderId, previousStatus: currentStatus, newStatus });
  } catch (error: any) {
    console.error('[OrderTransition POST]', error);
    return NextResponse.json({ error: error.message || 'Durum güncellenemedi.' }, { status: 500 });
  }
}
