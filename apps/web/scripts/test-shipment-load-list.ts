/** Explicitly synthetic fixtures. Only local renkflow_test; no environment URL is accepted. */
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { localTestDatabaseURL } from './local-test-database';

const db = postgres(localTestDatabaseURL(), { max: 1 });
async function main() {
  process.env.AUTH_SECRET ||= 'synthetic-local-shipment-test-only';
  const { readShipmentLoadList } = await import('../lib/features/shipments/load-list');
  await db.begin(async tx => {
    // Temporary tables shadow real tables, so this test never writes application records.
    await tx.unsafe(`
      CREATE TEMP TABLE shipments(id text, tenant_id text, shipment_number text, customer_name text, carrier text, tracking_number text, status text) ON COMMIT DROP;
      CREATE TEMP TABLE shipment_items(id text, tenant_id text, shipment_id text, order_id text, order_item_id text, product_name text, quantity numeric, created_at int) ON COMMIT DROP;
      CREATE TEMP TABLE orders(id text, tenant_id text, order_number text) ON COMMIT DROP;
      CREATE TEMP TABLE order_items(id text, order_id text, quantity_unit text) ON COMMIT DROP;
      CREATE TEMP TABLE production_shipments(erp_shipment_id text, tenant_id text, order_id text, work_order_id text) ON COMMIT DROP;
      CREATE TEMP TABLE work_orders(id text, tenant_id text, order_id text, order_item_id text, production_uom text) ON COMMIT DROP;
      INSERT INTO shipments VALUES ('s-a','a','S-A','Synthetic A','','','in_transit'),('s-b','b','S-B','Synthetic B','','','in_transit');
      INSERT INTO orders VALUES ('o-a','a','O-A'),('o-b','b','O-B');
      INSERT INTO order_items VALUES ('i-a','o-a','m'),('i-b','o-b','kg');
      INSERT INTO shipment_items VALUES ('line-a','a','s-a','o-a','i-a','Sentetik profil',2.5,1),('line-b','b','s-b','o-b','i-b','Sentetik B',7,1),('poison','b','s-a','o-b','i-b','Foreign line',9,1),('broken-link','a','s-a','o-b','i-b','Synthetic bad order link',1,2);
      INSERT INTO production_shipments VALUES ('s-a','a','o-a','w-a'),('s-a','b','o-a','w-b');
      INSERT INTO work_orders VALUES ('w-a','a','o-a','i-a','adet'),('w-b','b','o-a','i-a','kg');
    `);
    const actor = { tenantId: 'a', userId: 'synthetic', role: 'owner' as const };
    const result = await readShipmentLoadList(tx, actor, 's-a');
    assert.equal(result.items.length, 2);
    assert.equal(result.items[0].uom, 'adet');
    assert.equal(result.items[0].quantity, '2.5');
    assert.equal(result.items[1].order_number, null);
    assert.equal(result.items[1].uom, null);
    await assert.rejects(readShipmentLoadList(tx, actor, 's-b'), { status: 404 });
    await assert.rejects(readShipmentLoadList(tx, { ...actor, tenantId: 'b' }, 's-a'), { status: 404 });
    const other = await readShipmentLoadList(tx, { ...actor, tenantId: 'b' }, 's-b');
    assert.equal(other.items[0].uom, 'kg');
  });
  console.log('PASS · load-list quantities, tenant-scoped joins and two-tenant access denial');
}
main().finally(() => db.end());
