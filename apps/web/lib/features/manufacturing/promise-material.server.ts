import 'server-only';

import { getSql } from '@/lib/db';
import type { WorkOrderActor } from '@/lib/features/work-orders/security';
import { calculateRecipe, type RecipeDefinition, type RecipeParameters } from './recipe-engine';
import { physicalBars, type PhysicalStock } from './cut-stock';
import { optimizeCuts, type CutSource, type CuttingParameters } from './cutting-engine';
import { firmCuttingParameters, cuttingEstimateNotice } from './cutting-defaults';
import { colorKey } from '../colors/color-spec';

export type MaterialRequirement = { itemId: string; color: string; uom: string; quantity: number };
export type PromiseStockItem = { id: string; uom: string; leadTimeDays: number | null; pieceLengthMm?: number | null };
export type PromiseStockLot = PhysicalStock & { status: string; reserved: boolean };
export type MaterialReadinessLine = MaterialRequirement & {
  available: number;
  shortage: number;
  leadTimeDays: number | null;
};
type RecipeCuts = ReturnType<typeof calculateRecipe>['cuts'];
const EPSILON = 0.000001;

/** Pure snapshot calculation. Amounts are compared only within item + colour + unit.
 * Profile availability means cuttable metres, not a sum of unrelated physical lengths.
 */
