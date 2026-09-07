import 'server-only';

import { randomUUID } from 'node:crypto';
import { sql } from '@/lib/db';
import { withTransaction } from '@/lib/db/transaction';
import {
  ManufacturingActor,
  PostStockEntryInput,
  PostStockEntryInputSchema,
} from './types';
import { assertNativeInventoryEnabled } from './mode';

type PostOptions = { allowReservedStock?: boolean; reversalOfId?: string };

function entryNumber() {
  return `STK-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function getStockBalances(tenantId: string) {
  const rows = await sql`
    SELECT
      b.item_id,
      i.sku,
      i.name AS item_name,
      i.stock_uom,
      b.warehouse_id,
      w.code AS warehouse_code,
      w.name AS warehouse_name,
      b.on_hand_qty,
      COALESCE(r.reserved_qty, 0) AS reserved_qty,
      b.on_hand_qty - COALESCE(r.reserved_qty, 0) AS available_qty,
      b.updated_at
    FROM stock_balances b
    JOIN inventory_items i ON i.id = b.item_id AND i.tenant_id = b.tenant_id
    JOIN warehouses w ON w.id = b.warehouse_id AND w.tenant_id = b.tenant_id
    LEFT JOIN LATERAL (
      SELECT SUM(rl.reserved_qty - rl.consumed_qty - rl.released_qty) AS reserved_qty
      FROM stock_reservation_lines rl
      JOIN stock_reservations rh ON rh.id = rl.reservation_id
      WHERE rl.tenant_id = b.tenant_id
        AND rl.item_id = b.item_id
        AND rl.warehouse_id = b.warehouse_id
        AND rh.status = 'active'
    ) r ON true
    WHERE b.tenant_id = ${tenantId}
    ORDER BY i.name, w.code
  `;
  return rows;
}

export async function postStockEntry(
  actor: ManufacturingActor,
  rawInput: PostStockEntryInput,
) {
  const input = PostStockEntryInputSchema.parse(rawInput);
  return withTransaction(
    ({ sql: tx }) => postStockEntryInTransaction(tx, actor, input),
    { isolationLevel: 'SERIALIZABLE' },
  );
}

export async function postStockEntryInTransaction(
  tx: any,
  actor: ManufacturingActor,
  input: PostStockEntryInput,
  options: PostOptions = {},
) {
  assertNativeInventoryEnabled();
  const existing = await tx`
    SELECT * FROM stock_entries
    WHERE tenant_id = ${actor.tenantId} AND idempotency_key = ${input.idempotencyKey}
    LIMIT 1
  `;
  if (existing[0]) {
    const sameCommand = existing[0].entry_type === input.entryType
      && (existing[0].reference_type || null) === (input.referenceType || null)
      && (existing[0].reference_id || null) === (input.referenceId || null);
    if (!sameCommand) throw new Error('Idempotency anahtarı farklı bir stok komutunda kullanılmış');
    return existing[0];
  }

  const keys = [...new Set(input.lines.map((line) => `${line.itemId}:${line.warehouseId}`))].sort();
  for (const key of keys) {
    const [itemId, warehouseId] = key.split(':');
    await tx`
      INSERT INTO stock_balances (tenant_id, item_id, warehouse_id, on_hand_qty)
      VALUES (${actor.tenantId}, ${itemId}, ${warehouseId}, 0)
      ON CONFLICT (tenant_id, item_id, warehouse_id) DO NOTHING
    `;
    await tx`
      SELECT on_hand_qty FROM stock_balances
      WHERE tenant_id = ${actor.tenantId} AND item_id = ${itemId} AND warehouse_id = ${warehouseId}
      FOR UPDATE
    `;
  }

  const itemIds = [...new Set(input.lines.map((line) => line.itemId))];
  const warehouseIds = [...new Set(input.lines.map((line) => line.warehouseId))];
  const itemRows = await tx`
    SELECT id, stock_uom FROM inventory_items
    WHERE tenant_id = ${actor.tenantId} AND id = ANY(${itemIds}::uuid[]) AND active = true
  `;
  const warehouseRows = await tx`
    SELECT id FROM warehouses
    WHERE tenant_id = ${actor.tenantId} AND id = ANY(${warehouseIds}::uuid[]) AND active = true
  `;
  const itemUom = new Map(itemRows.map((row: any) => [row.id, row.stock_uom]));
  const warehouseSet = new Set(warehouseRows.map((row: any) => row.id));
  if (itemUom.size !== itemIds.length || warehouseSet.size !== warehouseIds.length) {
    throw new Error('Stok kalemi veya depo bulunamadı');
  }
  for (const line of input.lines) {
    if (itemUom.get(line.itemId) !== line.uom) {
      throw new Error(`Stok UOM uyuşmazlığı: ${line.itemId}`);
    }
  }

  const deltas = new Map<string, number>();
  for (const line of input.lines) {
    const key = `${line.itemId}:${line.warehouseId}`;
    deltas.set(key, (deltas.get(key) || 0) + line.quantityDelta);
  }
  for (const [key, delta] of deltas) {
    if (delta >= 0) continue;
    const [itemId, warehouseId] = key.split(':');
    const balanceRows = await tx`
      SELECT on_hand_qty FROM stock_balances
      WHERE tenant_id = ${actor.tenantId} AND item_id = ${itemId} AND warehouse_id = ${warehouseId}
    `;
    const onHand = Number(balanceRows[0]?.on_hand_qty || 0);
    let protectedQty = 0;
    if (!options.allowReservedStock) {
      const reservedRows = await tx`
        SELECT COALESCE(SUM(rl.reserved_qty - rl.consumed_qty - rl.released_qty), 0) AS qty
        FROM stock_reservation_lines rl
        JOIN stock_reservations rh ON rh.id = rl.reservation_id
        WHERE rl.tenant_id = ${actor.tenantId}
          AND rl.item_id = ${itemId}
          AND rl.warehouse_id = ${warehouseId}
          AND rh.status = 'active'
      `;
      protectedQty = Number(reservedRows[0]?.qty || 0);
    }
    if (onHand + delta < protectedQty) throw new Error('Yetersiz kullanılabilir stok');
  }

  const headerRows = await tx`
    INSERT INTO stock_entries (
      tenant_id, entry_number, entry_type, status, reference_type, reference_id,
      reversal_of_id, idempotency_key, note, submitted_by
    ) VALUES (
      ${actor.tenantId}, ${entryNumber()}, ${input.entryType}, 'draft',
      ${input.referenceType || null}, ${input.referenceId || null}, ${options.reversalOfId || null},
      ${input.idempotencyKey}, ${input.note || null}, ${actor.userId}
    ) RETURNING *
  `;
  const entry = headerRows[0];

  for (const line of input.lines) {
    await tx`
      INSERT INTO stock_entry_lines (
        tenant_id, stock_entry_id, item_id, warehouse_id, lot_id,
        quantity_delta, uom, unit_cost, metadata
      ) VALUES (
        ${actor.tenantId}, ${entry.id}, ${line.itemId}, ${line.warehouseId}, ${line.lotId || null},
        ${line.quantityDelta}, ${line.uom}, ${line.unitCost ?? null}, ${JSON.stringify(line.metadata)}::jsonb
      )
    `;
    await tx`
      UPDATE stock_balances
      SET on_hand_qty = on_hand_qty + ${line.quantityDelta}, updated_at = now()
      WHERE tenant_id = ${actor.tenantId}
        AND item_id = ${line.itemId}
        AND warehouse_id = ${line.warehouseId}
    `;
  }

  const submitted = await tx`
    UPDATE stock_entries
    SET status = 'submitted', submitted_at = now()
    WHERE id = ${entry.id} AND tenant_id = ${actor.tenantId}
    RETURNING *
  `;
  return submitted[0];
}

export async function reverseStockEntry(
  actor: ManufacturingActor,
  stockEntryId: string,
  idempotencyKey: string,
) {
  return withTransaction(async ({ sql: tx }) => {
    const headers = await tx`
      SELECT * FROM stock_entries
      WHERE id = ${stockEntryId} AND tenant_id = ${actor.tenantId} AND status = 'submitted'
      FOR SHARE
    `;
    if (!headers[0]) throw new Error('Stok kaydı bulunamadı');
    const lines = await tx`
      SELECT item_id, warehouse_id, lot_id, quantity_delta, uom, unit_cost, metadata
      FROM stock_entry_lines
      WHERE tenant_id = ${actor.tenantId} AND stock_entry_id = ${stockEntryId}
    `;
    return postStockEntryInTransaction(tx, actor, {
      entryType: 'REVERSAL',
      idempotencyKey,
      referenceType: 'stock_entry_reversal',
      referenceId: stockEntryId,
      lines: lines.map((line: any) => ({
        itemId: line.item_id,
        warehouseId: line.warehouse_id,
        lotId: line.lot_id || undefined,
        quantityDelta: -Number(line.quantity_delta),
        uom: line.uom,
        unitCost: line.unit_cost == null ? undefined : Number(line.unit_cost),
        metadata: { ...line.metadata, reversalOf: stockEntryId },
      })),
    }, { reversalOfId: stockEntryId });
  }, { isolationLevel: 'SERIALIZABLE' });
}
