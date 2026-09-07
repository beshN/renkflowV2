import 'server-only';

import { sql } from '@/lib/db';
import { withTransaction } from '@/lib/db/transaction';
import { createBom } from './bom.service';
import { createProductionWorkOrder, transferWorkOrderMaterials, completeProductionRun } from './manufacturing.service';
import { submitGoodsReceipt } from './procurement.service';
import { reserveWorkOrderMaterials } from './reservation.service';
import { ManufacturingActor } from './types';
import { assertNativeInventoryEnabled } from './mode';
import { postStockEntryInTransaction } from './inventory.service';

const PILOT_WAREHOUSES = [
  ['RAW', 'Hammadde', 'RAW'],
  ['WIP', 'Yarı Mamul / Üretim', 'WIP'],
  ['FINISHED', 'Mamul', 'FINISHED'],
  ['REUSABLE_REMNANTS', 'Kullanılabilir Artıklar', 'REUSABLE_REMNANTS'],
  ['SCRAP', 'Hurda', 'SCRAP'],
  ['REJECTED', 'Reddedilen Malzeme', 'REJECTED'],
] as const;

export async function ensurePilotMasters(actor: ManufacturingActor) {
  assertNativeInventoryEnabled();
  const masters = await withTransaction(async ({ sql: tx }) => {
    for (const [code, name, type] of PILOT_WAREHOUSES) {
      await tx`
        INSERT INTO warehouses (tenant_id, code, name, warehouse_type)
        VALUES (${actor.tenantId}, ${code}, ${name}, ${type})
        ON CONFLICT (tenant_id, code) DO UPDATE
        SET name = EXCLUDED.name, warehouse_type = EXCLUDED.warehouse_type, active = true, updated_at = now()
      `;
    }
    await tx`
      INSERT INTO inventory_items (
        tenant_id, sku, name, unit, item_type, stock_uom,
        profile_section, standard_length_m, weight_per_meter_kg
      ) VALUES (
        ${actor.tenantId}, 'PROF-AL-4040', 'Alüminyum Profil 40×40', 'm',
        'raw_material', 'm', '40×40 mm', 6, 0.85
      ) ON CONFLICT (tenant_id, sku) DO UPDATE SET
        name = EXCLUDED.name, unit = EXCLUDED.unit, item_type = EXCLUDED.item_type,
        stock_uom = EXCLUDED.stock_uom, profile_section = EXCLUDED.profile_section,
        standard_length_m = EXCLUDED.standard_length_m,
        weight_per_meter_kg = EXCLUDED.weight_per_meter_kg,
        active = true, updated_at = now()
    `;
    await tx`
      INSERT INTO inventory_items (tenant_id, sku, name, unit, item_type, stock_uom)
      VALUES (${actor.tenantId}, 'FG-DEMO', 'Demo Mamul', 'adet', 'finished_good', 'adet')
      ON CONFLICT (tenant_id, sku) DO UPDATE SET
        name = EXCLUDED.name, item_type = EXCLUDED.item_type, stock_uom = EXCLUDED.stock_uom,
        active = true, updated_at = now()
    `;
    await tx`
      INSERT INTO inventory_items (tenant_id, sku, name, unit, item_type, stock_uom)
      VALUES (${actor.tenantId}, 'SCRAP-AL', 'Alüminyum Hurda', 'kg', 'scrap', 'kg')
      ON CONFLICT (tenant_id, sku) DO UPDATE SET
        name = EXCLUDED.name, item_type = EXCLUDED.item_type, stock_uom = EXCLUDED.stock_uom,
        active = true, updated_at = now()
    `;
    const warehouseRows = await tx`
      SELECT id, code FROM warehouses WHERE tenant_id = ${actor.tenantId}
    `;
    const itemRows = await tx`
      SELECT id, sku FROM inventory_items
      WHERE tenant_id = ${actor.tenantId} AND sku IN ('PROF-AL-4040', 'FG-DEMO', 'SCRAP-AL')
    `;
    return {
      warehouses: Object.fromEntries(warehouseRows.map((row: any) => [row.code, row.id])) as Record<string, string>,
      items: Object.fromEntries(itemRows.map((row: any) => [row.sku, row.id])) as Record<string, string>,
    };
  }, { isolationLevel: 'SERIALIZABLE' });

  const existingBom = await sql`
    SELECT id FROM boms
    WHERE tenant_id = ${actor.tenantId} AND bom_code = 'BOM-FG-DEMO' AND version = 1
  `;
  const bom = existingBom[0] || await createBom(actor, {
    bomCode: 'BOM-FG-DEMO',
    finishedItemId: masters.items['FG-DEMO'],
    version: 1,
    outputQty: 1,
    outputUom: 'adet',
    isDefault: true,
    notes: '40×40 profil pilot BOM v1',
    items: [{
      itemId: masters.items['PROF-AL-4040'],
      quantity: 4,
      uom: 'm',
      sourceWarehouseId: masters.warehouses.RAW,
      scrapRate: 0,
    }],
  });
  return { ...masters, bomId: bom.id };
}

