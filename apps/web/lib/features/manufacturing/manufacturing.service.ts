import 'server-only';

import { withTransaction } from '@/lib/db/transaction';
import { calculateScrapWeight } from './calculations';
import { explodeBom, getBomInTransaction } from './bom.service';
import { postStockEntryInTransaction } from './inventory.service';
import { assertNativeInventoryEnabled } from './mode';
import {
  CompleteProductionRunInput,
  CompleteProductionRunInputSchema,
  CreateProductionWorkOrderInput,
  CreateProductionWorkOrderInputSchema,
  ManufacturingActor,
} from './types';

export async function createProductionWorkOrder(
  actor: ManufacturingActor,
  rawInput: CreateProductionWorkOrderInput,
) {
  assertNativeInventoryEnabled();
  const input = CreateProductionWorkOrderInputSchema.parse(rawInput);
  return withTransaction(async ({ sql: tx }) => {
    const existing = await tx`
      SELECT * FROM work_orders
      WHERE tenant_id = ${actor.tenantId}
        AND manufacturing_idempotency_key = ${input.idempotencyKey}
      LIMIT 1
    `;
    if (existing[0]) {
      if (existing[0].order_id !== input.orderId || existing[0].bom_id !== input.bomId) {
        throw new Error('Idempotency anahtarı farklı bir üretim emrinde kullanılmış');
      }
      return existing[0];
    }

    const orders = await tx`
      SELECT id, status FROM orders
      WHERE tenant_id = ${actor.tenantId} AND id = ${input.orderId}
      FOR SHARE
    `;
    if (!orders[0]) throw new Error('Sipariş bulunamadı');
    if (orders[0].status === 'delivered') throw new Error('Teslim edilmiş sipariş için üretim emri açılamaz');

    const warehouseIds = [
      input.sourceWarehouseId,
      input.wipWarehouseId,
      input.targetWarehouseId,
      ...(input.scrapWarehouseId ? [input.scrapWarehouseId] : []),
    ];
    const warehouses = await tx`
      SELECT id FROM warehouses
      WHERE tenant_id = ${actor.tenantId}
        AND id = ANY(${warehouseIds}::uuid[])
        AND active = true
    `;
    if (warehouses.length !== new Set(warehouseIds).size) throw new Error('Üretim deposu bulunamadı');

    const bom = await getBomInTransaction(tx, actor.tenantId, input.bomId);
    if (!bom.is_active) throw new Error('Pasif BOM kullanılamaz');
    const materials = explodeBom(bom, input.plannedQty);

    const rows = await tx`
      INSERT INTO work_orders (
        tenant_id, title, category, status, priority, due_at, source, created_by,
        order_id, bom_id, production_item_id, planned_qty, produced_qty, production_uom,
        source_warehouse_id, wip_warehouse_id, target_warehouse_id, scrap_warehouse_id,
        reservation_status, manufacturing_idempotency_key
      ) VALUES (
        ${actor.tenantId}, ${input.title}, 'production', 'open', ${input.priority},
        ${input.dueAt || null}, 'integration', ${actor.userId}, ${input.orderId}, ${input.bomId},
        ${bom.finished_item_id}, ${input.plannedQty}, 0, ${bom.output_uom},
        ${input.sourceWarehouseId}, ${input.wipWarehouseId}, ${input.targetWarehouseId},
        ${input.scrapWarehouseId || null}, 'not_reserved', ${input.idempotencyKey}
      ) RETURNING *
    `;
    const workOrder = rows[0];

    for (const material of materials) {
      const sourceWarehouseId = material.source_warehouse_id || input.sourceWarehouseId;
      await tx`
        INSERT INTO work_order_materials (
          tenant_id, work_order_id, bom_item_id, item_id, source_warehouse_id,
          required_qty, uom, snapshot
        ) VALUES (
          ${actor.tenantId}, ${workOrder.id}, ${material.id}, ${material.item_id},
          ${sourceWarehouseId}, ${material.requiredQty}, ${material.uom},
          ${JSON.stringify({
            bomId: bom.id,
            bomCode: bom.bom_code,
            bomVersion: bom.version,
            baseQuantity: Number(material.quantity),
            scrapRate: Number(material.scrap_rate),
          })}::jsonb
        )
      `;
    }
    await tx`
      INSERT INTO work_order_events (tenant_id, work_order_id, event_type, payload, created_by)
      VALUES (
        ${actor.tenantId}, ${workOrder.id}, 'production_work_order_created',
        ${JSON.stringify({ orderId: input.orderId, bomId: input.bomId, plannedQty: input.plannedQty })}::jsonb,
        ${actor.userId}
      )
    `;
    return workOrder;
  }, { isolationLevel: 'SERIALIZABLE' });
}

