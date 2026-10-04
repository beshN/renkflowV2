import 'server-only';

import { withTransaction } from '@/lib/db/transaction';
import { ManufacturingActor } from './types';
import { assertNativeInventoryEnabled } from './mode';

async function loadReservation(tx: any, tenantId: string, reservationId: string) {
  const rows = await tx`
    SELECT * FROM stock_reservations
    WHERE tenant_id = ${tenantId} AND id = ${reservationId}
  `;
  const lines = await tx`
    SELECT * FROM stock_reservation_lines
    WHERE tenant_id = ${tenantId} AND reservation_id = ${reservationId}
    ORDER BY created_at
  `;
  return rows[0] ? { ...rows[0], lines } : null;
}

export async function reserveWorkOrderMaterials(
  actor: ManufacturingActor,
  workOrderId: string,
  idempotencyKey: string,
) {
  assertNativeInventoryEnabled();
  if (idempotencyKey.trim().length < 8) throw new Error('Geçerli bir idempotency anahtarı gerekli');

  return withTransaction(async ({ sql: tx }) => {
    const existing = await tx`
      SELECT id, work_order_id FROM stock_reservations
      WHERE tenant_id = ${actor.tenantId} AND idempotency_key = ${idempotencyKey}
    `;
    if (existing[0]) {
      if (existing[0].work_order_id !== workOrderId) {
        throw new Error('Idempotency anahtarı farklı bir rezervasyonda kullanılmış');
      }
      return loadReservation(tx, actor.tenantId, existing[0].id);
    }

    const workOrders = await tx`
      SELECT id, order_id, status, reservation_status
      FROM work_orders
      WHERE tenant_id = ${actor.tenantId} AND id = ${workOrderId}
      FOR UPDATE
    `;
    const workOrder = workOrders[0];
    if (!workOrder) throw new Error('Üretim emri bulunamadı');
    if (['done', 'cancelled'].includes(workOrder.status)) throw new Error('Kapalı üretim emri rezerve edilemez');

    const materials = await tx`
      SELECT * FROM work_order_materials
      WHERE tenant_id = ${actor.tenantId} AND work_order_id = ${workOrderId}
      ORDER BY item_id, source_warehouse_id
      FOR UPDATE
    `;
    if (materials.length === 0) throw new Error('Üretim emrinde malzeme bulunmuyor');

    for (const material of materials) {
      const needed = Number(material.required_qty) - Number(material.reserved_qty);
      if (needed <= 0) continue;

      await tx`
        INSERT INTO stock_balances (tenant_id, item_id, warehouse_id, on_hand_qty)
        VALUES (${actor.tenantId}, ${material.item_id}, ${material.source_warehouse_id}, 0)
        ON CONFLICT (tenant_id, item_id, warehouse_id) DO NOTHING
      `;
      const balances = await tx`
        SELECT on_hand_qty FROM stock_balances
        WHERE tenant_id = ${actor.tenantId}
          AND item_id = ${material.item_id}
          AND warehouse_id = ${material.source_warehouse_id}
        FOR UPDATE
      `;
      const reserved = await tx`
        SELECT COALESCE(SUM(rl.reserved_qty - rl.consumed_qty - rl.released_qty), 0) AS qty
        FROM stock_reservation_lines rl
        JOIN stock_reservations rh ON rh.id = rl.reservation_id
        WHERE rl.tenant_id = ${actor.tenantId}
          AND rl.item_id = ${material.item_id}
          AND rl.warehouse_id = ${material.source_warehouse_id}
          AND rh.status = 'active'
      `;
      const available = Number(balances[0]?.on_hand_qty || 0) - Number(reserved[0]?.qty || 0);
      if (available < needed) {
        throw new Error(`Yetersiz kullanılabilir stok: ${material.item_id} için ${needed}, mevcut ${available}`);
      }
    }

    const reservationRows = await tx`
      INSERT INTO stock_reservations (
        tenant_id, order_id, work_order_id, status, idempotency_key, created_by
      ) VALUES (
        ${actor.tenantId}, ${workOrder.order_id || null}, ${workOrderId}, 'active',
        ${idempotencyKey}, ${actor.userId}
      ) RETURNING *
    `;
    const reservation = reservationRows[0];

    for (const material of materials) {
      const needed = Number(material.required_qty) - Number(material.reserved_qty);
      if (needed <= 0) continue;
      await tx`
        INSERT INTO stock_reservation_lines (
          tenant_id, reservation_id, item_id, warehouse_id, reserved_qty
        ) VALUES (
          ${actor.tenantId}, ${reservation.id}, ${material.item_id},
          ${material.source_warehouse_id}, ${needed}
        )
      `;
      await tx`
        UPDATE work_order_materials
        SET reserved_qty = reserved_qty + ${needed}, updated_at = now()
        WHERE tenant_id = ${actor.tenantId} AND id = ${material.id}
      `;
    }

    await tx`
      UPDATE work_orders
      SET reservation_status = 'reserved', updated_at = now()
      WHERE tenant_id = ${actor.tenantId} AND id = ${workOrderId}
    `;
    await tx`
      INSERT INTO work_order_events (tenant_id, work_order_id, event_type, payload, created_by)
      VALUES (
        ${actor.tenantId}, ${workOrderId}, 'materials_reserved',
        ${JSON.stringify({ reservationId: reservation.id })}::text::jsonb, ${actor.userId}
      )
    `;
    return loadReservation(tx, actor.tenantId, reservation.id);
  }, { isolationLevel: 'SERIALIZABLE' });
}

export async function releaseWorkOrderReservation(
  actor: ManufacturingActor,
  workOrderId: string,
) {
  assertNativeInventoryEnabled();
  return withTransaction(async ({ sql: tx }) => {
    const workOrders = await tx`
      SELECT id, reservation_status FROM work_orders
      WHERE tenant_id = ${actor.tenantId} AND id = ${workOrderId}
      FOR UPDATE
    `;
    if (!workOrders[0]) throw new Error('Üretim emri bulunamadı');
    const reservations = await tx`
      SELECT id FROM stock_reservations
      WHERE tenant_id = ${actor.tenantId} AND work_order_id = ${workOrderId} AND status = 'active'
      FOR UPDATE
    `;
    for (const reservation of reservations) {
      await tx`
        UPDATE stock_reservation_lines
        SET released_qty = reserved_qty - consumed_qty
        WHERE tenant_id = ${actor.tenantId} AND reservation_id = ${reservation.id}
      `;
      await tx`
        UPDATE stock_reservations SET status = 'released', updated_at = now()
        WHERE tenant_id = ${actor.tenantId} AND id = ${reservation.id}
      `;
    }
    await tx`
      UPDATE work_order_materials
      SET reserved_qty = consumed_qty, updated_at = now()
      WHERE tenant_id = ${actor.tenantId} AND work_order_id = ${workOrderId}
    `;
    await tx`
      UPDATE work_orders SET reservation_status = 'released', updated_at = now()
      WHERE tenant_id = ${actor.tenantId} AND id = ${workOrderId}
    `;
    return { released: true, workOrderId };
  }, { isolationLevel: 'SERIALIZABLE' });
}
