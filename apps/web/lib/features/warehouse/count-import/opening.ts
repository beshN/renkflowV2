import 'server-only';

import { createHash } from 'node:crypto';
import { z } from 'zod';
import { sql, withTransaction } from '@/lib/db';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { postStockEntryInTransaction } from '@/lib/features/manufacturing/inventory.service';

const fail = (message: string, status = 400): never => {
  throw new WorkOrderApiError(message, status);
};

/** At most this many bars in one entry: one stock lot (and one entry line) is written per physical bar. */
export const MAX_OPENING_BARS = 1000;

export const OpeningCountSchema = z
  .object({
    /** A count-list line waiting for its bars, or an item counted without a list. */
    lineId: z.string().uuid().optional(),
    itemId: z.string().uuid().optional(),
    warehouseId: z.string().uuid().optional(),
    color: z.string().trim().max(100).optional(),
    bars: z
      .array(
        z.object({
          lengthMm: z.number({ message: 'Çubuk boyu sayı olmalı' }).int('Çubuk boyu tam sayı (mm) olmalı').min(100, 'Çubuk boyu en az 100 mm').max(30000, 'Çubuk boyu en fazla 30000 mm'),
          count: z.number({ message: 'Çubuk adedi sayı olmalı' }).int('Çubuk adedi tam sayı olmalı').positive('Çubuk adedi en az 1').max(MAX_OPENING_BARS, `Bir girişte en fazla ${MAX_OPENING_BARS} çubuk`),
        }),
      )
      .min(1, 'En az bir boy girin')
      .max(50, 'En fazla 50 farklı boy'),
    unitCost: z.number().nonnegative().finite().optional(),
    note: z.string().trim().max(500).optional(),
  })
  .refine((d) => Boolean(d.lineId) !== Boolean(d.itemId), 'Bir sayım satırı ya da bir malzeme seçin');

export type OpeningCountResult = { entryId: string; bars: number; countedMeters: number; listedMeters: number | null; differenceMeters: number | null; replay?: boolean };

/** Profile lines from imported count lists still waiting for their bars, and every metre item. */
export async function openingCountOverview(actor: WorkOrderActor) {
  if (!['owner', 'admin', 'office'].includes(actor.role)) fail('Açılış sayımına erişim yok', 403);
  const [lines, items, warehouses, counted] = await Promise.all([
    sql`SELECT l.id, l.code, l.name, l.color, l.quantity, l.item_id, i.name AS item_name, i.sku, i.processed_states, d.title, d.warehouse_id
        FROM stock_count_lines l JOIN stock_count_documents d ON d.id = l.document_id AND d.tenant_id = l.tenant_id
        JOIN inventory_items i ON i.id = l.item_id AND i.tenant_id = l.tenant_id AND i.active = true
        WHERE l.tenant_id = ${actor.tenantId} AND l.status = 'needs_bars' ORDER BY d.created_at, l.ref`,
    sql`SELECT id, sku, name, processed_states FROM inventory_items WHERE tenant_id = ${actor.tenantId} AND active = true AND stock_uom = 'm' ORDER BY name`,
    sql`SELECT id, code, name FROM warehouses WHERE tenant_id = ${actor.tenantId} AND active = true AND warehouse_type IN ('RAW', 'REUSABLE_REMNANTS') ORDER BY warehouse_type, code`,
    sql`SELECT id, name, color, quantity, counted_meters, counted_bars, counted_at FROM stock_count_lines
        WHERE tenant_id = ${actor.tenantId} AND status = 'counted' ORDER BY counted_at DESC LIMIT 50`,
  ]);
  return { lines, items, warehouses, counted, canCount: ['owner', 'admin'].includes(actor.role) };
}

/** What an already posted entry wrote, answered again to a retried request. */
async function replayed(tx: any, tenantId: string, entry: any, itemId: string | null, lineId: string | null): Promise<OpeningCountResult> {
  const [sum] = await tx`SELECT count(*)::int AS bars, coalesce(sum(quantity_delta), 0) AS meters, min(item_id::text) AS item_id
    FROM stock_entry_lines WHERE tenant_id = ${tenantId} AND stock_entry_id = ${entry.id}`;
  const [line] = await tx`SELECT id, quantity FROM stock_count_lines WHERE tenant_id = ${tenantId} AND stock_entry_id = ${entry.id}`;
  if (entry.reference_type !== 'opening_count' || (itemId && sum.item_id !== itemId) || (lineId && line?.id !== lineId))
    fail('Bu komut anahtarı başka bir kayıt için kullanılmış', 409);
  const countedMeters = Number(sum.meters);
  return {
    entryId: entry.id,
    bars: sum.bars,
    countedMeters,
    listedMeters: line ? Number(line.quantity) : null,
    differenceMeters: line ? countedMeters - Number(line.quantity) : null,
    replay: true,
  };
}

/**
 * Enters the counted bars of one profile and colour as opening stock: one lot per bar with its
 * colour and length, posted as a receipt whose source is the opening count (reversible while the
 * lots are untouched; reversing puts a list line back to waiting). A list line is counted once.
 */
