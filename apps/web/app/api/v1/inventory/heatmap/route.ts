import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireWorkOrderActor, requireWorkOrderPermission, WorkOrderApiError } from '@/lib/features/work-orders/security';
import { canonicalColor, colorKey } from '@/lib/features/colors/color-spec';

/**
 * Bars on the shelf by colour and length, per profile: the stock heat map. Spellings of one colour
 * ("7016 MAT", "RAL 7016 Mat") are one row. Counts only; no costs.
 */
export async function GET() {
  try {
    const actor = await requireWorkOrderActor();
    requireWorkOrderPermission(actor, 'view');
    const rows = await sql`
      SELECT l.item_id, i.name AS item_name, coalesce(nullif(trim(l.metadata->>'color'), ''), 'Renk yok') AS color,
        round(l.remaining_qty * 1000)::int AS length_mm, count(*)::int AS bars
      FROM stock_lots l JOIN inventory_items i ON i.id = l.item_id AND i.tenant_id = l.tenant_id
      WHERE l.tenant_id = ${actor.tenantId} AND i.stock_uom = 'm' AND l.status IN ('available', 'reserved') AND l.remaining_qty > 0
      GROUP BY 1, 2, 3, 4
      LIMIT 5000`;
    const cells = new Map<string, { itemId: string; color: string; lengthMm: number; bars: number }>();
    const items = new Map<string, string>();
    for (const r of rows as any[]) {
      items.set(r.item_id, r.item_name);
      const color = r.color === 'Renk yok' ? r.color : canonicalColor(r.color);
      const key = `${r.item_id}|${r.color === 'Renk yok' ? 'none' : colorKey(r.color)}|${r.length_mm}`;
      const cell = cells.get(key) ?? { itemId: r.item_id, color, lengthMm: r.length_mm, bars: 0 };
      cell.bars += r.bars;
      cells.set(key, cell);
    }
    return NextResponse.json({ items: [...items].map(([id, name]) => ({ id, name })), cells: [...cells.values()] });
  } catch (error) {
    if (error instanceof WorkOrderApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[inventory heatmap]', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Isı haritası alınamadı' }, { status: 500 });
  }
}