async function verifyRollbackAtomicity(
  actor: ManufacturingActor,
  orderId: string,
  profileItemId: string,
  rawWarehouseId: string,
) {
  const idempotencyKey = `pilot:rollback-probe:${orderId}`;
  const beforeRows = await sql`
    SELECT on_hand_qty FROM stock_balances
    WHERE tenant_id = ${actor.tenantId}
      AND item_id = ${profileItemId}
      AND warehouse_id = ${rawWarehouseId}
  `;
  const beforeQty = Number(beforeRows[0]?.on_hand_qty || 0);

  try {
    await withTransaction(async ({ sql: tx }) => {
      await postStockEntryInTransaction(tx, actor, {
        entryType: 'MATERIAL_ISSUE',
        idempotencyKey,
        referenceType: 'order',
        referenceId: orderId,
        note: 'Pilot rollback atomiklik probu',
        lines: [{
          itemId: profileItemId,
          warehouseId: rawWarehouseId,
          quantityDelta: -0.01,
          uom: 'm',
          metadata: { rollbackProbe: true },
        }],
      });
      throw new Error('PILOT_EXPECTED_ROLLBACK');
    }, { isolationLevel: 'SERIALIZABLE' });
  } catch (error) {
    if (!(error instanceof Error) || error.message !== 'PILOT_EXPECTED_ROLLBACK') throw error;
  }

  const afterRows = await sql`
    SELECT on_hand_qty FROM stock_balances
    WHERE tenant_id = ${actor.tenantId}
      AND item_id = ${profileItemId}
      AND warehouse_id = ${rawWarehouseId}
  `;
  const entryRows = await sql`
    SELECT COUNT(*)::int AS count FROM stock_entries
    WHERE tenant_id = ${actor.tenantId} AND idempotency_key = ${idempotencyKey}
  `;
  const afterQty = Number(afterRows[0]?.on_hand_qty || 0);
  if (beforeQty !== afterQty || Number(entryRows[0]?.count || 0) !== 0) {
    throw new Error('Pilot rollback atomiklik kontrolü başarısız');
  }
  return true;
}

export async function runNativeManufacturingPilot(
  actor: ManufacturingActor,
  orderId: string,
) {
  assertNativeInventoryEnabled();
  const masters = await ensurePilotMasters(actor);
  await submitGoodsReceipt(actor, {
    receiptNumber: 'PILOT-GR-001',
    idempotencyKey: 'pilot:goods-receipt:001',
    lines: [{
      itemId: masters.items['PROF-AL-4040'],
      acceptedWarehouseId: masters.warehouses.RAW,
      acceptedQty: 12,
      rejectedQty: 0,
      uom: 'm',
    }],
  });
  const rollbackAtomicityVerified = await verifyRollbackAtomicity(
    actor,
    orderId,
    masters.items['PROF-AL-4040'],
    masters.warehouses.RAW,
  );
  const workOrder = await createProductionWorkOrder(actor, {
    orderId,
    bomId: masters.bomId,
    plannedQty: 1,
    sourceWarehouseId: masters.warehouses.RAW,
    wipWarehouseId: masters.warehouses.WIP,
    targetWarehouseId: masters.warehouses.FINISHED,
    scrapWarehouseId: masters.warehouses.SCRAP,
    title: '40×40 Profil Pilot Üretimi',
    priority: 'medium',
    idempotencyKey: `pilot:work-order:${orderId}`,
  });
  await reserveWorkOrderMaterials(actor, workOrder.id, `pilot:reservation:${orderId}`);
  await transferWorkOrderMaterials(actor, workOrder.id, `pilot:transfer:${orderId}`);
  const run = await completeProductionRun(actor, {
    workOrderId: workOrder.id,
    producedQty: 1,
    idempotencyKey: `pilot:completion:${orderId}`,
    actualMaterials: [{ itemId: masters.items['PROF-AL-4040'], quantity: 4 }],
    scrap: {
      sourceItemId: masters.items['PROF-AL-4040'],
      scrapItemId: masters.items['SCRAP-AL'],
      lengthM: 0.05,
    },
  });
  return { masters, workOrderId: workOrder.id, rollbackAtomicityVerified, productionRun: run };
}
