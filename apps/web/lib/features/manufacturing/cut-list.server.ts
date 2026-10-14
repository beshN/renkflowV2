import 'server-only';

import { z } from 'zod';
import { sql } from '@/lib/db';
import { tableExists } from '@/lib/db/schema-guard';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { FoyDocSchema } from '@/lib/features/foy/types';
import { firmCuttingParameters, cuttingEstimateNotice } from './cutting-defaults';
import { CuttingParametersSchema } from './cutting-engine';
import { foyCutRows, planCutList, type StockItem, type StockLot } from './cut-list';

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
    standardLengthMm: Number(r.raw?.standard_length_m) > 0 ? Number(r.raw.standard_length_m) * 1000 : null,
  }));
  const lotRows: Row[] = await sql`
    SELECT l.id, l.item_id, l.lot_number, l.remaining_qty, l.metadata, l.status, w.warehouse_type
    FROM stock_lots l JOIN warehouses w ON w.id = l.warehouse_id AND w.tenant_id = l.tenant_id
    WHERE l.tenant_id = ${actor.tenantId} AND l.remaining_qty > 0 AND l.status <> 'consumed'
      AND ((l.status = 'available' AND w.warehouse_type IN ('RAW', 'REUSABLE_REMNANTS')) OR w.warehouse_type = 'SCRAP' OR l.status = 'scrapped')
    ORDER BY l.id LIMIT 20000`;
  const lots: StockLot[] = lotRows.map((l) => ({
    id: String(l.id), itemId: String(l.item_id), lotNumber: String(l.lot_number),
    lengthMm: Number(l.remaining_qty) * 1000,
    color: String(l.metadata?.color ?? ''),
    kind: l.warehouse_type === 'SCRAP' || l.status === 'scrapped' ? 'scrap' : l.warehouse_type === 'REUSABLE_REMNANTS' || l.metadata?.isRemnant === true ? 'remnant' : 'new',
    unitCost: Number(l.metadata?.unitCost) || 0,
  }));
  // Steel is cut from unpainted stock whatever colour its lot is labelled with.
  const demirItems = new Set(items.filter((i) => rows.some((r) => r.kind === 'demir' && (input.choices[r.id] === i.id || i.profileCode === r.profile || i.name.toLowerCase().includes('demir')))).map((i) => i.id));
  const normalized = lots.map((l) => (demirItems.has(l.itemId) ? { ...l, color: '' } : l));

  const [prefs] = (await tableExists('manufacturing_preferences')) ? await sql`SELECT * FROM manufacturing_preferences WHERE tenant_id = ${actor.tenantId}` : [];
  const firm = firmCuttingParameters(prefs);
  const plan = planCutList({ rows, items, lots: normalized, parameters: CuttingParametersSchema.parse(firm.parameters), choices: input.choices });
  return { color, rows, problems, plan, parameters: firm.parameters, estimateNotice: cuttingEstimateNotice(firm.source), stock: { items: items.length, bars: lots.length } };
}
