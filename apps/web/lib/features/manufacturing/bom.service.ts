import 'server-only';

import { withTransaction } from '@/lib/db/transaction';
import { scaleBomQuantity } from './calculations';
import {
  CreateBomInput,
  CreateBomInputSchema,
  ManufacturingActor,
} from './types';

export async function createBom(actor: ManufacturingActor, rawInput: CreateBomInput) {
  const input = CreateBomInputSchema.parse(rawInput);

  return withTransaction(async ({ sql: tx }) => {
    const itemIds = [...new Set([input.finishedItemId, ...input.items.map((item) => item.itemId)])];
    const itemRows = await tx`
      SELECT id, stock_uom
      FROM inventory_items
      WHERE tenant_id = ${actor.tenantId}
        AND id = ANY(${itemIds}::uuid[])
        AND active = true
      FOR SHARE
    `;
    const uoms = new Map(itemRows.map((row: any) => [row.id, row.stock_uom]));
    if (uoms.size !== itemIds.length) throw new Error('BOM kalemlerinden biri bulunamadı');
    if (uoms.get(input.finishedItemId) !== input.outputUom) {
      throw new Error('Mamul UOM değeri item kartıyla uyuşmuyor');
    }
    for (const item of input.items) {
      if (uoms.get(item.itemId) !== item.uom) {
        throw new Error(`BOM UOM değeri item kartıyla uyuşmuyor: ${item.itemId}`);
      }
    }

    if (input.isDefault) {
      await tx`
        UPDATE boms
        SET is_default = false, updated_at = now()
        WHERE tenant_id = ${actor.tenantId}
          AND finished_item_id = ${input.finishedItemId}
          AND is_default = true
          AND is_active = true
      `;
    }

    const rows = await tx`
      INSERT INTO boms (
        tenant_id, bom_code, finished_item_id, version, output_qty,
        output_uom, is_default, notes, created_by
      ) VALUES (
        ${actor.tenantId}, ${input.bomCode}, ${input.finishedItemId}, ${input.version},
        ${input.outputQty}, ${input.outputUom}, ${input.isDefault}, ${input.notes || null},
        ${actor.userId}
      )
      RETURNING *
    `;
    const bom = rows[0];

    for (const [position, item] of input.items.entries()) {
      await tx`
        INSERT INTO bom_items (
          tenant_id, bom_id, item_id, quantity, uom,
          source_warehouse_id, scrap_rate, position
        ) VALUES (
          ${actor.tenantId}, ${bom.id}, ${item.itemId}, ${item.quantity}, ${item.uom},
          ${item.sourceWarehouseId || null}, ${item.scrapRate}, ${position}
        )
      `;
    }

    return getBomInTransaction(tx, actor.tenantId, bom.id);
  }, { isolationLevel: 'SERIALIZABLE' });
}

export async function getBomInTransaction(tx: any, tenantId: string, bomId: string) {
  const rows = await tx`
    SELECT b.*, i.sku AS finished_item_sku, i.name AS finished_item_name
    FROM boms b
    JOIN inventory_items i ON i.id = b.finished_item_id AND i.tenant_id = b.tenant_id
    WHERE b.tenant_id = ${tenantId} AND b.id = ${bomId}
    LIMIT 1
  `;
  if (!rows[0]) throw new Error('BOM bulunamadı');
  const itemRows = await tx`
    SELECT bi.*, i.sku, i.name AS item_name
    FROM bom_items bi
    JOIN inventory_items i ON i.id = bi.item_id AND i.tenant_id = bi.tenant_id
    WHERE bi.tenant_id = ${tenantId} AND bi.bom_id = ${bomId}
    ORDER BY bi.position
  `;
  return { ...rows[0], items: itemRows };
}

export function explodeBom(
  bom: { output_qty: string | number; items: Array<any> },
  plannedQty: number,
) {
  return bom.items.map((item) => ({
    ...item,
    requiredQty: scaleBomQuantity(Number(item.quantity), Number(bom.output_qty), plannedQty),
  }));
}
