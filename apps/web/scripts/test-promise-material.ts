/** Synthetic acceptance fixtures, exclusively in the runner's throwaway local test DB. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { localTestDatabaseURL } from './local-test-database';
import type { RecipeDefinition } from '../lib/features/manufacturing/recipe-engine';

async function main() {
  process.env.DATABASE_URL = localTestDatabaseURL();
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  try {
    assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
    const { promiseMaterialReadyDate } = await import('../lib/features/manufacturing/promise-material.server');
    const tenantId = randomUUID(), otherTenant = randomUUID(), warehouseId = randomUUID();
    await db`INSERT INTO tenants(id,name,slug) VALUES (${tenantId},'Material readiness fixture',${tenantId}),(${otherTenant},'Isolation fixture',${otherTenant})`;
    await db`INSERT INTO warehouses(id,tenant_id,code,name,warehouse_type) VALUES (${warehouseId},${tenantId},'RAW','Fixture','RAW')`;
    const item = async (uom: string, lead: number | null) => {
      const id = randomUUID();
      await db`INSERT INTO inventory_items(id,tenant_id,sku,name,unit,stock_uom,lead_time_days,piece_length_mm) VALUES (${id},${tenantId},${id},'Fixture',${uom},${uom},${lead},2100)`;
      return id;
    };
    const profile = await item('adet', 5), kg = await item('kg', 12), count = await item('adet', null);
    const recipe: RecipeDefinition = {
      code:'FIXTURE',name:'Readiness fixture',version:1,finishedItemId:randomUUID(),
      rules:[{itemId:profile,kind:'profile',uom:'m',quantityFormula:'2',cutLengthFormula:'2000'},
        {itemId:kg,kind:'material',uom:'kg',quantityFormula:'3'}, {itemId:count,kind:'material',uom:'adet',quantityFormula:'4'}],
      operations:[{name:'Fixture',workCenterCode:'TEST',minutesFormula:'1',qualityChecks:[]}],
      limits:{minWidthMm:1,maxWidthMm:10000,minProjectionMm:1,maxProjectionMm:10000,minMountingHeightMm:1,maxMountingHeightMm:10000},examples:[],
    };
    const actor = { tenantId,userId:randomUUID(),role:'owner' as const };
    const input = { recipe,parameters:{widthMm:1000,projectionMm:1000,mountingHeightMm:1000,quantity:1,motor:false,led:false},color:'7016 MAT',today:'2026-12-29' };
    const addLot = async (itemId: string, qty: number, color = 'RAL 7016 Mat', status = 'available', t = tenantId, w = warehouseId) => {
      const id = randomUUID();
      await db`INSERT INTO stock_lots(id,tenant_id,item_id,warehouse_id,lot_number,original_qty,remaining_qty,status,metadata) VALUES (${id},${t},${itemId},${w},${id},${qty},${qty},${status},${JSON.stringify({color})}::text::jsonb)`;
      return id;
    };
    await addLot(profile,2); // two physical 2.1 m profiles, not one 4.2 m profile
    await addLot(kg,1);
    await addLot(count,100,'RAL 9005 Mat');
    let result = await promiseMaterialReadyDate(actor,input);
    assert.equal(result.readyDate,null);
    assert.equal(result.fulfilled[0]?.uom,'m',JSON.stringify(result));
    assert.equal(result.missing[0].shortage,2);
    assert.equal(result.undefinedLeadTime[0].uom,'adet');
    await addLot(count,4);
    result = await promiseMaterialReadyDate(actor,input);
    assert.equal(result.readyDate,'2027-01-10');
    await addLot(kg,2);
    assert.equal((await promiseMaterialReadyDate(actor,input)).readyDate,input.today);

    const [job] = await db`INSERT INTO work_orders(tenant_id,title) VALUES (${tenantId},'Readiness fixture') RETURNING id`;
    const [reservation] = await db`INSERT INTO stock_reservations(tenant_id,work_order_id,status,idempotency_key) VALUES (${tenantId},${job.id},'active',${randomUUID()}) RETURNING id`;
    await db`INSERT INTO stock_reservation_lines(tenant_id,reservation_id,item_id,warehouse_id,reserved_qty) VALUES (${tenantId},${reservation.id},${profile},${warehouseId},1)`;
    result = await promiseMaterialReadyDate(actor,input);
    assert.equal(result.missing.find(l => l.itemId===profile)?.shortage,4);
    await db`UPDATE stock_reservations SET status='released' WHERE id=${reservation.id}`;
    const [profileLot] = await db`SELECT id FROM stock_lots WHERE tenant_id=${tenantId} AND item_id=${profile}`;
    await db`UPDATE stock_reservations SET status='active' WHERE id=${reservation.id}`;
    await db`UPDATE stock_reservation_lines SET lot_id=${profileLot.id} WHERE reservation_id=${reservation.id}`;
    assert.equal((await promiseMaterialReadyDate(actor,input)).missing.find(l => l.itemId===profile)?.shortage,4);
    await db`UPDATE stock_reservations SET status='released' WHERE id=${reservation.id}`;
    await db`UPDATE stock_lots SET status='reserved' WHERE id=${profileLot.id}`;
    assert.equal((await promiseMaterialReadyDate(actor,input)).missing.find(l => l.itemId===profile)?.shortage,4);
    await db`UPDATE stock_lots SET status='available' WHERE id=${profileLot.id}`;
    assert.equal((await promiseMaterialReadyDate(actor,input)).readyDate,input.today);
    await db`UPDATE warehouses SET warehouse_type='REUSABLE_REMNANTS' WHERE id=${warehouseId}`;
    assert.equal((await promiseMaterialReadyDate(actor,input)).readyDate,input.today);
    await db`UPDATE warehouses SET active=false WHERE id=${warehouseId}`;
    assert.equal((await promiseMaterialReadyDate(actor,input)).fulfilled.length,0);
    await db`UPDATE warehouses SET active=true WHERE id=${warehouseId}`;
    const other = await promiseMaterialReadyDate({...actor,tenantId:otherTenant},input);
    assert.equal(other.fulfilled.length,0);
    assert.equal(other.undefinedLeadTime.length,3);
    await assert.rejects(() => promiseMaterialReadyDate({...actor,role:'worker'},input));
    console.log('ok: profile lengths, colours, units, lead times, reservations, tenant isolation and advisory reads');
  } finally {
    await db.end();
    const { getSql } = await import('../lib/db');
    await getSql().end();
  }
}
main().catch(error => { console.error(error); process.exitCode=1; });
