import 'server-only';

import { createHash } from 'node:crypto';
import { z } from 'zod';
import { sql, withTransaction } from '@/lib/db';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { postStockEntryInTransaction } from '@/lib/features/manufacturing/inventory.service';

const fail = (message: string, status = 400): never => {
  throw new WorkOrderApiError(message, status);
};

/** At most this many bars in one entry: one stock lot is written per physical bar. */
const MAX_BARS = 5000;

export const OpeningCountSchema = z
  .object({
    /** A count-list line waiting for its bars, or an item counted without a list. */
    lineId: z.string().uuid().optional(),
    itemId: z.string().uuid().optional(),
    warehouseId: z.string().uuid().optional(),
    color: z.string().trim().max(100).optional(),
    bars: z
      .array(z.object({ lengthMm: z.number().int().min(100).max(30000), count: z.number().int().positive().max(MAX_BARS) }))
      .min(1)
      .max(50),
    unitCost: z.number().nonnegative().finite().optional(),
    note: z.string().trim().max(500).optional(),
  })
  .refine((d) => Boolean(d.lineId) !== Boolean(d.itemId), 'Bir sayım satırı ya da bir malzeme seçin');

function manager(actor: WorkOrderActor) {
  if (!['owner', 'admin'].includes(actor.role)) fail('Açılış sayımını firma yöneticisi girer', 403);
}

/** Profile lines from imported count lists still waiting for their bars, and every metre item. */
export async function openingCountOverview(actor: WorkOrderActor) {
  if (!['owner', 'admin', 'office'].includes(actor.role)) fail('Açılış sayımına erişim yok', 403);
  const [lines, items, warehouses, done] = await Promise.all([
    sql`SELECT l.id, l.code, l.name, l.color, l.quantity, l.unit, l.section, l.item_id, i.name AS item_name, i.sku, d.title, d.count_date, d.warehouse_id
        FROM stock_count_lines l JOIN stock_count_documents d ON d.id = l.document_id AND d.tenant_id = l.tenant_id
        JOIN inventory_items i ON i.id = l.item_id AND i.tenant_id = l.tenant_id
        WHERE l.tenant_id = ${actor.tenantId} AND (l.status = 'needs_bars' OR (l.status = 'counted' AND EXISTS (
          SELECT 1 FROM stock_entries r WHERE r.tenant_id = l.tenant_id AND r.reversal_of_id = l.stock_entry_id)))
        ORDER BY d.created_at, l.ref`,
    sql`SELECT id, sku, name, profile_code, size_label, processed_states, standard_length_m FROM inventory_items WHERE tenant_id = ${actor.tenantId} AND active = true AND stock_uom = 'm' ORDER BY name`,
    sql`SELECT id, code, name FROM warehouses WHERE tenant_id = ${actor.tenantId} AND active = true AND warehouse_type IN ('RAW', 'REUSABLE_REMNANTS') ORDER BY warehouse_type, code`,
    sql`SELECT l.id, l.name, l.color, l.quantity, l.counted_meters, l.counted_bars, l.counted_at FROM stock_count_lines l
        WHERE l.tenant_id = ${actor.tenantId} AND l.status = 'counted' AND NOT EXISTS (
          SELECT 1 FROM stock_entries r WHERE r.tenant_id = l.tenant_id AND r.reversal_of_id = l.stock_entry_id)
        ORDER BY l.counted_at DESC LIMIT 50`,
  ]);
  return { lines, items, warehouses, counted: done, canCount: ['owner', 'admin'].includes(actor.role) };
}

/**
 * Enters the counted bars of one profile and colour as opening stock: one lot per bar with its
 * colour and length, posted as a receipt whose source is the opening count (reversible while the
 * lots are untouched). A count-list line is counted once, or again after its entry is reversed.
 */