export async function recordOpeningCount(actor: WorkOrderActor, raw: unknown, idempotencyKey: string): Promise<OpeningCountResult> {
  if (!['owner', 'admin'].includes(actor.role)) fail('Açılış sayımını firma yöneticisi girer', 403);
  const input = OpeningCountSchema.parse(raw);
  const totalBars = input.bars.reduce((sum, b) => sum + b.count, 0);
  if (totalBars > MAX_OPENING_BARS) fail(`Bir girişte en fazla ${MAX_OPENING_BARS} çubuk; kalanını ayrı girin`);
  const t = actor.tenantId;
  return withTransaction(async (tx: any) => {
    // Only opening counts of this firm wait on each other; orders and receipts are not held up.
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${t + ':opening-count'}, 0))`;
    const key = 'opening:' + createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 32);
    const [previous] = await tx`SELECT id, reference_type FROM stock_entries WHERE tenant_id = ${t} AND idempotency_key = ${key}`;
    if (previous) return replayed(tx, t, previous, input.itemId ?? null, input.lineId ?? null);

    let line: any = null;
    let itemId = input.itemId;
    let warehouseId = input.warehouseId;
    let color = input.color || undefined;
    if (input.lineId) {
      [line] = await tx`
        SELECT l.*, d.warehouse_id FROM stock_count_lines l JOIN stock_count_documents d ON d.id = l.document_id AND d.tenant_id = l.tenant_id
        WHERE l.tenant_id = ${t} AND l.id = ${input.lineId} FOR UPDATE OF l`;
      if (!line) fail('Sayım satırı bulunamadı', 404);
      if (line.status !== 'needs_bars') fail('Bu satırın çubukları zaten girildi', 409);
      itemId = line.item_id;
      warehouseId = warehouseId ?? line.warehouse_id;
      color = line.color || color;
    }
    const [item] = await tx`SELECT * FROM inventory_items WHERE tenant_id = ${t} AND id = ${itemId} AND active = true`;
    if (!item) fail('Malzeme bulunamadı veya pasif', 404);
    if (item.stock_uom !== 'm') fail('Çubuk sayımı yalnız metre ile tutulan profiller içindir');
    // Every bar carries a colour; an unpainted profile's bars say so.
    if ((item.processed_states ?? []).includes('boyasiz')) color = 'Boyasız';
    if (!color) fail('Çubukların rengini girin');
    const [warehouse] = await tx`SELECT id FROM warehouses WHERE tenant_id = ${t} AND id = ${warehouseId} AND active = true AND warehouse_type IN ('RAW', 'REUSABLE_REMNANTS')`;
    if (!warehouse) fail('Hammadde veya artık deposu seçin');

    const prefix = `ACILIS-${key.slice(8, 20).toUpperCase()}`;
    const metadata = { color, source: 'opening_count', countLineId: line?.id ?? null, ...(input.unitCost === undefined ? {} : { unitCost: input.unitCost }), isRemnant: false };
    const lines: any[] = [];
    let offset = 0;
    for (const bar of input.bars) {
      const meters = bar.lengthMm / 1000;
      // One statement per bar length, not per bar.
      const lots = await tx`
        INSERT INTO stock_lots (tenant_id, item_id, warehouse_id, lot_number, original_qty, remaining_qty, length_m, weight_kg, metadata)
        SELECT ${t}, ${item.id}, ${warehouse.id}, ${prefix} || '-' || (${offset}::int + n), ${meters}, ${meters}, ${meters},
          ${item.weight_per_meter_kg === null ? null : meters * Number(item.weight_per_meter_kg)}, ${JSON.stringify(metadata)}::text::jsonb
        FROM generate_series(1, ${bar.count}::int) AS n
        RETURNING id`;
      offset += bar.count;
      for (const lot of lots) lines.push({ itemId: item.id, warehouseId: warehouse.id, lotId: lot.id, quantityDelta: meters, uom: 'm', unitCost: input.unitCost, metadata: { color } });
    }
    const countedMeters = input.bars.reduce((sum, b) => sum + (b.lengthMm * b.count) / 1000, 0);
    const entry = await postStockEntryInTransaction(tx, actor, {
      entryType: 'MATERIAL_RECEIPT',
      idempotencyKey: key,
      referenceType: 'opening_count',
      referenceId: line?.document_id,
      note: (input.note || `Açılış sayımı (çubuk): ${item.name} · ${color}`).slice(0, 1000),
      lines,
    });
    if (line)
      await tx`UPDATE stock_count_lines SET status = 'counted', counted_meters = ${countedMeters}, counted_bars = ${totalBars}, counted_by = ${actor.userId},
        counted_at = now(), stock_entry_id = ${entry.id}, updated_at = now() WHERE id = ${line.id}`;
    return {
      entryId: entry.id as string,
      bars: totalBars,
      countedMeters,
      listedMeters: line ? Number(line.quantity) : null,
      differenceMeters: line ? countedMeters - Number(line.quantity) : null,
    };
  });
}