export async function transferWorkOrderMaterials(
  actor: ManufacturingActor,
  workOrderId: string,
  idempotencyKey: string,
) {
  assertNativeInventoryEnabled();
  if (idempotencyKey.trim().length < 8) throw new Error('Geçerli bir idempotency anahtarı gerekli');
  return withTransaction(async ({ sql: tx }) => {
    const rows = await tx`
      SELECT * FROM work_orders
      WHERE tenant_id = ${actor.tenantId} AND id = ${workOrderId}
      FOR UPDATE
    `;
    const workOrder = rows[0];
    if (!workOrder?.wip_warehouse_id) throw new Error('Üretim emri veya WIP deposu bulunamadı');
    if (!['reserved', 'transferred'].includes(workOrder.reservation_status)) {
      throw new Error('Malzemeler önce rezerve edilmelidir');
    }

    const materials = await tx`
      SELECT * FROM work_order_materials
      WHERE tenant_id = ${actor.tenantId} AND work_order_id = ${workOrderId}
      ORDER BY item_id, source_warehouse_id
      FOR UPDATE
    `;
    const lines: Array<any> = [];
    for (const material of materials) {
      const quantity = Number(material.reserved_qty) - Number(material.transferred_qty);
      if (quantity <= 0) continue;
      lines.push(
        { itemId: material.item_id, warehouseId: material.source_warehouse_id, quantityDelta: -quantity, uom: material.uom, metadata: { workOrderId } },
        { itemId: material.item_id, warehouseId: workOrder.wip_warehouse_id, quantityDelta: quantity, uom: material.uom, metadata: { workOrderId } },
      );
    }
    if (lines.length === 0) {
      const existing = await tx`
        SELECT * FROM stock_entries
        WHERE tenant_id = ${actor.tenantId} AND idempotency_key = ${idempotencyKey}
      `;
      if (existing[0]) return existing[0];
      throw new Error('Aktarılacak rezerve malzeme yok');
    }

    const stockEntry = await postStockEntryInTransaction(tx, actor, {
      entryType: 'MATERIAL_TRANSFER',
      idempotencyKey,
      referenceType: 'work_order',
      referenceId: workOrderId,
      note: 'Rezerve malzemenin WIP deposuna transferi',
      lines,
    }, { allowReservedStock: true });

    for (const material of materials) {
      const quantity = Number(material.reserved_qty) - Number(material.transferred_qty);
      if (quantity <= 0) continue;
      await tx`
        UPDATE work_order_materials
        SET transferred_qty = transferred_qty + ${quantity}, updated_at = now()
        WHERE tenant_id = ${actor.tenantId} AND id = ${material.id}
      `;
    }
    await tx`
      UPDATE stock_reservation_lines rl
      SET warehouse_id = ${workOrder.wip_warehouse_id}
      FROM stock_reservations rh
      WHERE rl.reservation_id = rh.id
        AND rh.tenant_id = ${actor.tenantId}
        AND rh.work_order_id = ${workOrderId}
        AND rh.status = 'active'
    `;
    await tx`
      UPDATE work_orders
      SET status = 'in_progress', reservation_status = 'transferred', updated_at = now()
      WHERE tenant_id = ${actor.tenantId} AND id = ${workOrderId}
    `;
    await tx`
      UPDATE orders SET status = 'in_production', updated_at = now()
      WHERE tenant_id = ${actor.tenantId} AND id = ${workOrder.order_id}
    `;
    await tx`
      INSERT INTO work_order_events (tenant_id, work_order_id, event_type, payload, created_by)
      VALUES (${actor.tenantId}, ${workOrderId}, 'materials_transferred_to_wip',
        ${JSON.stringify({ stockEntryId: stockEntry.id })}::jsonb, ${actor.userId})
    `;
    return stockEntry;
  }, { isolationLevel: 'SERIALIZABLE' });
}

