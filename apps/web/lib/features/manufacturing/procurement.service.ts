import 'server-only';
import { createHash } from 'node:crypto';

import { withTransaction } from '@/lib/db/transaction';
import { postStockEntryInTransaction } from './inventory.service';
import {
  GoodsReceiptInput,
  GoodsReceiptInputSchema,
  ManufacturingActor,
} from './types';

export async function submitGoodsReceipt(
  actor: ManufacturingActor,
  rawInput: GoodsReceiptInput,
) {
  const input = GoodsReceiptInputSchema.parse(rawInput);
  return withTransaction(async ({ sql: tx }) => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${actor.tenantId},0))`;
    const requestHash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    const existing = await tx`
      SELECT * FROM goods_receipts
      WHERE tenant_id = ${actor.tenantId} AND idempotency_key = ${input.idempotencyKey}
    `;
    if (existing[0]) {
      if (existing[0].receipt_number !== input.receiptNumber || existing[0].notes !== 'legacy-hash:'+requestHash) {
        throw new Error('Idempotency anahtarı farklı bir mal kabulde kullanılmış');
      }
      return existing[0];
    }

    if (input.purchaseOrderId) {
      const purchaseOrders = await tx`
        SELECT id, status FROM purchase_orders
        WHERE tenant_id = ${actor.tenantId} AND id = ${input.purchaseOrderId}
        FOR UPDATE
      `;
      if (!purchaseOrders[0] || !['submitted','partially_received'].includes(purchaseOrders[0].status)) {
        throw new Error('Geçerli satın alma siparişi bulunamadı');
      }
    }

    const receiptRows = await tx`
      INSERT INTO goods_receipts (
        tenant_id, receipt_number, purchase_order_id, status,
        idempotency_key, received_by, notes
      ) VALUES (
        ${actor.tenantId}, ${input.receiptNumber}, ${input.purchaseOrderId || null},
        'draft', ${input.idempotencyKey}, ${actor.userId}, ${'legacy-hash:'+requestHash}
      ) RETURNING *
    `;
    const receipt = receiptRows[0];
    const stockLines: Array<any> = [];

    if (new Set(input.lines.map(l=>l.purchaseOrderLineId || l.itemId)).size !== input.lines.length) throw new Error('Mal kabul kalemi yinelenemez');
    for (const line of input.lines) {
      if (line.uom === 'm') throw new Error('Fiziksel profil kabulü için Satın alma / Mal kabul ekranını kullanın');
      if (input.purchaseOrderId) {
        if (!line.purchaseOrderLineId) throw new Error('Satın alma kalemi gerekli');
        const [poLine] = await tx`SELECT * FROM purchase_order_lines WHERE tenant_id=${actor.tenantId} AND purchase_order_id=${input.purchaseOrderId} AND id=${line.purchaseOrderLineId} FOR UPDATE`;
        if (!poLine || poLine.item_id !== line.itemId || poLine.uom !== line.uom || poLine.warehouse_id !== line.acceptedWarehouseId || Number(poLine.received_qty)+line.acceptedQty+line.rejectedQty > Number(poLine.ordered_qty)) throw new Error('Mal kabul kalemi veya miktarı siparişle uyuşmuyor');
      }
      if (!(await tx`SELECT 1 FROM warehouses WHERE tenant_id=${actor.tenantId} AND id=${line.acceptedWarehouseId} AND warehouse_type='RAW' AND active=true`).length) throw new Error('Aktif hammadde deposu gerekli');
      if (line.rejectedQty && !(await tx`SELECT 1 FROM warehouses WHERE tenant_id=${actor.tenantId} AND id=${line.rejectedWarehouseId || null} AND warehouse_type='REJECTED' AND active=true`).length) throw new Error('Aktif red deposu gerekli');
      await tx`
        INSERT INTO goods_receipt_lines (
          tenant_id, goods_receipt_id, purchase_order_line_id, item_id,
          accepted_warehouse_id, rejected_warehouse_id, accepted_qty, rejected_qty, uom
        ) VALUES (
          ${actor.tenantId}, ${receipt.id}, ${line.purchaseOrderLineId || null}, ${line.itemId},
          ${line.acceptedWarehouseId}, ${line.rejectedWarehouseId || null},
          ${line.acceptedQty}, ${line.rejectedQty}, ${line.uom}
        )
      `;
      if (line.acceptedQty > 0) {
        stockLines.push({
          itemId: line.itemId,
          warehouseId: line.acceptedWarehouseId,
          quantityDelta: line.acceptedQty,
          uom: line.uom,
          metadata: { goodsReceiptId: receipt.id, disposition: 'accepted' },
        });
      }
      if (line.rejectedQty > 0) {
        if (!line.rejectedWarehouseId) throw new Error('Reddedilen miktar için REJECTED deposu gerekli');
        stockLines.push({
          itemId: line.itemId,
          warehouseId: line.rejectedWarehouseId,
          quantityDelta: line.rejectedQty,
          uom: line.uom,
          metadata: { goodsReceiptId: receipt.id, disposition: 'rejected' },
        });
      }
    }

    const stockEntry = await postStockEntryInTransaction(tx, actor, {
      entryType: 'MATERIAL_RECEIPT',
      idempotencyKey: `stock:${input.idempotencyKey}`,
      referenceType: 'goods_receipt',
      referenceId: receipt.id,
      note: `Mal kabul ${input.receiptNumber}`,
      lines: stockLines,
    });

    if (input.purchaseOrderId) {
      for (const line of input.lines) {
        if (!line.purchaseOrderLineId) continue;
        const updatedLines = await tx`
          UPDATE purchase_order_lines
          SET received_qty = received_qty + ${line.acceptedQty}
          WHERE tenant_id = ${actor.tenantId}
            AND purchase_order_id = ${input.purchaseOrderId}
            AND id = ${line.purchaseOrderLineId}
            AND received_qty + ${line.acceptedQty} <= ordered_qty
          RETURNING id
        `;
        if (!updatedLines[0]) throw new Error('Mal kabul miktarı satın alma siparişini aşıyor');
      }
      await tx`
        UPDATE purchase_orders po
        SET status = CASE
          WHEN NOT EXISTS (
            SELECT 1 FROM purchase_order_lines pol
            WHERE pol.purchase_order_id = po.id AND pol.received_qty < pol.ordered_qty
          ) THEN 'received'
          ELSE 'partially_received'
        END
        , version = version + 1, updated_at = now()
        WHERE po.tenant_id = ${actor.tenantId} AND po.id = ${input.purchaseOrderId}
      `;
    }

    const submitted = await tx`
      UPDATE goods_receipts
      SET status = 'submitted', stock_entry_id = ${stockEntry.id}, received_at = now()
      WHERE tenant_id = ${actor.tenantId} AND id = ${receipt.id}
      RETURNING *
    `;
    return submitted[0];
  }, { isolationLevel: 'SERIALIZABLE' });
}
