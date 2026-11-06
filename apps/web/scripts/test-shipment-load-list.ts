/** Explicitly synthetic fixtures, real schema, rolled back. Only local renkflow_test. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { localTestDatabaseURL } from './local-test-database';

const db = postgres(localTestDatabaseURL(), { max: 1 });
async function main() {
  process.env.AUTH_SECRET ||= 'synthetic-local-shipment-test-only';
  process.env.DATABASE_URL = localTestDatabaseURL();
  const { readShipmentLoadList } = await import('../lib/features/shipments/load-list');
  const { readShipmentList } = await import('../lib/features/shipments/list');
  assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
  const rollback = new Error('intentional fixture rollback');
  const tenantIds: string[] = [];
  await assert.rejects(db.begin(async tx => {
    // No temporary replacements: actual column types, constraints and FK relationships apply.
    const [user] = await tx`INSERT INTO users(name,email) VALUES('Synthetic shipment reviewer',${randomUUID()+'@example.invalid'}) RETURNING id`;
    const fixtures = [];
    for (const suffix of ['a', 'b']) {
      const [tenant] = await tx`INSERT INTO tenants(name,slug) VALUES('Synthetic shipment tenant',${'shipment-test-'+randomUUID()}) RETURNING id`;
      tenantIds.push(tenant.id);
      const [order] = await tx`INSERT INTO orders(tenant_id,order_number,customer_name,total_amount) VALUES(${tenant.id},${'SYNTHETIC-'+suffix},'Synthetic customer',0) RETURNING id`;
      const [shipment] = await tx`INSERT INTO shipments(tenant_id,shipment_number,customer_name) VALUES(${tenant.id},${'SYNTHETIC-'+suffix},'Synthetic customer') RETURNING id`;
      const [entry] = await tx`INSERT INTO stock_entries(tenant_id,entry_number,entry_type,idempotency_key,reference_type) VALUES(${tenant.id},'SYNTHETIC','MATERIAL_ISSUE',${randomUUID()},'shipment') RETURNING id`;
      const items = [];
      for (const uom of ['m', 'kg', 'adet']) {
        const [item] = await tx`INSERT INTO order_items(order_id,product_name,quantity,unit_price,total_price,quantity_unit) VALUES(${order.id},${'Synthetic '+uom},10,0,0,${uom}) RETURNING id`;
        const [line] = await tx`INSERT INTO shipment_items(tenant_id,shipment_id,order_id,order_item_id,product_name,quantity) VALUES(${tenant.id},${shipment.id},${order.id},${item.id},${'Synthetic '+uom},2.5) RETURNING id`;
        items.push({ ...item, lineId: line.id, uom });
      }
      fixtures.push({ tenant, order, shipment, entry, items });
    }
    const [a, b] = fixtures;
    const actor = { tenantId: a.tenant.id, userId: user.id, role: 'owner' as const };
    const actorB = { ...actor, tenantId: b.tenant.id };
    const before = await readShipmentLoadList(tx, actor, a.shipment.id);
    assert.equal(before.items.length, 3);
    // Two matching production shipments at the same time: tie-break by ps.id, not join fan-out.
    const earlierId = '11111111-1111-4111-8111-111111111111';
    const laterId = '22222222-2222-4222-8222-222222222222';
    for (const [id, uom] of [[laterId, 'kg'], [earlierId, 'adet']]) {
      const [job] = await tx`INSERT INTO work_orders(tenant_id,title,order_id,order_item_id,production_uom) VALUES(${a.tenant.id},'Synthetic job',${a.order.id},${a.items[0].id},${uom}) RETURNING id`;
      await tx`INSERT INTO production_shipments(id,tenant_id,order_id,work_order_id,quantity,stock_entry_id,created_by,erp_shipment_id,created_at) VALUES(${id},${a.tenant.id},${a.order.id},${job.id},1,${a.entry.id},${user.id},${a.shipment.id},'2026-01-02T00:00:00Z')`;
    }
    const after = await readShipmentLoadList(tx, actor, a.shipment.id);
    assert.equal(after.items.length, before.items.length);
    assert.equal(new Set(after.items.map((i: any) => i.id)).size, 3);
    assert.equal(after.items.find((i: any) => i.id === a.items[0].lineId).uom, 'adet');
    // Also check that created_at precedes id in the deterministic selection.
    await tx`UPDATE production_shipments SET created_at='2026-01-01T00:00:00Z' WHERE id=${laterId}`;
    assert.equal((await readShipmentLoadList(tx, actor, a.shipment.id)).items.find((i: any) => i.id===a.items[0].lineId).uom, 'kg');
    await tx`UPDATE production_shipments SET created_at='2026-01-02T00:00:00Z' WHERE id=${laterId}`;
    // Valid FKs but mismatched tenant links must never reveal the foreign order/unit/job.
    await tx`INSERT INTO shipment_items(tenant_id,shipment_id,order_id,order_item_id,product_name,quantity) VALUES(${b.tenant.id},${a.shipment.id},${b.order.id},${b.items[0].id},'Synthetic foreign line',9)`;
    const [broken] = await tx`INSERT INTO shipment_items(tenant_id,shipment_id,order_id,order_item_id,product_name,quantity) VALUES(${a.tenant.id},${a.shipment.id},${b.order.id},${b.items[0].id},'Synthetic bad order link',1) RETURNING id`;
    const [foreignJob] = await tx`INSERT INTO work_orders(tenant_id,title,order_id,order_item_id,production_uom) VALUES(${b.tenant.id},'Synthetic foreign job',${a.order.id},${a.items[0].id},'m') RETURNING id`;
    await tx`INSERT INTO production_shipments(tenant_id,order_id,work_order_id,quantity,stock_entry_id,created_by,erp_shipment_id,created_at) VALUES(${b.tenant.id},${a.order.id},${foreignJob.id},1,${b.entry.id},${user.id},${a.shipment.id},'2025-01-01T00:00:00Z')`;
    await tx`INSERT INTO production_shipments(tenant_id,order_id,work_order_id,quantity,stock_entry_id,created_by,erp_shipment_id,created_at) VALUES(${a.tenant.id},${a.order.id},${foreignJob.id},1,${a.entry.id},${user.id},${a.shipment.id},'2025-01-01T00:00:00Z')`;
    const detail = await readShipmentLoadList(tx, actor, a.shipment.id);
    assert.equal(detail.items.length, 4);
    assert.equal(detail.items.find((i: any) => i.id===a.items[0].lineId).uom, 'adet');
    const brokenLine = detail.items.find((i: any) => i.id===broken.id);
    assert.equal(brokenLine.order_number, null);
    assert.equal(brokenLine.uom, null);
    await assert.rejects(readShipmentLoadList(tx, actor, b.shipment.id), { status: 404 });
    await assert.rejects(readShipmentLoadList(tx, actorB, a.shipment.id), { status: 404 });
    // Execute the exact SELECT used by GET /api/v1/shipments against the real schema.
    for (const [who, fixture, expected] of [[actor, a, ['adet','kg','adet']], [actorB, b, ['m','kg','adet']]] as const) {
      const list = await readShipmentList(tx, who);
      assert.equal(list.length, 1);
      assert.equal(list[0].id, fixture.shipment.id);
      for (let i=0; i<fixture.items.length; i++) {
        const line = list[0].items.find((r: any) => r.product_name===`Synthetic ${fixture.items[i].uom}`);
        assert.equal(line.uom, expected[i]);
        assert.equal(line.quantity, 2.5);
      }
      assert.equal(list[0].items.some((i: any) => i.product_name==='Synthetic foreign line'), false);
      assert.equal(list[0].items.length, who===actor ? 4 : 3);
      if (who===actor) assert.equal(list[0].items.find((i: any) => i.product_name==='Synthetic bad order link').uom, null);
    }
    throw rollback;
  }), error => error === rollback);
  assert.equal((await db`SELECT id FROM tenants WHERE id=ANY(${tenantIds}::uuid[])`).length, 0);
  console.log('PASS · real-schema rollback: duplicate production shipments, deterministic units, list SQL, two-tenant denial');
}
main().finally(() => db.end());
