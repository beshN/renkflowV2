import "server-only";
import { randomUUID } from "node:crypto";
import { sql } from "@/lib/db";
import { withTransaction } from "@/lib/db/transaction";
import {
  WorkOrderApiError,
  type WorkOrderActor,
} from "@/lib/features/work-orders/security";
import { requireCap } from "../field/common.server";
import { COUNT_UNITS } from "../inventory/vocabulary";
import {
  requireProcurementRead,
  requireProcurementWrite,
} from "./purchasing.service";
import { postStockEntryInTransaction } from "./inventory.service";
import {
  SUPPLIER_RETURN_SCHEMA_PENDING,
  supplierReturnsReady,
} from "./supplier-return-schema.server";

export {
  SupplierReturnInput,
  SupplierReturnTransition,
  nextSupplierReturnStatus,
} from "./supplier-return";
import {
  SupplierReturnInput,
  SupplierReturnTransition,
  nextSupplierReturnStatus,
} from "./supplier-return";
const fail = (message: string, status = 409): never => {
  throw new WorkOrderApiError(message, status);
};
async function readAccess(actor: WorkOrderActor) {
  requireProcurementRead(actor);
  await requireCap(actor, "purchasing", "view", "Tedarikçi iadesi");
}
// Checked after the permission checks so an unauthorised caller still gets 401/403, not schema state.
async function requireReturnSchema() {
  if (!(await supplierReturnsReady())) fail(SUPPLIER_RETURN_SCHEMA_PENDING, 409);
}
export { supplierReturnsReady };
export async function supplierReturns(actor: WorkOrderActor, id?: string) {
  await readAccess(actor);
  if (!(await supplierReturnsReady())) {
    // Before 086 the list is simply empty; a single document cannot exist yet.
    if (id) fail(SUPPLIER_RETURN_SCHEMA_PENDING, 409);
    return [];
  }
  const rows = await sql`SELECT r.*,s.name AS supplier_name,
    COALESCE((SELECT json_agg(json_build_object('id',l.id,'source_line_id',l.goods_receipt_line_id,
      'quantity',l.quantity,'uom',l.uom,'item_name',i.name,'receipt_number',gr.receipt_number))
      FROM supplier_return_lines l
      JOIN goods_receipt_lines gl ON gl.tenant_id=l.tenant_id AND gl.id=l.goods_receipt_line_id
      JOIN goods_receipts gr ON gr.tenant_id=gl.tenant_id AND gr.id=gl.goods_receipt_id
      JOIN inventory_items i ON i.tenant_id=gl.tenant_id AND i.id=gl.item_id
      WHERE l.tenant_id=r.tenant_id AND l.supplier_return_id=r.id),'[]'::json) AS lines
    FROM supplier_returns r JOIN suppliers s ON s.tenant_id=r.tenant_id AND s.id=r.supplier_id
    WHERE r.tenant_id=${actor.tenantId} AND (${id || null}::uuid IS NULL OR r.id=${id || null}::uuid)
    ORDER BY r.created_at DESC LIMIT 300`;
  if (id && !rows.length) fail("İade belgesi bulunamadı", 404);
  return rows;
}
async function audit(
  tx: any,
  actor: WorkOrderActor,
  id: string,
  from: string | null,
  to: string,
) {
  await tx`INSERT INTO activity_logs(tenant_id,entity_type,entity_id,action,actor_id,changes)
    VALUES(${actor.tenantId},'supplier_return',${id},${from ? "status_changed" : "created"},${actor.userId},
    ${JSON.stringify({ status: { from, to } })}::text::jsonb)`;
}
export async function createSupplierReturn(
  actor: WorkOrderActor,
  raw: unknown,
) {
  requireProcurementWrite(actor);
  await requireCap(actor, "purchasing", "create", "Tedarikçi iadesi taslağı");
  await requireReturnSchema();
  const d = SupplierReturnInput.parse(raw),
    t = actor.tenantId;
  return withTransaction(
    async ({ sql: tx }) => {
      // Same tenant lock as goods-receipt commands; source row serializes all return reservations.
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${t},0))`;
      const [source] =
        await tx`SELECT gl.*,gr.status AS receipt_status,po.supplier_id
      FROM goods_receipt_lines gl JOIN goods_receipts gr ON gr.tenant_id=gl.tenant_id AND gr.id=gl.goods_receipt_id
      JOIN purchase_orders po ON po.tenant_id=gr.tenant_id AND po.id=gr.purchase_order_id
      WHERE gl.tenant_id=${t} AND gl.id=${d.sourceLineId} FOR UPDATE OF gl,gr`;
      if (!source) fail("Mal kabul satırı bulunamadı", 404);
      const [existing] =
        await tx`SELECT r.*,l.goods_receipt_line_id,l.quantity FROM supplier_returns r
      JOIN supplier_return_lines l ON l.tenant_id=r.tenant_id AND l.supplier_return_id=r.id
      WHERE r.tenant_id=${t} AND r.idempotency_key=${d.idempotencyKey}`;
      if (existing) {
        if (
          existing.goods_receipt_line_id !== d.sourceLineId ||
          Number(existing.quantity) !== d.quantity
        )
          fail("İşlem anahtarı başka bir iadede kullanılmış");
        return existing;
      }
      if (
        source.receipt_status !== "submitted" ||
        !source.supplier_id ||
        !source.rejected_warehouse_id
      )
        fail("Onaylı, tedarikçisi ve red deposu olan kabul satırı gerekli");
      if (COUNT_UNITS.has(source.uom) && !Number.isInteger(d.quantity))
        fail("Adet biriminde tam sayı gerekli", 400);
      // All documents reserve their quantity, including drafts and closed returns. Numeric comparison stays in PG.
      const [remaining] =
        await tx`SELECT ${source.rejected_qty}::numeric - COALESCE(sum(quantity),0) >= ${d.quantity}::numeric AS enough
      FROM supplier_return_lines WHERE tenant_id=${t} AND goods_receipt_line_id=${source.id}`;
      if (!remaining.enough)
        fail("İade miktarı kalan reddedilen miktarı aşamaz");
      const [header] =
        await tx`INSERT INTO supplier_returns(tenant_id,return_number,supplier_id,idempotency_key,created_by,updated_by)
      VALUES(${t},${"IAD-" + randomUUID().toUpperCase()},${source.supplier_id},${d.idempotencyKey},${actor.userId},${actor.userId}) RETURNING *`;
      await tx`INSERT INTO supplier_return_lines(tenant_id,supplier_return_id,goods_receipt_line_id,quantity,uom)
      VALUES(${t},${header.id},${source.id},${d.quantity},${source.uom})`;
      await audit(tx, actor, header.id, null, "draft");
      return header;
    },
    { isolationLevel: "SERIALIZABLE" },
  );
}
export async function transitionSupplierReturn(
  actor: WorkOrderActor,
  id: string,
  raw: unknown,
) {
  requireProcurementWrite(actor);
  await requireCap(actor, "purchasing", "approve", "Tedarikçi iadesi onayı");
  const { status } = SupplierReturnTransition.parse(raw),
    t = actor.tenantId;
  if (status === "sent")
    await requireCap(
      actor,
      "inventory",
      "create",
      "Red deposundan stok çıkışı",
    );
  await requireReturnSchema();
  return withTransaction(
    async ({ sql: tx }) => {
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${t},0))`;
      const [header] =
        await tx`SELECT * FROM supplier_returns WHERE tenant_id=${t} AND id=${id} FOR UPDATE`;
      if (!header) fail("İade belgesi bulunamadı", 404);
      // A repeated successful command is harmless; no backward or skipped transition is accepted.
      if (header.status === status) return header;
      if (!nextSupplierReturnStatus(header.status, status))
        fail("Yalnız taslak → gönderildi → kapandı geçişi yapılabilir");
      let entryId = header.stock_entry_id;
      if (status === "sent") {
        const lines =
          await tx`SELECT l.*,gl.item_id,gl.rejected_warehouse_id,gl.goods_receipt_id,gl.purchase_order_line_id,
        gr.stock_entry_id,gr.status AS receipt_status
        FROM supplier_return_lines l JOIN goods_receipt_lines gl ON gl.tenant_id=l.tenant_id AND gl.id=l.goods_receipt_line_id
        JOIN goods_receipts gr ON gr.tenant_id=gl.tenant_id AND gr.id=gl.goods_receipt_id
        WHERE l.tenant_id=${t} AND l.supplier_return_id=${id} FOR UPDATE OF gl,gr`;
        if (!lines.length) fail("İade satırı yok");
        const stockLines: any[] = [];
        for (const line of lines) {
          if (line.receipt_status !== "submitted")
            fail("Kaynak mal kabul artık onaylı değil");
          const [warehouse] =
            await tx`SELECT id FROM warehouses WHERE tenant_id=${t} AND id=${line.rejected_warehouse_id} AND warehouse_type='REJECTED' AND active=true`;
          if (!warehouse) fail("Aktif red deposu gerekli");
          // Only the source receipt/PO line's rejected lots may leave. Do not consume another receipt's stock.
          const lots =
            await tx`SELECT lot.*,sl.unit_cost FROM stock_entry_lines sl
          JOIN stock_lots lot ON lot.tenant_id=sl.tenant_id AND lot.id=sl.lot_id
          WHERE sl.tenant_id=${t} AND sl.stock_entry_id=${line.stock_entry_id} AND sl.item_id=${line.item_id}
            AND sl.warehouse_id=${line.rejected_warehouse_id} AND sl.quantity_delta>0
            AND sl.metadata->>'disposition'='rejected'
            AND sl.metadata->>'purchaseOrderLineId'=${line.purchase_order_line_id}::text
          ORDER BY lot.length_m DESC NULLS LAST,lot.id FOR UPDATE OF lot`;
          let left = Number(line.quantity);
          for (const lot of lots) {
            if (left < 0.0000005) break;
            if (lot.status !== "available" || Number(lot.remaining_qty) <= 0)
              continue;
            const available = Number(lot.remaining_qty);
            // A physical profile is returned whole; no cutting or unit conversion in this slice.
            if (line.uom === "m" && available > left + 0.0000005) continue;
            const amount = Math.min(left, available);
            await tx`UPDATE stock_lots SET remaining_qty=remaining_qty-${amount},
            status=CASE WHEN remaining_qty=${amount} THEN 'consumed' ELSE status END,updated_at=now()
            WHERE tenant_id=${t} AND id=${lot.id}`;
            stockLines.push({
              itemId: line.item_id,
              warehouseId: line.rejected_warehouse_id,
              lotId: lot.id,
              quantityDelta: -amount,
              uom: line.uom,
              unitCost:
                lot.unit_cost == null ? undefined : Number(lot.unit_cost),
              metadata: {
                supplierReturnId: id,
                goodsReceiptLineId: line.goods_receipt_line_id,
              },
            });
            left -= amount;
          }
          if (left > 0.0000005) {
            // Legacy receipts without lots still use their original receipt ledger and rejected warehouse.
            const [legacy] =
              await tx`SELECT COALESCE(sum(quantity_delta),0) AS qty FROM stock_entry_lines
            WHERE tenant_id=${t} AND stock_entry_id=${line.stock_entry_id} AND item_id=${line.item_id}
              AND warehouse_id=${line.rejected_warehouse_id} AND lot_id IS NULL AND quantity_delta>0
              AND metadata->>'disposition'='rejected'`;
            if (lots.length || Number(legacy.qty) < Number(line.quantity))
              fail(
                "Kaynak red lotlarında yeterli stok yok; profil miktarı tam fiziksel profillerden oluşmalı",
              );
            stockLines.push({
              itemId: line.item_id,
              warehouseId: line.rejected_warehouse_id,
              quantityDelta: -left,
              uom: line.uom,
              metadata: {
                supplierReturnId: id,
                goodsReceiptLineId: line.goods_receipt_line_id,
              },
            });
          }
        }
        const entry = await postStockEntryInTransaction(tx, actor, {
          entryType: "MATERIAL_ISSUE",
          idempotencyKey: "supplier-return:" + id,
          referenceType: "supplier_return",
          referenceId: id,
          note: header.return_number,
          lines: stockLines,
        });
        entryId = entry.id;
      }
      const [updated] =
        await tx`UPDATE supplier_returns SET status=${status},stock_entry_id=${entryId},
      updated_by=${actor.userId},updated_at=now(),sent_at=CASE WHEN ${status}='sent' THEN now() ELSE sent_at END,
      closed_at=CASE WHEN ${status}='closed' THEN now() ELSE closed_at END WHERE tenant_id=${t} AND id=${id} RETURNING *`;
      await audit(tx, actor, id, header.status, status);
      return updated;
    },
    { isolationLevel: "SERIALIZABLE" },
  );
}