export async function completeProductionRun(
  actor: ManufacturingActor,
  rawInput: CompleteProductionRunInput,
) {
  assertNativeInventoryEnabled();
  const input = CompleteProductionRunInputSchema.parse(rawInput);
  return withTransaction(async ({ sql: tx }) => {
    const existingRuns = await tx`
      SELECT * FROM production_runs
      WHERE tenant_id = ${actor.tenantId} AND idempotency_key = ${input.idempotencyKey}
    `;
    if (existingRuns[0]) {
      if (existingRuns[0].work_order_id !== input.workOrderId) {
        throw new Error('Idempotency anahtarı farklı bir üretim kaydında kullanılmış');
      }
      return existingRuns[0];
    }

    const rows = await tx`
      SELECT * FROM work_orders
      WHERE tenant_id = ${actor.tenantId} AND id = ${input.workOrderId}
      FOR UPDATE
    `;
    const workOrder = rows[0];
    if (!workOrder?.production_item_id || !workOrder.wip_warehouse_id || !workOrder.target_warehouse_id) {
      throw new Error('Üretim emri bulunamadı veya üretim alanları eksik');
    }
    if (workOrder.status !== 'in_progress' || workOrder.reservation_status !== 'transferred') {
      throw new Error('Üretim yalnız WIP transferinden sonra tamamlanabilir');
    }
    const nextProduced = Number(workOrder.produced_qty) + input.producedQty;
    if (nextProduced > Number(workOrder.planned_qty)) throw new Error('Üretilen miktar planlanan miktarı aşamaz');

    const materials = await tx`
      SELECT * FROM work_order_materials
      WHERE tenant_id = ${actor.tenantId} AND work_order_id = ${input.workOrderId}
      ORDER BY item_id
      FOR UPDATE
    `;
    const actualByItem = new Map(input.actualMaterials?.map((item) => [item.itemId, item.quantity]) || []);
    if (input.actualMaterials && actualByItem.size !== input.actualMaterials.length) {
      throw new Error('Gerçek tüketim kalemleri tekrar edemez');
    }
    const materialItemIds = new Set(materials.map((material: any) => material.item_id));
    for (const itemId of actualByItem.keys()) {
      if (!materialItemIds.has(itemId)) throw new Error(`BOM dışı tüketim kalemi: ${itemId}`);
    }
    const consumptionLines: Array<any> = [];
    const consumption = new Map<string, number>();
    for (const material of materials) {
      const defaultQuantity = Number(material.required_qty) * (input.producedQty / Number(workOrder.planned_qty));
      const quantity = actualByItem.get(material.item_id) ?? defaultQuantity;
      const remainingWip = Number(material.transferred_qty) - Number(material.consumed_qty);
      if (quantity > remainingWip + 0.000001) throw new Error(`WIP malzemesi yetersiz: ${material.item_id}`);
      consumption.set(material.item_id, quantity);
      consumptionLines.push({
        itemId: material.item_id,
        warehouseId: workOrder.wip_warehouse_id,
        quantityDelta: -quantity,
        uom: material.uom,
        metadata: { workOrderId: input.workOrderId, actualConsumption: true },
      });
    }
    consumptionLines.push({
      itemId: workOrder.production_item_id,
      warehouseId: workOrder.target_warehouse_id,
      quantityDelta: input.producedQty,
      uom: workOrder.production_uom,
      metadata: { workOrderId: input.workOrderId },
    });

    let scrapWeightKg = 0;
    if (input.scrap && input.scrap.lengthM > 0) {
      const sourceItems = await tx`
        SELECT weight_per_meter_kg FROM inventory_items
        WHERE tenant_id = ${actor.tenantId} AND id = ${input.scrap.sourceItemId}
      `;
      const weightPerMeterKg = Number(sourceItems[0]?.weight_per_meter_kg);
      if (!Number.isFinite(weightPerMeterKg)) throw new Error('Profil kg/metre değeri tanımlı değil');
      scrapWeightKg = calculateScrapWeight(input.scrap.lengthM, weightPerMeterKg);
      if (input.scrap.scrapItemId) {
        if (!workOrder.scrap_warehouse_id) throw new Error('Hurda deposu tanımlı değil');
        consumptionLines.push({
          itemId: input.scrap.scrapItemId,
          warehouseId: workOrder.scrap_warehouse_id,
          quantityDelta: scrapWeightKg,
          uom: 'kg',
          metadata: { workOrderId: input.workOrderId, sourceLengthM: input.scrap.lengthM },
        });
      }
    }

    const stockEntry = await postStockEntryInTransaction(tx, actor, {
      entryType: 'MANUFACTURE',
      idempotencyKey: input.idempotencyKey,
      referenceType: 'work_order',
      referenceId: input.workOrderId,
      note: 'Gerçek tüketim ve mamul girişi',
      lines: consumptionLines,
    }, { allowReservedStock: true });

    const runNumbers = await tx`
      SELECT COALESCE(MAX(run_number), 0)::int + 1 AS next_number
      FROM production_runs
      WHERE tenant_id = ${actor.tenantId} AND work_order_id = ${input.workOrderId}
    `;
    const runRows = await tx`
      INSERT INTO production_runs (
        tenant_id, work_order_id, run_number, produced_qty, stock_entry_id,
        idempotency_key, completed_by
      ) VALUES (
        ${actor.tenantId}, ${input.workOrderId}, ${runNumbers[0].next_number},
        ${input.producedQty}, ${stockEntry.id}, ${input.idempotencyKey}, ${actor.userId}
      ) RETURNING *
    `;
    const run = runRows[0];

    for (const material of materials) {
      const quantity = consumption.get(material.item_id) || 0;
      await tx`
        UPDATE work_order_materials
        SET consumed_qty = consumed_qty + ${quantity}, updated_at = now()
        WHERE tenant_id = ${actor.tenantId} AND id = ${material.id}
      `;
      await tx`
        UPDATE stock_reservation_lines rl
        SET consumed_qty = LEAST(reserved_qty - released_qty, consumed_qty + ${quantity})
        FROM stock_reservations rh
        WHERE rl.reservation_id = rh.id
          AND rh.tenant_id = ${actor.tenantId}
          AND rh.work_order_id = ${input.workOrderId}
          AND rh.status = 'active'
          AND rl.item_id = ${material.item_id}
      `;
    }

    if (input.scrap && input.scrap.lengthM > 0) {
      const weights = await tx`
        SELECT weight_per_meter_kg FROM inventory_items
        WHERE tenant_id = ${actor.tenantId} AND id = ${input.scrap.sourceItemId}
      `;
      await tx`
        INSERT INTO scrap_records (
          tenant_id, production_run_id, source_item_id, scrap_item_id,
          length_m, weight_per_meter_kg, weight_kg
        ) VALUES (
          ${actor.tenantId}, ${run.id}, ${input.scrap.sourceItemId},
          ${input.scrap.scrapItemId || null}, ${input.scrap.lengthM},
          ${weights[0].weight_per_meter_kg}, ${scrapWeightKg}
        )
      `;
    }

    const isComplete = nextProduced >= Number(workOrder.planned_qty);
    if (isComplete) {
      await tx`
        UPDATE stock_reservation_lines rl
        SET released_qty = reserved_qty - consumed_qty
        FROM stock_reservations rh
        WHERE rl.reservation_id = rh.id
          AND rh.tenant_id = ${actor.tenantId}
          AND rh.work_order_id = ${input.workOrderId}
          AND rh.status = 'active'
      `;
      await tx`
        UPDATE stock_reservations SET status = 'consumed', updated_at = now()
        WHERE tenant_id = ${actor.tenantId} AND work_order_id = ${input.workOrderId} AND status = 'active'
      `;
      await tx`
        UPDATE work_order_materials
        SET reserved_qty = consumed_qty, updated_at = now()
        WHERE tenant_id = ${actor.tenantId} AND work_order_id = ${input.workOrderId}
      `;
    }
    await tx`
      UPDATE work_orders
      SET produced_qty = ${nextProduced},
          status = ${isComplete ? 'done' : 'in_progress'},
          reservation_status = ${isComplete ? 'consumed' : 'transferred'},
          completed_at = ${isComplete ? new Date().toISOString() : null},
          updated_at = now()
      WHERE tenant_id = ${actor.tenantId} AND id = ${input.workOrderId}
    `;
    await tx`
      INSERT INTO work_order_events (tenant_id, work_order_id, event_type, payload, created_by)
      VALUES (
        ${actor.tenantId}, ${input.workOrderId}, 'production_run_completed',
        ${JSON.stringify({ runId: run.id, stockEntryId: stockEntry.id, producedQty: input.producedQty, scrapWeightKg })}::jsonb,
        ${actor.userId}
      )
    `;
    return { ...run, scrapWeightKg, workOrderCompleted: isComplete };
  }, { isolationLevel: 'SERIALIZABLE' });
}
