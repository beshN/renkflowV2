import { redactedJson } from '@/lib/security/field-access.server';
import { sql } from '@/lib/db';
import { AuthenticationError, getServerUserContext } from '@/lib/features/auth/serverAuth';
import { canonicalColor, colorKey } from '@/lib/features/colors/color-spec';

export async function GET() {
  try {
    const { tenantId } = await getServerUserContext();

    const [orders, production, stock, overdue, cutting, trend, week, paint] = await Promise.all([
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
      // Jobs waiting for cutting: the same pool the cutting plan is computed from.
      sql`
        SELECT COUNT(*) AS waiting
        FROM work_orders w
        WHERE w.tenant_id = ${tenantId} AND w.recipe_id IS NOT NULL AND w.status IN ('open', 'in_progress') AND w.cut_plan_id IS NULL
          AND jsonb_typeof(w.bom_snapshot->'cuts') = 'array' AND jsonb_array_length(w.bom_snapshot->'cuts') > 0
      `.catch(() => [{ waiting: '0' }]),
      // Last 14 days, oldest first: orders opened and orders finished per day (the KPI sparklines).
      sql`
        SELECT d::date AS day,
          (SELECT COUNT(*) FROM orders o WHERE o.tenant_id = ${tenantId} AND o.created_at::date = d::date)::int AS created,
          (SELECT COUNT(*) FROM orders o WHERE o.tenant_id = ${tenantId} AND o.status IN ('completed', 'delivered') AND o.updated_at::date = d::date)::int AS completed
        FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE, interval '1 day') AS d
        ORDER BY d
      `,
      // This week (Monday on): what came in, what went out, and how much of it on time.
      sql`
        SELECT
          COUNT(*) FILTER (WHERE created_at >= date_trunc('week', now()))::int AS created,
          COUNT(*) FILTER (WHERE status IN ('completed', 'delivered') AND updated_at >= date_trunc('week', now()))::int AS completed,
          COUNT(*) FILTER (WHERE status IN ('completed', 'delivered') AND updated_at >= date_trunc('week', now()) AND (delivery_date IS NULL OR updated_at::date <= delivery_date::date))::int AS on_time
        FROM orders WHERE tenant_id = ${tenantId}
      `,
      // Open jobs per colour: the paint queue (jobs of one colour go to the paint shop together).
      sql`
        SELECT configuration->>'bodyName' AS color, COUNT(*)::int AS jobs, COALESCE(SUM(planned_qty), 0)::int AS pieces
        FROM work_orders
        WHERE tenant_id = ${tenantId} AND recipe_id IS NOT NULL AND status NOT IN ('done', 'cancelled')
          AND coalesce(configuration->>'bodyName', '') <> ''
        GROUP BY 1
      `.catch(() => []),
    ]);
    const paintQueue = new Map<string, { color: string; jobs: number; pieces: number }>();
    for (const r of paint as any[]) {
      const key = colorKey(r.color);
      const entry = paintQueue.get(key) ?? { color: canonicalColor(r.color), jobs: 0, pieces: 0 };
      entry.jobs += r.jobs;
      entry.pieces += r.pieces;
      paintQueue.set(key, entry);
    }

    return redactedJson({
      summary: {
        orders: orders[0],
        production: production[0],
        criticalStock: stock?.[0] ?? null,
        overdue: overdue[0],
        cutting: cutting[0],
        trend: trend.map((r: any) => ({ day: String(r.day instanceof Date ? r.day.toISOString().slice(0, 10) : r.day).slice(0, 10), created: r.created, completed: r.completed })),
        week: week[0],
        paint: [...paintQueue.values()].sort((a, b) => b.jobs - a.jobs).slice(0, 12),
      },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) return redactedJson({ error: 'Oturum gerekli.' }, { status: 401 });
    console.error('[Dashboard Summary]', error);
    return redactedJson({ error: 'Özet yüklenemedi.' }, { status: 500 });
  }
}
