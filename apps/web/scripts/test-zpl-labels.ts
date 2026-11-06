/** Real SQL regression tests. Synthetic fixtures, exclusively local renkflow_test.
 * Run after db:local, or: npm run test:integration -- zpl-labels
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { localTestDatabaseURL } from './local-test-database';

async function main() {
  // Override inherited URLs BEFORE importing any application service.
  process.env.DATABASE_URL = localTestDatabaseURL();
  process.env.AUTH_SECRET = 'zpl-local-integration-only-not-a-deployed-secret';
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  const tenants: string[] = [], users: string[] = [];
  try {
    assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
    const { downloadLabels } = await import('../lib/features/labels/service');
    const { WorkOrderApiError } = await import('../lib/features/work-orders/security');
    const { escapeZpl } = await import('../lib/features/labels/zpl');
    async function fixture(name: string) {
      const [tenant] = await db`INSERT INTO tenants(name,slug) VALUES(${'Synthetic ZPL ' + name},${'zpl-test-' + randomUUID()}) RETURNING id`;
      tenants.push(tenant.id);
      const [user] = await db`INSERT INTO users(name,email) VALUES('Synthetic ZPL owner',${randomUUID() + '@example.invalid'}) RETURNING id`;
      users.push(user.id);
      await db`INSERT INTO tenant_members(tenant_id,user_id,role) VALUES(${tenant.id},${user.id},'owner')`;
      const actor = { tenantId: tenant.id, userId: user.id, role: 'owner' as const };
      const [order] = await db`INSERT INTO orders(tenant_id,order_number,customer_name,total_amount) VALUES(${tenant.id},${'TEST-' + name},'Sentetik Çığ İmalat Türkçe Profil Sanayi ve Ticaret Anonim Şirketi',0) RETURNING id`;
      const [job] = await db`INSERT INTO work_orders(tenant_id,title,order_id,production_uom) VALUES(${tenant.id},${'Sentetik iş ' + name},${order.id},'adet') RETURNING id`;
      const [item] = await db`INSERT INTO inventory_items(tenant_id,sku,name,profile_code,stock_uom) VALUES(${tenant.id},'TEST-P','Sentetik profil','P108','m') RETURNING id`;
      const [warehouse] = await db`INSERT INTO warehouses(tenant_id,code,name,warehouse_type) VALUES(${tenant.id},'TEST','Sentetik depo','RAW') RETURNING id`;
      const [location] = await db`INSERT INTO warehouse_locations(tenant_id,warehouse_id,code,name) VALUES(${tenant.id},${warehouse.id},'TEST-A1','Sentetik raf') RETURNING id`;
      const [lot] = await db`INSERT INTO stock_lots(tenant_id,item_id,warehouse_id,lot_number,original_qty,remaining_qty) VALUES(${tenant.id},${item.id},${warehouse.id},'TEST-LOT',6,6) RETURNING id`;
      const result = { algorithm: 'synthetic-test', wastePercent: 0, reusableMm: 0, unfulfilled: [], bars: [{ source: { id: lot.id, itemId: item.id, lengthMm: 6000, color: 'Boyasız' }, pieces: [{ lengthMm: 1200, workOrderId: job.id }], remainingMm: 4800, reusable: true, lossMm: 0 }] };
      const [cut] = await db`INSERT INTO cutting_plans(tenant_id,status,work_order_ids,demand,parameters,result,created_by,idempotency_key) VALUES(${tenant.id},'approved',${[job.id]},'[]','{}',${db.json(result)},${user.id},${randomUUID()}) RETURNING id`;
      await db`UPDATE work_orders SET cut_plan_id=${cut.id} WHERE tenant_id=${tenant.id} AND id=${job.id}`;
      const [entry] = await db`INSERT INTO stock_entries(tenant_id,entry_number,entry_type,idempotency_key,reference_type) VALUES(${tenant.id},'TEST-SE','MATERIAL_RECEIPT',${randomUUID()},'zpl_test') RETURNING id`;
      const ship = async (orderId: string, jobId: string) => (await db`INSERT INTO production_shipments(tenant_id,order_id,work_order_id,quantity,stock_entry_id,created_by) VALUES(${tenant.id},${orderId},${jobId},1,${entry.id},${user.id}) RETURNING id`)[0].id as string;
      return { actor, order: order.id as string, job: job.id as string, cut: cut.id as string, location: location.id as string, shipment: await ship(order.id, job.id), ship };
    }
    const a = await fixture('A'), b = await fixture('B');
    let checked = 0;
    const denied = async (actor: typeof a.actor, kind: 'shipment' | 'job' | 'cut' | 'location', id: string) => {
      await assert.rejects(() => downloadLabels(actor, kind, id), (error: unknown) => error instanceof WorkOrderApiError && error.status === 404, `${kind} must return 404`);
      checked++;
    };
    for (const [own, foreign] of [[a, b], [b, a]]) {
      for (const kind of ['shipment', 'job', 'cut', 'location'] as const) {
        // Positive controls prove that 404s are isolation checks, not missing fixtures/schema.
        assert.match(await downloadLabels(own.actor, kind, own[kind]), /^\^XA/);
        await denied(own.actor, kind, foreign[kind]);
      }
    }
    for (const [own, foreign] of [[a, b], [b, a]]) {
      const foreignOrder = await own.ship(foreign.order, own.job);
      const foreignJob = await own.ship(own.order, foreign.job);
      // FK-valid corrupt relations expose data if either JOIN tenant predicate is removed.
      for (const id of [foreignOrder, foreignJob]) {
        const rows = await db`SELECT s.id FROM production_shipments s JOIN orders o ON o.id=s.order_id JOIN work_orders w ON w.id=s.work_order_id WHERE s.tenant_id=${own.actor.tenantId} AND s.id=${id}`;
        assert.equal(rows.length, 1, 'unscoped control must resolve the adversarial relation');
        await denied(own.actor, 'shipment', id);
      }
    }
    await db`UPDATE work_orders SET production_uom=NULL WHERE tenant_id=${a.actor.tenantId} AND id=${a.job}`;
    await assert.rejects(() => downloadLabels(a.actor, 'shipment', a.shipment), (error: unknown) => error instanceof WorkOrderApiError && error.status === 422 && error.message.includes('production_uom'));
    await db`UPDATE work_orders SET production_uom='adet',title=${'Sentetik Türkçe iş başlığı '.repeat(5)} WHERE tenant_id=${a.actor.tenantId} AND id=${a.job}`;
    const label = await downloadLabels(a.actor, 'shipment', a.shipment);
    assert.ok(label.includes(escapeZpl('…')) && label.includes(escapeZpl(' · 1 adet')));
    console.log(`PASS ZPL local real-DB: ${checked} cross-tenant/corrupt-join 404 checks, 8 own-tenant controls, missing-unit 422, long-text download`);
  } finally {
    // Delete only this invocation's synthetic records, in FK order.
    if (tenants.length) await db.begin(async tx => {
      await tx`DELETE FROM production_shipments WHERE tenant_id=ANY(${tenants}::uuid[])`;
      await tx`UPDATE work_orders SET cut_plan_id=NULL WHERE tenant_id=ANY(${tenants}::uuid[])`;
      await tx`DELETE FROM cutting_plans WHERE tenant_id=ANY(${tenants}::uuid[])`;
      await tx`DELETE FROM work_orders WHERE tenant_id=ANY(${tenants}::uuid[])`;
      await tx`DELETE FROM stock_entries WHERE tenant_id=ANY(${tenants}::uuid[])`;
      await tx`DELETE FROM stock_lots WHERE tenant_id=ANY(${tenants}::uuid[])`;
      await tx`DELETE FROM inventory_items WHERE tenant_id=ANY(${tenants}::uuid[])`;
      await tx`DELETE FROM warehouse_locations WHERE tenant_id=ANY(${tenants}::uuid[])`;
      await tx`DELETE FROM warehouses WHERE tenant_id=ANY(${tenants}::uuid[])`;
      await tx`DELETE FROM orders WHERE tenant_id=ANY(${tenants}::uuid[])`;
      await tx`DELETE FROM tenant_members WHERE tenant_id=ANY(${tenants}::uuid[])`;
      await tx`DELETE FROM tenants WHERE id=ANY(${tenants}::uuid[])`;
      if (users.length) await tx`DELETE FROM users WHERE id=ANY(${users}::uuid[])`;
    });
    await db.end();
  }
}
main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
