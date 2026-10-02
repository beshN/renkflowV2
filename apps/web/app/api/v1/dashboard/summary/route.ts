import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { sql } from '@/lib/db';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 });
    }

    const memberRows = await sql`
      SELECT tenant_id FROM tenant_members
      WHERE user_id = ${session.user.id}
      ORDER BY created_at ASC LIMIT 1
    `;
    const tenantId = (memberRows[0] as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: 'Tenant bulunamadı.' }, { status: 403 });

    const [orders, production, stock, overdue] = await Promise.all([
      sql`
        SELECT
          COUNT(*) FILTER (WHERE status NOT IN ('completed', 'cancelled', 'delivered')) AS active_count,
          COUNT(*) FILTER (WHERE status IN ('new', 'pending', 'pending_approval')) AS pending_count,
          COUNT(*) FILTER (WHERE status IN ('ready_for_shipment', 'ready')) AS ready_for_shipment,
          COUNT(*) FILTER (WHERE delivery_date::date = CURRENT_DATE) AS today_deliveries
        FROM orders
        WHERE tenant_id = ${tenantId}
      `,
      sql`
        SELECT
          COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
          COUNT(*) FILTER (WHERE status = 'open') AS open,
          COUNT(*) FILTER (WHERE status = 'blocked') AS blocked
        FROM work_orders
        WHERE tenant_id = ${tenantId}
      `,
      sql`
        SELECT COUNT(*) AS critical_count
        FROM inventory_items i
        LEFT JOIN stock_balances b ON b.item_id = i.id AND b.tenant_id = i.tenant_id
        WHERE i.tenant_id = ${tenantId}
          AND i.active = true
          AND COALESCE(b.on_hand_qty, 0) <= i.min_stock
          AND i.min_stock > 0
      `.catch((error: unknown) => {
        console.error('[Dashboard Stock Summary]', error);
        return null;
      }),
      sql`
        SELECT COUNT(*) AS overdue_count
        FROM orders
        WHERE tenant_id = ${tenantId}
          AND delivery_date < CURRENT_DATE
          AND status NOT IN ('completed', 'cancelled', 'delivered', 'shipped')
      `,
    ]);

    return NextResponse.json({
      summary: {
        orders: orders[0],
        production: production[0],
        criticalStock: stock?.[0] ?? null,
        overdue: overdue[0],
      },
    });
  } catch (error: any) {
    console.error('[Dashboard Summary]', error);
    return NextResponse.json({ error: 'Özet yüklenemedi.' }, { status: 500 });
  }
}
