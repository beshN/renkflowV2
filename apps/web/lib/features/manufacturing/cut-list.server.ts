import 'server-only';

import { z } from 'zod';
import { sql } from '@/lib/db';
import { tableExists } from '@/lib/db/schema-guard';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { FoyDocSchema } from '@/lib/features/foy/types';
import { firmCuttingParameters, cuttingEstimateNotice } from './cutting-defaults';
import { CuttingParametersSchema } from './cutting-engine';
import { foyCutRows, matchItems, planCutList, stockProfileIdentity, type StockItem, type StockLot } from './cut-list';
import { physicalBars } from './cut-stock';

type Row = Record<string, any>;

export const CutListInput = z.object({
  doc: FoyDocSchema,
  /** Row id → the stock profile the person picked when the match was not unique. */
  choices: z.record(z.string(), z.string().uuid()).default({}),
}).strict();

/**
 * Plans the cuts of one order sheet against the firm's live stock: whole bars, leftovers (artık) and
 * bars on the scrap pile (hurda) that are long enough. Nothing is reserved or written: it is the
 * answer to "what do I cut from where"; the workshop decides.
 */
export async function planCutListFromDoc(actor: WorkOrderActor, raw: unknown) {
  if (!['owner', 'admin', 'office'].includes(actor.role)) throw new WorkOrderApiError('Bu işlem için yetkiniz yok', 403);
  const input = CutListInput.parse(raw);
  if (!(await tableExists('stock_lots')) || !(await tableExists('warehouses'))) throw new WorkOrderApiError('Stok için veritabanı güncellemesi bekleniyor', 409);

  const { rows, problems, color } = foyCutRows(input.doc);
  const itemRows: Row[] = await sql`SELECT i.id, i.name, i.sku, to_jsonb(i) AS raw FROM inventory_items i WHERE i.tenant_id = ${actor.tenantId} AND i.active = true ORDER BY i.name LIMIT 2000`;
  const items: StockItem[] = itemRows.map((r) => ({
    id: String(r.id), name: String(r.name ?? ''), sku: String(r.sku ?? ''),
    profileCode: r.raw?.profile_code ? String(r.raw.profile_code) : null,
    sizeLabel: r.raw?.size_label ?? null,
    processedStates: r.raw?.processed_states ?? [],
    standardLengthMm: Number(r.raw?.standard_length_m) > 0 ? Number(r.raw.standard_length_m) * 1000 : null,
  }));
  const lotRows: Row[] = await sql`
    SELECT l.id, l.item_id, l.lot_number, l.remaining_qty, l.length_m, l.metadata, l.status, w.warehouse_type
    FROM stock_lots l JOIN warehouses w ON w.id = l.warehouse_id AND w.tenant_id = l.tenant_id
    WHERE l.tenant_id = ${actor.tenantId} AND l.remaining_qty > 0 AND w.active = true AND l.status IN ('available', 'scrapped')
      AND ((l.status = 'available' AND w.warehouse_type IN ('RAW', 'REUSABLE_REMNANTS')) OR w.warehouse_type = 'SCRAP' OR l.status = 'scrapped')
      AND NOT EXISTS (
        SELECT 1 FROM stock_reservation_lines rl JOIN stock_reservations rh ON rh.id = rl.reservation_id AND rh.tenant_id = rl.tenant_id
        WHERE rl.tenant_id = l.tenant_id AND rl.lot_id = l.id AND rh.status = 'active'
          AND rl.reserved_qty > rl.consumed_qty + rl.released_qty
      )
    ORDER BY l.id LIMIT 20000`;
  const itemById = new Map(itemRows.map((r) => [String(r.id), r]));
  const profileById = new Map(items.map((i) => [i.id, i]));
  const relevant = new Set(rows.flatMap((r) => {
    const chosen = items.find((i) => i.id === input.choices[r.id]);
    return (chosen ? [chosen] : matchItems(r, items).candidates).map(stockProfileIdentity);
  }));
  const stockProblems: Array<{ lotNumber: string; itemName: string; reason: string }> = [];
  let physicalCount = 0;
  const lots: StockLot[] = lotRows.flatMap((l) => {
    const item = itemById.get(String(l.item_id));
    const profile = profileById.get(String(l.item_id));
    if (!item || !profile || !relevant.has(stockProfileIdentity(profile))) return [];
    if (physicalCount >= 20000) {
      stockProblems.push({ lotNumber: String(l.lot_number), itemName: profile.name, reason: 'Planın 20.000 fiziksel çubuk sınırı aşıldı; stok havuzunu daraltın' });
      return [];
    }
    const decoded = physicalBars({
      id: String(l.id), itemId: String(l.item_id), lotNumber: String(l.lot_number),
      quantity: Number(l.remaining_qty), uom: String(item.raw?.stock_uom ?? item.raw?.unit ?? ''),
      lengthM: l.length_m, pieceLengthMm: item.raw?.piece_length_mm,
      color: String(l.metadata?.color || (profile.processedStates?.includes('boyasiz') ? 'Boyasız' : '')),
      kind: l.warehouse_type === 'SCRAP' || l.status === 'scrapped' ? 'scrap' : l.warehouse_type === 'REUSABLE_REMNANTS' || l.metadata?.isRemnant === true ? 'remnant' : 'new',
      unitCost: Number(l.metadata?.unitCost) || 0,
    });
    if (decoded.problem) stockProblems.push({ lotNumber: String(l.lot_number), itemName: profile.name, reason: decoded.problem });
    const bars = decoded.bars.slice(0, Math.max(0, 20000 - physicalCount));
    if (bars.length < decoded.bars.length) stockProblems.push({ lotNumber: String(l.lot_number), itemName: profile.name, reason: 'Planın 20.000 fiziksel çubuk sınırı aşıldı; stok havuzunu daraltın' });
    physicalCount += bars.length;
    return bars;
  });

  const [prefs] = (await tableExists('manufacturing_preferences')) ? await sql`SELECT * FROM manufacturing_preferences WHERE tenant_id = ${actor.tenantId}` : [];
  const firm = firmCuttingParameters(prefs);
  const plan = planCutList({ rows, items, lots, parameters: CuttingParametersSchema.parse(firm.parameters), choices: input.choices,
    purchaseLengthsMm: Array.isArray(prefs?.bar_length_options_mm) ? prefs.bar_length_options_mm.map(Number) : [],
  });
  return { color, rows, problems, stockProblems, plan, parameters: firm.parameters, estimateNotice: cuttingEstimateNotice(firm.source), stock: { items: items.length, bars: lots.length } };
}