export async function recordOpeningCount(actor: WorkOrderActor, raw: unknown, idempotencyKey: string) {
  manager(actor);
  const input = OpeningCountSchema.parse(raw);
  const totalBars = input.bars.reduce((sum, b) => sum + b.count, 0);
  if (totalBars > MAX_BARS) fail(`Bir girişte en fazla ${MAX_BARS} çubuk; kalanını ayrı girin`);
  const t = actor.tenantId;
  return withTransaction(async (tx: any) => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${t}, 0))`;
    // A retried request returns what it posted the first time.
    const key = 'opening:' + createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 32);
    const [replay] = await tx`SELECT * FROM stock_entries WHERE tenant_id = ${t} AND idempotency_key = ${key}`;
    if (replay) return { entryId: replay.id, replay: true };
    let line: any = null;
    let itemId = input.itemId;
    let warehouseId = input.warehouseId;
    let color = input.color;
    if (input.lineId) {
      [line] = await tx`
        SELECT l.*, d.warehouse_id, EXISTS (SELECT 1 FROM stock_entries r WHERE r.tenant_id = l.tenant_id AND r.reversal_of_id = l.stock_entry_id) AS reversed FROM stock_count_lines l JOIN stock_count_documents d ON d.id = l.document_id AND d.tenant_id = l.tenant_id
        WHERE l.tenant_id = ${t} AND l.id = ${input.lineId} FOR UPDATE OF l`;
      if (!line) fail('Sayım satırı bulunamadı', 404);
      // A count whose entry was reversed may be entered again.
      if (line.status !== 'needs_bars' && !(line.status === 'counted' && line.reversed)) fail('Bu satırın çubukları zaten girildi', 409);
      itemId = line.item_id;
      warehouseId = warehouseId ?? line.warehouse_id;
      color = line.color || color;
    }
    const [item] = await tx`SELECT * FROM inventory_items WHERE tenant_id = ${t} AND id = ${itemId} AND active = true`;
    if (!item) fail('Malzeme bulunamadı', 404);
    if (item.stock_uom !== 'm') fail('Çubuk sayımı yalnız metre ile tutulan profiller içindir');
    // Every bar carries a colour; an unpainted profile says so.
    if (!color) {
      if ((item.processed_states ?? []).includes('boyasiz')) color = 'Boyasız';
      else fail('Çubukların rengini girin');
    }
    const [warehouse] = await tx`SELECT id FROM warehouses WHERE tenant_id = ${t} AND id = ${warehouseId} AND active = true AND warehouse_type IN ('RAW', 'REUSABLE_REMNANTS')`;
    if (!warehouse) fail('Hammadde veya artık deposu seçin');
    const prefix = `ACILIS-${key.slice(8, 16).toUpperCase()}`;
    const lines: any[] = [];
    let n = 0;
    for (const bar of input.bars) {
      const meters = bar.lengthMm / 1000;
      for (let i = 0; i < bar.count; i++) {
        n++;
        const [lot] = await tx`
          INSERT INTO stock_lots (tenant_id, item_id, warehouse_id, lot_number, original_qty, remaining_qty, length_m, weight_kg, metadata)
          VALUES (${t}, ${item.id}, ${warehouse.id}, ${`${prefix}-${n}`}, ${meters}, ${meters}, ${meters},
            ${item.weight_per_meter_kg === null ? null : meters * Number(item.weight_per_meter_kg)},
            ${JSON.stringify({ color, source: 'opening_count', countLineId: line?.id ?? null, ...(input.unitCost === undefined ? {} : { unitCost: input.unitCost }), isRemnant: false })}::text::jsonb)
          RETURNING id`;
        lines.push({ itemId: item.id, warehouseId: warehouse.id, lotId: lot.id, quantityDelta: meters, uom: 'm', unitCost: input.unitCost, metadata: { color } });
      }
    }
    const countedMeters = input.bars.reduce((sum, b) => sum + (b.lengthMm * b.count) / 1000, 0);
    const entry = await postStockEntryInTransaction(tx, actor, {
      entryType: 'MATERIAL_RECEIPT',
      idempotencyKey: key,
      referenceType: 'opening_count',
      referenceId: line?.document_id,
      note: (input.note || `Açılış sayımı: ${item.name} · ${color}`).slice(0, 1000),
      lines,
    });
    if (line)
      await tx`UPDATE stock_count_lines SET status = 'counted', counted_meters = ${countedMeters}, counted_bars = ${totalBars}, counted_by = ${actor.userId}, counted_at = now(), stock_entry_id = ${entry.id}, updated_at = now() WHERE id = ${line.id}`;
    return {
      entryId: entry.id as string,
      bars: totalBars,
      countedMeters,
      listedMeters: line ? Number(line.quantity) : null,
      differenceMeters: line ? countedMeters - Number(line.quantity) : null,
    };
  });
}