export function calculateMaterialReadiness(input: {
  requirements: MaterialRequirement[];
  cuts: RecipeCuts;
  items: PromiseStockItem[];
  lots: PromiseStockLot[];
  cutting: CuttingParameters;
  /** Calendar date in the firm's timezone, supplied by the server caller. */
  today: string;
}) {
  const day = new Date(`${input.today}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.today) || !Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== input.today)
    throw new Error('Geçerli bir takvim tarihi gerekli');
  const grouped = new Map<string, MaterialRequirement>();
  for (const row of input.requirements) {
    if (!row.itemId || !row.uom || !Number.isFinite(row.quantity) || row.quantity < 0) throw new Error('Malzeme ihtiyacı geçersiz');
    if (!row.quantity) continue;
    const key = JSON.stringify([row.itemId, colorKey(row.color), row.uom]);
    const old = grouped.get(key);
    grouped.set(key, { ...row, quantity: (old?.quantity ?? 0) + row.quantity });
  }
  const fulfilled: MaterialReadinessLine[] = [], missing: MaterialReadinessLine[] = [], undefinedLeadTime: MaterialReadinessLine[] = [];
  const stockProblems: Array<{ lotId: string; reason: string }> = [];
  for (const row of grouped.values()) {
    const item = input.items.find(i => i.id === row.itemId);
    const cuts = input.cuts.filter(c => c.itemId === row.itemId);
    const lots = input.lots.filter(l => l.itemId === row.itemId && l.status === 'available' && !l.reserved && colorKey(l.color) === colorKey(row.color));
    let available = 0;
    if (cuts.length) {
      if (row.uom !== 'm' || Math.abs(cuts.reduce((sum, c) => sum + c.lengthMm * c.quantity / 1000, 0) - row.quantity) > EPSILON)
        throw new Error('Profil ihtiyacı kesim listesiyle uyuşmuyor');
      const sources: CutSource[] = [];
      for (const lot of lots) {
        const decoded = physicalBars(lot);
        if (decoded.problem) stockProblems.push({ lotId: lot.id, reason: decoded.problem });
        for (const bar of decoded.bars) sources.push({ ...bar, unitCost: 0, isRemnant: bar.kind === 'remnant' });
        if (sources.length > 20000) throw new Error('20.000 fiziksel profil sınırı aşıldı');
      }
      if (cuts.reduce((sum, c) => sum + c.quantity, 0) > 20000) throw new Error('20.000 kesim sınırı aşıldı');
      const plan = optimizeCuts(cuts.map(c => ({ ...c, color: row.color, workOrderId: 'material-readiness' })), sources, input.cutting);
      available = row.quantity - plan.unfulfilled.reduce((sum, c) => sum + c.lengthMm * c.quantity / 1000, 0);
    } else if (item?.uom === row.uom) {
      available = lots.filter(l => l.uom === row.uom && Number.isFinite(l.quantity) && l.quantity > 0).reduce((sum, l) => sum + l.quantity, 0);
    }
    const leadTimeDays = item?.leadTimeDays;
    const line: MaterialReadinessLine = { ...row, available: Math.max(0, available), shortage: Math.max(0, row.quantity - available),
      leadTimeDays: leadTimeDays != null && Number.isInteger(leadTimeDays) && leadTimeDays >= 0 && leadTimeDays <= 365 ? leadTimeDays : null };
    if (line.shortage <= EPSILON) fulfilled.push({ ...line, shortage: 0 });
    else if (line.leadTimeDays === null) undefinedLeadTime.push(line);
    else missing.push(line);
  }
  const longestLeadTimeDays = Math.max(0, ...missing.map(l => l.leadTimeDays!));
  day.setUTCDate(day.getUTCDate() + longestLeadTimeDays);
  return { readyDate: undefinedLeadTime.length ? null : day.toISOString().slice(0, 10), fulfilled, missing, undefinedLeadTime, stockProblems };
}

/** Advisory only: no reservation, procurement or writes. Call with an authenticated actor and
 * a human-approved recipe. Unallocated item/warehouse reservations block that pool conservatively:
 * their colour/physical profile is unknown, so none of those lots can safely be promised.
 */
export async function promiseMaterialReadyDate(
  actor: WorkOrderActor,
  input: { recipe: RecipeDefinition; parameters: RecipeParameters; color: string; today?: string },
): Promise<ReturnType<typeof calculateMaterialReadiness> & { cuttingEstimateNotice: string | null; requiresHumanApproval: true }> {
  if (!['owner', 'admin', 'office'].includes(actor.role)) throw new Error('Bu işlem için yetkiniz yok');
  const recipe = calculateRecipe(input.recipe, input.parameters);
  const itemIds = recipe.materials.map(m => m.itemId);
  const today = input.today ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  // A consistent read-only snapshot prevents preferences, lots and reservations being read at
  // different committed moments. The date remains an estimate, not a stock commitment.
  return getSql().begin('isolation level repeatable read read only', async (tx: any) => {
    const items = await tx`SELECT id, stock_uom, lead_time_days, piece_length_mm, processed_states
      FROM inventory_items WHERE tenant_id=${actor.tenantId} AND active=true AND id=ANY(${itemIds}::uuid[])`;
    const lots = await tx`SELECT l.*, i.stock_uom, i.piece_length_mm, i.processed_states, w.warehouse_type
      FROM stock_lots l
      JOIN inventory_items i ON i.id=l.item_id AND i.tenant_id=l.tenant_id AND i.active=true
      JOIN warehouses w ON w.id=l.warehouse_id AND w.tenant_id=l.tenant_id AND w.active=true
      WHERE l.tenant_id=${actor.tenantId} AND l.item_id=ANY(${itemIds}::uuid[])
        AND l.status='available' AND l.remaining_qty>0 AND w.warehouse_type IN ('RAW','REUSABLE_REMNANTS')
        AND NOT EXISTS (
          SELECT 1 FROM stock_reservation_lines rl
          JOIN stock_reservations rh ON rh.id=rl.reservation_id AND rh.tenant_id=rl.tenant_id
          WHERE rl.tenant_id=l.tenant_id AND rh.status='active'
            AND rl.reserved_qty>rl.consumed_qty+rl.released_qty
            AND (rl.lot_id=l.id OR (rl.lot_id IS NULL AND rl.item_id=l.item_id AND rl.warehouse_id=l.warehouse_id))
        ) ORDER BY l.id LIMIT 20001`;
    if (lots.length > 20000) throw new Error('20.000 stok lotu sınırı aşıldı');
    const [prefs] = await tx`SELECT * FROM manufacturing_preferences WHERE tenant_id=${actor.tenantId}`;
    const cutting = firmCuttingParameters(prefs);
    const result = calculateMaterialReadiness({
      today, requirements: recipe.materials.map(m => ({ ...m, color: input.color })), cuts: recipe.cuts,
      items: items.map((i: any) => ({ id: i.id, uom: i.stock_uom, leadTimeDays: i.lead_time_days, pieceLengthMm: i.piece_length_mm })),
      lots: lots.map((l: any) => ({ id: l.id, itemId: l.item_id, lotNumber: l.lot_number, quantity: Number(l.remaining_qty),
        uom: l.stock_uom, lengthM: l.length_m, pieceLengthMm: l.piece_length_mm,
        color: l.metadata?.color || (l.processed_states?.includes('boyasiz') ? 'Boyasız' : ''),
        kind: l.metadata?.isRemnant || l.warehouse_type === 'REUSABLE_REMNANTS' ? 'remnant' : 'new', status: l.status, reserved: false })),
      cutting: cutting.parameters,
    });
    return { ...result, cuttingEstimateNotice: cuttingEstimateNotice(cutting.source), requiresHumanApproval: true as const };
  });
}
