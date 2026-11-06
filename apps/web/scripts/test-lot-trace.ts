/** Acceptance fixtures run only in the throwaway local test database. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { localTestDatabaseURL } from './local-test-database';

async function main() {
  process.env.DATABASE_URL = localTestDatabaseURL();
  process.env.AUTH_SECRET = randomUUID();
  process.env.NATIVE_INVENTORY_ENABLED = '1';
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  const t = randomUUID(), other = randomUUID(), userId = randomUUID();
  try {
    assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
    const { productionCommand } = await import('../lib/features/manufacturing/platform.service');
    const { traceLots } = await import('../lib/features/manufacturing/lot-trace.server');
    const { GET } = await import('../app/api/v1/traceability/lots/route');
    await db`INSERT INTO tenants(id,name,slug) VALUES (${t},'Lot trace fixture',${t}),(${other},'Isolation fixture',${other})`;
    await db`INSERT INTO users(id,email,name) VALUES (${userId},${userId+'@test.local'},'Lot trace fixture')`;
    await db`INSERT INTO tenant_members(tenant_id,user_id,role) VALUES (${t},${userId},'owner')`;
    const actor = { tenantId: t, userId, role: 'owner' as const };
    const cmd = (action: string, data: Record<string, unknown>, commandId = randomUUID()) => productionCommand(actor, { action, data, commandId });
    const profile = await cmd('material.save', { sku:'TRACE',name:'Profil',itemType:'raw_material',uom:'m',standardLengthMm:6000,weightPerMeterKg:1 });
    const wh: Record<string, any> = {};
    for (const type of ['RAW','WIP','REUSABLE_REMNANTS']) wh[type] = await cmd('warehouse.save', { code:type,name:type,type });
    await cmd('stock.receive', { itemId:profile.id,warehouseId:wh.RAW.id,quantity:1,lengthMm:6000,color:'Boyasız',unitCost:1,lotNumber:'NULL' });
    const before = await db`SELECT * FROM stock_lots WHERE tenant_id=${t}`;
    assert.equal(before[0].heat_number,null);
    assert.equal(before[0].supplier_lot_number,null);
    const migration = readFileSync('lib/db/migrations/085_lot_heat_trace.sql','utf8');
    await db.unsafe(migration); await db.unsafe(migration);
    assert.deepEqual(await db`SELECT * FROM stock_lots WHERE tenant_id=${t}`,before,'repeated migration leaves existing rows unchanged');
    await cmd('stock.receive', { itemId:profile.id,warehouseId:wh.RAW.id,quantity:1,lengthMm:6000,color:'Boyasız',unitCost:1,lotNumber:'MANUAL',heatNumber:' Manual-Heat ',supplierLotNumber:'  ' });
    const [manual] = await db`SELECT heat_number,supplier_lot_number FROM stock_lots WHERE tenant_id=${t} AND lot_number='MANUAL-1'`;
    assert.equal(manual.heat_number,'Manual-Heat'); assert.equal(manual.supplier_lot_number,null);
    const supplier = await cmd('procurement.supplier.save', { name:'Fixture supplier' });
    let purchase = await cmd('procurement.purchase.create', { supplierId:supplier.id,lines:[{ itemId:profile.id,warehouseId:wh.RAW.id,quantity:1,lengthMm:6000,color:'Boyasız',unitPrice:1 }] });
    purchase = await cmd('procurement.purchase.transition',{ id:purchase.id,version:purchase.version,status:'submitted' });
    const [line] = await db`SELECT id FROM purchase_order_lines WHERE tenant_id=${t} AND purchase_order_id=${purchase.id}`;
    await cmd('procurement.receipt.create', { purchaseOrderId:purchase.id,version:purchase.version,lines:[{ lineId:line.id,acceptedQty:6,heatNumber:' HEAT-Ab ',supplierLotNumber:' SUP-1 ' }] });
    const [source] = await db`SELECT * FROM stock_lots WHERE tenant_id=${t} AND heat_number='HEAT-Ab'`;
    assert.equal(source.supplier_lot_number,'SUP-1');
    const [order] = await db`INSERT INTO orders(tenant_id,order_number,customer_name,total_amount) VALUES (${t},'TRACE-ORDER','Fixture customer',0) RETURNING id`;
    const [job] = await db`INSERT INTO work_orders(tenant_id,title,order_id,source_warehouse_id,wip_warehouse_id,bom_snapshot) VALUES (${t},'Trace job',${order.id},${wh.RAW.id},${wh.WIP.id},'{"cuts":[]}') RETURNING id`;
    // An approved plan is the fixture input; cut.complete performs real consumption and remnant creation.
    const result = { bars:[{ source:{id:source.id,itemId:profile.id,lengthMm:6000,unitCost:1},pieces:[{workOrderId:job.id,lengthMm:2000}],remainingMm:3997,lossMm:3,reusable:true }] };
    const [plan] = await db`INSERT INTO cutting_plans(tenant_id,status,work_order_ids,demand,parameters,result,created_by,idempotency_key) VALUES (${t},'approved',${[job.id]},'[]','{"minimumRemnantMm":500}',${JSON.stringify(result)}::text::jsonb,${userId},${randomUUID()}) RETURNING id,version`;
    await db`UPDATE stock_lots SET status='reserved' WHERE tenant_id=${t} AND id=${source.id}`;
    await db`INSERT INTO cutting_plan_sources(tenant_id,plan_id,lot_id) VALUES (${t},${plan.id},${source.id})`;
    const cutId = randomUUID();
    const cutData = { id:plan.id,version:plan.version,confirmed:true };
    await cmd('cut.complete',cutData,cutId);
    await cmd('cut.complete',cutData,cutId); // replay does not duplicate allocations
    const { qualityContext } = await import('../lib/features/manufacturing/traceability.service');
    const [savedJob] = await db`SELECT * FROM work_orders WHERE tenant_id=${t} AND id=${job.id}`;
    const context = await qualityContext(db,actor,savedJob,{id:randomUUID(),attempt:1});
    assert.equal(context.materialLots.filter((l: any) => l.lotId===source.id).length,1,'cut trace is not duplicated in quality evidence');
    const [remnant] = await db`SELECT * FROM stock_lots WHERE tenant_id=${t} AND metadata->>'parentLotId'=${source.id}`;
    assert.equal(remnant.heat_number,'HEAT-Ab'); assert.equal(remnant.supplier_lot_number,'SUP-1');
    const token = jwt.sign({sub:userId,tenantId:t,role:'owner'},process.env.AUTH_SECRET!,{expiresIn:'5m'});
    const get = (query: string) => GET(new NextRequest('http://localhost/api/v1/traceability/lots'+query,{headers:{authorization:'Bearer '+token}}));
    const response = await get('?heat=HEAT-Ab');
    assert.equal(response.status,200); assert.equal(response.headers.get('cache-control'),'private, no-store');
    const body = (await response.json()).data;
    assert.equal(body.lots.length,2);
    const tracedSource = body.lots.find((l: any) => l.id===source.id);
    assert.equal(tracedSource.workOrders.length,1);
    assert.equal(tracedSource.workOrders[0].order.order_number,'TRACE-ORDER');
    assert.equal(tracedSource.workOrders[0].order.customer_name,'Fixture customer');
    assert.equal(tracedSource.uom,'m');
    assert.equal((await traceLots(actor,{supplierLot:'SUP-1'})).lots.length,2);
    assert.equal((await traceLots(actor,{heat:'HEAT'})).lots.length,0,'exact match only');
    // A descendant with no identifier is still found through its parent chain.
    await db`UPDATE stock_lots SET heat_number=NULL,supplier_lot_number=NULL WHERE tenant_id=${t} AND id=${remnant.id}`;
    assert.equal((await traceLots(actor,{heat:'HEAT-Ab'})).lots.length,2);
    await db`INSERT INTO stock_lots(tenant_id,item_id,warehouse_id,lot_number,original_qty,remaining_qty,heat_number) VALUES (${other},${profile.id},${wh.RAW.id},'FOREIGN',1,1,'FOREIGN-HEAT')`;
    const foreign = await get('?heat=FOREIGN-HEAT');
    assert.equal(foreign.status,200); assert.deepEqual((await foreign.json()).data.lots,[]);
    assert.equal((await get('')).status,400);
    assert.equal((await get('?heat='+ 'x'.repeat(65))).status,400);
    await db`UPDATE tenant_members SET role='worker' WHERE tenant_id=${t} AND user_id=${userId}`;
    assert.equal((await get('?heat=HEAT-Ab')).status,404,'fresh membership overrides stale owner token');
    await assert.rejects(() => traceLots(actor,{heat:'HEAT-Ab'}),{status:404});
    console.log('PASS lot-trace: migration twice preserves rows; receipt → real cut → inherited remnant → work order → order; exact heat/supplier match; tenant isolation; worker 404; omitted values NULL; missing query 400; no-store; replay safe.');
  } finally {
    try {
      // Only this local test connection: immutable ledger fixtures require trigger-free deletion.
      await db.begin(async tx => {
        await tx`SET LOCAL session_replication_role = replica`;
        const tables = await tx`SELECT c.table_name FROM information_schema.columns c
          JOIN information_schema.tables b ON b.table_schema=c.table_schema AND b.table_name=c.table_name
          WHERE c.table_schema='public' AND c.column_name='tenant_id' AND b.table_type='BASE TABLE'`;
        for (const { table_name: table } of tables)
          await tx`DELETE FROM ${tx(table)} WHERE tenant_id IN (${t},${other})`;
        await tx`DELETE FROM tenants WHERE id IN (${t},${other})`;
        await tx`DELETE FROM users WHERE id=${userId}`;
      });
    } finally {
      await db.end();
      const { getSql } = await import('../lib/db'); await getSql().end();
    }
  }
}
main().catch(error => { console.error(error); process.exitCode=1; });
