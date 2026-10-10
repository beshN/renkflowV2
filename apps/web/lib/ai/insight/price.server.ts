import 'server-only';

import { z } from 'zod';
import { sql } from '@/lib/db';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { resolveMemberAccess } from '@/lib/security/member-access.server';
import { can } from '@/lib/security/access-matrix';
import { getAiSettings, featureOn } from '@/lib/ai/gate.server';
import { suggestPrice, type PricePoint } from './price';

type Row = Record<string, any>;
// A quote line belongs to a family by its configuration, or by its name for lines typed by hand.
const NAME: Record<string, string> = { pergola: '(pergola|bioklimatik)', awning: 'tente', guillotine: 'giyotin', zip: 'zip', rolling_roof: 'rolling', winter_garden: 'kış bahçesi' };

/**
 * The firm's accepted quotes of a family in the last year (TRY), with the material cost per m² of
 * the configured ones: their bill of materials × the latest purchase price of each item in the same
 * unit. A line with any material unpriced has no cost (never a partial one).
 */
export async function priceHistory(tenantId: string, family: string): Promise<PricePoint[]> {
  const rows = await sql`
    SELECT q.id, q.quotation_number, q.created_at, qi.width_mm, COALESCE(qi.projection_mm, qi.height_mm) AS projection_mm, qi.unit_price, qi.product_configuration
    FROM quotation_items qi JOIN quotations q ON q.id = qi.quotation_id AND q.tenant_id = qi.tenant_id
    WHERE qi.tenant_id = ${tenantId} AND q.status IN ('accepted', 'converted') AND COALESCE(q.currency, 'TRY') = 'TRY'
      AND q.created_at > now() - interval '365 days' AND qi.width_mm > 0 AND COALESCE(qi.projection_mm, qi.height_mm) > 0 AND qi.unit_price > 0
      AND (qi.product_configuration->>'family' = ${family} OR (qi.product_configuration IS NULL AND qi.product_name ~* ${NAME[family] ?? '^$'}))
    ORDER BY q.created_at DESC LIMIT 200`;
  const ids = [...new Set(rows.flatMap((r: Row) => (r.product_configuration?.bom?.materials ?? []).map((m: Row) => String(m.itemId))))];
  const prices = new Map<string, { price: number; uom: string }>();
  if (ids.length) {
    for (const p of await sql`SELECT DISTINCT ON (l.item_id) l.item_id, l.unit_price, l.uom FROM purchase_order_lines l JOIN purchase_orders po ON po.id = l.purchase_order_id
      WHERE l.tenant_id = ${tenantId} AND l.item_id = ANY(${ids}::uuid[]) AND l.unit_price > 0 AND po.status <> 'cancelled' ORDER BY l.item_id, po.created_at DESC`)
      prices.set(String(p.item_id), { price: Number(p.unit_price), uom: p.uom });
  }
  return rows.map((r: Row) => {
    const area = (Number(r.width_mm) / 1000) * (Number(r.projection_mm) / 1000);
    const mats: Row[] = r.product_configuration?.bom?.materials ?? [];
    let cost: number | null = mats.length ? 0 : null;
    for (const m of mats) {
      const p = prices.get(String(m.itemId));
      if (!p || p.uom !== m.uom) { cost = null; break; }
      cost! += p.price * Number(m.quantity);
    }
    return { quotationId: String(r.id), number: r.quotation_number, date: new Date(r.created_at).toISOString().slice(0, 10), areaM2: area, unitPrice: Number(r.unit_price), costPerM2: cost === null ? null : cost / area };
  });
}

/** A price hint for one product line; only for people who may see prices (and costs for the floor). */
export async function priceSuggestionFor(actor: WorkOrderActor, raw: unknown) {
  const d = z.object({ family: z.string().max(40), widthMm: z.coerce.number().positive().max(100000), projectionMm: z.coerce.number().positive().max(100000), price: z.coerce.number().positive().optional(), matrixUnitPrice: z.coerce.number().positive().optional() }).parse(raw);
  const access = await resolveMemberAccess(actor.userId, actor.tenantId);
  if (!access || access.deactivated || actor.role === 'worker' || !can(access, 'quotations', 'view') || access.hidden.includes('price')) throw new WorkOrderApiError('Fiyat önerisini görme yetkiniz yok', 403);
  const ai = await getAiSettings(actor.tenantId);
  if (ai.mode === 'off' || !featureOn(ai, 'price_hint')) return { available: false as const };
  const s = suggestPrice({ areaM2: (d.widthMm / 1000) * (d.projectionMm / 1000), history: await priceHistory(actor.tenantId, d.family), matrixUnitPrice: d.matrixUnitPrice ?? null, floorPercent: ai.profitFloorPercent, enteredPrice: d.price ?? null });
  // A role that hides costs sees the floor warning but not the cost itself.
  return { available: true as const, ...s, cost: access.hidden.includes('cost') ? null : s.cost, floorPercent: ai.profitFloorPercent };
}
