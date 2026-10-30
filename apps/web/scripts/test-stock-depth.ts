/** Integration test for stock and purchasing depth (Tur D), on the isolated local test database only. */
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { localTestDatabaseURL } from './local-test-database';

async function main() {
  process.env.AUTH_SECRET = 'integration-test-secret-local-only-1234567890';
  process.env.DATABASE_URL = localTestDatabaseURL();
  process.env.NATIVE_INVENTORY_ENABLED = '1';
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
  for (const file of ['029_ai_suggestions.sql', '031_stock_model.sql', '036_product_configuration.sql', '037_production_lead.sql', '038_notification_json.sql', '043_stock_purchasing_depth.sql', '043_stock_purchasing_depth.sql'])
    await db.unsafe(readFileSync(`lib/db/migrations/${file}`, 'utf8'));

  const s = await import('../lib/features/stock/depth.server');
  const { sql } = await import('../lib/db');

  const tenantId = randomUUID(), ownerId = randomUUID(), officeId = randomUUID(), workerId = randomUUID(), accountantId = randomUUID();
  await db`INSERT INTO tenants (id, name, slug) VALUES (${tenantId}, 'Stok Test', ${'stock-' + tenantId.slice(0, 8)})`;
  for (const [id, role] of [[ownerId, 'owner'], [officeId, 'office'], [workerId, 'worker'], [accountantId, 'accountant']]) {
    await db`INSERT INTO users (id, email, name) VALUES (${id}, ${`${role}-${id}@test.local`}, ${role})`;
    await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${tenantId}, ${id}, ${role})`;
  }
  const office = { tenantId, userId: officeId, role: 'office' as const };
  const worker = { tenantId, userId: workerId, role: 'worker' as const };
  const accountant = { tenantId, userId: accountantId, role: 'accountant' as const };
  const rawId = randomUUID(), supA = randomUUID(), supB = randomUUID();
  await db`INSERT INTO warehouses (id, tenant_id, code, name, warehouse_type) VALUES (${rawId}, ${tenantId}, 'HAM', 'Hammadde', 'RAW')`;
  await db`INSERT INTO suppliers (id, tenant_id, name, is_active) VALUES (${supA}, ${tenantId}, 'Alfa Alüminyum', true), (${supB}, ${tenantId}, 'Beta Metal', true)`;
  const [screw] = await db`INSERT INTO inventory_items (tenant_id, sku, name, unit, item_type, stock_uom, min_stock) VALUES (${tenantId}, 'VD-1', 'Vida', 'adet', 'raw_material', 'adet', 100) RETURNING id`;
  const [profile] = await db`INSERT INTO inventory_items (tenant_id, sku, name, unit, item_type, stock_uom, min_stock) VALUES (${tenantId}, 'PR-1', 'Profil 108', 'm', 'raw_material', 'm', 0) RETURNING id`;
  await db`INSERT INTO stock_balances (tenant_id, item_id, warehouse_id, on_hand_qty) VALUES (${tenantId}, ${screw.id}, ${rawId}, 120), (${tenantId}, ${profile.id}, ${rawId}, 30)`;

  // Reorder policy: stock keepers set it; the overview shows the reorder point and the level.
  await assert.rejects(s.saveReorderPolicy(worker as any, screw.id, { minStock: 100, maxStock: 300, leadTimeDays: 10, orderMultiple: 50 }), (e: any) => e.status === 403);
  await assert.rejects(s.saveReorderPolicy(office as any, screw.id, { minStock: 100, maxStock: 50, leadTimeDays: 10, orderMultiple: 50 }), /Azami/);
  await assert.rejects(s.saveReorderPolicy(office as any, screw.id, { minStock: 100, maxStock: 300, leadTimeDays: 10, orderMultiple: 2.5 }), /tam sayı/, 'packs of counted items are whole');
  let overview: any = await s.saveReorderPolicy(office as any, screw.id, { minStock: 100, maxStock: 300, leadTimeDays: 10, orderMultiple: 50 });
  let row = overview.rows.find((r: any) => r.itemId === screw.id);
  assert.deepEqual([row.levels.reorderPoint, row.levels.target, row.state], [100, 300, 'ok'], 'no use yet: the minimum is the reorder point');
  const [audit] = await db`SELECT changes FROM activity_logs WHERE entity_id = ${screw.id} AND action = 'reorder_policy_set'`;
  assert.deepEqual(audit.changes['azami'], { from: null, to: 300 });
  await assert.rejects(s.reorderOverview(worker as any), (e: any) => e.status === 403);
  // 30 days of use at 3 a day (90 issued): the reorder point rises above what is on hand.
  // (A receipt first: the shelf balance trigger wants what is issued to have arrived.)
  const [inbound] = await db`INSERT INTO stock_entries (tenant_id, entry_number, entry_type, status, reference_type, idempotency_key, submitted_at) VALUES (${tenantId}, 'SE-0', 'MATERIAL_RECEIPT', 'submitted', 'manual', ${randomUUID()}, now() - interval '6 days') RETURNING id`;
  await db`INSERT INTO stock_entry_lines (tenant_id, stock_entry_id, item_id, warehouse_id, quantity_delta, uom) VALUES (${tenantId}, ${inbound.id}, ${screw.id}, ${rawId}, 270, 'adet')`;
  const [entry] = await db`INSERT INTO stock_entries (tenant_id, entry_number, entry_type, status, reference_type, idempotency_key, submitted_at) VALUES (${tenantId}, 'SE-1', 'MATERIAL_ISSUE', 'submitted', 'manual', ${randomUUID()}, now() - interval '5 days') RETURNING id`;
  await db`INSERT INTO stock_entry_lines (tenant_id, stock_entry_id, item_id, warehouse_id, quantity_delta, uom) VALUES (${tenantId}, ${entry.id}, ${screw.id}, ${rawId}, -270, 'adet')`;
  overview = await s.reorderOverview(accountant as any);
  row = overview.rows.find((r: any) => r.itemId === screw.id);
  assert.deepEqual([row.policy.dailyUsage, row.levels.reorderPoint, row.state], [3, 130, 'unknown'], 'below the reorder point; never bought, so nothing is guessed');

  // Request for quotation: two suppliers, answers compared, the chosen one becomes a draft purchase order.
  await assert.rejects(s.createRfq(accountant as any, { supplierIds: [supA], lines: [{ itemId: screw.id, warehouseId: rawId, quantity: 200 }] }), (e: any) => e.status === 403);
  await assert.rejects(s.createRfq(office as any, { supplierIds: [supA], lines: [{ itemId: profile.id, warehouseId: rawId, quantity: 10 }] }), /profil boyu ve renk/);
  await assert.rejects(s.createRfq(office as any, { supplierIds: [supA], lines: [{ itemId: profile.id, warehouseId: rawId, quantity: 2.5, lengthMm: 6500, color: 'RAL 7016 Mat' }] }), /tam sayı/, 'the same rules as a purchase order');
  let rfqs: any = await s.createRfq(office as any, { supplierIds: [supA, supB], dueOn: '2026-10-20', lines: [{ itemId: screw.id, warehouseId: rawId, quantity: 200 }, { itemId: profile.id, warehouseId: rawId, quantity: 10, lengthMm: 6500, color: 'RAL 7016 Mat' }] });
  let rfq = rfqs.rfqs.find((r: any) => r.id === rfqs.id);
  const [l1, l2] = rfq.lines;
  await assert.rejects(s.recordRfqResponse(office as any, rfq.id, { supplierId: randomUUID(), prices: [{ lineId: l1.id, unitPrice: 1 }] }), /istenmedi/);
  await s.recordRfqResponse(office as any, rfq.id, { supplierId: supA, leadTimeDays: 7, validUntil: '2099-01-01', prices: [{ lineId: l1.id, unitPrice: 2 }, { lineId: l2.id, unitPrice: 900 }] });
  rfqs = await s.recordRfqResponse(office as any, rfq.id, { supplierId: supB, leadTimeDays: 3, prices: [{ lineId: l1.id, unitPrice: 1.5 }] });
  rfq = rfqs.rfqs.find((r: any) => r.id === rfq.id);
  assert.deepEqual([rfq.comparison.suggested, rfq.comparison.cheapest[l1.id].supplierId], [supA, supB], 'B is cheaper on screws but did not price the profile');
  // Profile prices are per metre, as on a purchase order: 10 bars × 6.5 m × 900 + 200 × 2.
  assert.equal(rfq.comparison.rows.find((r: any) => r.supplierId === supA).total, 10 * 6.5 * 900 + 200 * 2);
  await assert.rejects(s.awardRfq(office as any, rfq.id, { supplierId: supB, version: rfq.version }), /her satırı/);
  await assert.rejects(s.awardRfq(office as any, rfq.id, { supplierId: supA, version: rfq.version - 1 }), /değişti/);
  rfqs = await s.awardRfq(office as any, rfq.id, { supplierId: supA, version: rfq.version });
  rfq = rfqs.rfqs.find((r: any) => r.id === rfq.id);
  assert.equal(rfq.status, 'awarded');
  const [po] = await db`SELECT id, status, supplier_id, expected_at FROM purchase_orders WHERE tenant_id = ${tenantId} AND notes LIKE ${'%' + rfq.number}`;
  assert.deepEqual([po.status, po.supplier_id], ['draft', supA], 'a draft order, checked and sent as usual');
  const poLines = await db`SELECT ordered_qty, unit_price, metadata FROM purchase_order_lines WHERE purchase_order_id = ${po.id} ORDER BY position`;
  assert.deepEqual(poLines.map((l: any) => Number(l.unit_price)), [2, 900]);
  assert.equal(poLines[1].metadata.lengthMm, 6500);
  await assert.rejects(s.recordRfqResponse(office as any, rfq.id, { supplierId: supB, prices: [{ lineId: l1.id, unitPrice: 1 }] }), /kapandı/);

  // Supplier scorecard and price history from sent orders and their receipts.
  for (const [i, [expected, received, rejected]] of ([['2026-09-10', '2026-09-10', 0], ['2026-09-20', '2026-09-25', 5], ['2026-09-30', '2026-09-29', 0]] as const).entries()) {
    const [o] = await db`INSERT INTO purchase_orders (tenant_id, purchase_order_number, supplier_id, status, expected_at, currency, created_at) VALUES (${tenantId}, ${'SAT-T' + i}, ${supA}, 'received', ${expected}, 'TRY', ${expected}::date - 7) RETURNING id`;
    const [line] = await db`INSERT INTO purchase_order_lines (tenant_id, purchase_order_id, item_id, warehouse_id, ordered_qty, received_qty, uom, unit_price, position) VALUES (${tenantId}, ${o.id}, ${screw.id}, ${rawId}, 100, 100, 'adet', ${2 + i * 0.2}, 0) RETURNING id`;
    const [gr] = await db`INSERT INTO goods_receipts (tenant_id, receipt_number, purchase_order_id, status, idempotency_key, received_at) VALUES (${tenantId}, ${'MK-T' + i}, ${o.id}, 'submitted', ${randomUUID()}, ${received}) RETURNING id`;
    await db`INSERT INTO goods_receipt_lines (tenant_id, goods_receipt_id, purchase_order_line_id, item_id, accepted_warehouse_id, rejected_warehouse_id, accepted_qty, rejected_qty, uom) VALUES (${tenantId}, ${gr.id}, ${line.id}, ${screw.id}, ${rawId}, ${rawId}, ${100 - rejected}, ${rejected}, 'adet')`;
  }
  const cards: any = await s.supplierScorecards(accountant as any);
  const alfa = cards.suppliers.find((x: any) => x.supplierId === supA);
  assert.deepEqual([alfa.received, alfa.onTimePct, alfa.rejectPct, alfa.enoughData], [3, 67, 1.7, true]);
  const screwPrices = cards.prices.find((p: any) => p.itemId === screw.id && p.supplierId === supA);
  assert.deepEqual([screwPrices.series.length, screwPrices.last, screwPrices.changePct], [3, 2.4, 9.1]);
  await assert.rejects(s.supplierScorecards(worker as any), (e: any) => e.status === 403);

  // Order shortage: a configured line needs 40 m of profile; 30 m on hand of which 10 m held by another job.
  await db`INSERT INTO manufacturing_preferences (tenant_id, production_lead_user_id) VALUES (${tenantId}, ${officeId}) ON CONFLICT (tenant_id) DO UPDATE SET production_lead_user_id = ${officeId}`;
  const [order] = await db`INSERT INTO orders (tenant_id, order_number, customer_name, product_name, quantity, status, total_amount, currency) VALUES (${tenantId}, 'STK-1', 'Gizli Müşteri', 'Pergola', 2, 'approved', 50000, 'TRY') RETURNING id`;
  await db`INSERT INTO order_items (order_id, product_name, quantity, unit_price, total_price, product_configuration) VALUES (${order.id}, 'Pergola', 2, 25000, 50000, ${JSON.stringify({ bom: { materials: [{ itemId: profile.id, quantity: 20, uom: 'm' }, { itemId: screw.id, quantity: 10, uom: 'adet' }], cuts: [] } })}::text::jsonb)`;
  const [otherOrder] = await db`INSERT INTO orders (tenant_id, order_number, customer_name, product_name, quantity, status, total_amount, currency) VALUES (${tenantId}, 'STK-2', 'Başka', 'Tente', 1, 'approved', 1, 'TRY') RETURNING id`;
  const [res] = await db`INSERT INTO stock_reservations (tenant_id, order_id, status, idempotency_key) VALUES (${tenantId}, ${otherOrder.id}, 'active', ${randomUUID()}) RETURNING id`;
  await db`INSERT INTO stock_reservation_lines (tenant_id, reservation_id, item_id, warehouse_id, reserved_qty) VALUES (${tenantId}, ${res.id}, ${profile.id}, ${rawId}, 10)`;
  const status: any = await s.orderMaterialStatus(office as any, order.id);
  assert.deepEqual(status.lines.map((l: any) => [l.name, l.quantity, l.free, l.missing]), [['Profil 108', 40, 20, 20], ['Vida', 20, 120, 0]]);
  await assert.rejects(s.orderMaterialStatus(worker as any, order.id), (e: any) => e.status === 403);
  assert.equal(await s.notifyShortageOnApproval(tenantId, order.id, ownerId), 1);
  const [notice] = await db`SELECT title, message FROM notifications WHERE user_id = ${officeId} AND title LIKE 'Malzeme eksik%'`;
  assert.ok(notice && notice.message.includes('Profil 108 20 m') && !/Gizli|50000/.test(notice.title + notice.message), 'the lead hears what is missing, without customer or price');

  await db.end();
  await (sql as any).end?.();
  console.log('PASS · stock depth: reorder policy by stock keepers (max ≥ min, traced), reorder point from 90-day use × lead time, request for quotation (accounts read only, profile needs length and colour, answers only from asked suppliers, cheapest per line vs complete suggestion, stale version and incomplete answer refused, award makes a draft purchase order with the quoted prices, closed request takes no answers), supplier score (on time, rejects) and price history with change, order shortage against free stock (other jobs\' holds counted) with a price-free notice to the production lead, workers refused everywhere, migration twice is a no-op');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
