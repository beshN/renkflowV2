/** Synthetic acceptance fixtures, exclusively in the runner's throwaway local test DB. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { localTestDatabaseURL } from './local-test-database';
import type { RecipeDefinition } from '../lib/features/manufacturing/recipe-engine';

async function main() {
  process.env.DATABASE_URL = localTestDatabaseURL();
  process.env.AUTH_SECRET = randomUUID();
  const tenantId = randomUUID(), otherTenant = randomUUID(), warehouseId = randomUUID(), userId = randomUUID();
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  try {
    assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
    const { promiseMaterialReadyDate } = await import('../lib/features/manufacturing/promise-material.server');

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
    await db`INSERT INTO users(id,email,name) VALUES (${userId},${userId+'@test.local'},'Readiness fixture')`;
    await db`INSERT INTO tenant_members(tenant_id,user_id,role) VALUES (${tenantId},${userId},'office'),(${otherTenant},${userId},'office')`;
    const actor = { tenantId,userId,role:'office' as const };
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
    const kgLot = await addLot(kg,2);
    assert.equal((await promiseMaterialReadyDate(actor,input)).readyDate,input.today);

    const [job] = await db`INSERT INTO work_orders(tenant_id,title) VALUES (${tenantId},'Readiness fixture') RETURNING id`;
    const [reservation] = await db`INSERT INTO stock_reservations(tenant_id,work_order_id,status,idempotency_key) VALUES (${tenantId},${job.id},'active',${randomUUID()}) RETURNING id`;
    await db`INSERT INTO stock_reservation_lines(tenant_id,reservation_id,item_id,warehouse_id,reserved_qty) VALUES (${tenantId},${reservation.id},${profile},${warehouseId},1)`;
    result = await promiseMaterialReadyDate(actor,input);
    assert.equal(result.missing.find(l => l.itemId===profile)?.shortage,4);
    assert.ok(result.reservationWarnings.some(w=>w.itemId===profile));
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
    const otherWarehouse = randomUUID(), otherItem = randomUUID();
    await db`INSERT INTO warehouses(id,tenant_id,code,name,warehouse_type) VALUES (${otherWarehouse},${otherTenant},'OTHER','Other fixture','RAW')`;
    await db`INSERT INTO inventory_items(id,tenant_id,sku,name,unit,stock_uom) VALUES (${otherItem},${otherTenant},${otherItem},'Other fixture','kg','kg')`;
    await addLot(otherItem,500,'RAL 7016 Mat','available',otherTenant,otherWarehouse);
    const other = await promiseMaterialReadyDate({...actor,tenantId:otherTenant},input);
    assert.equal(other.fulfilled.length,0);
    assert.equal(other.undefinedLeadTime.length,3);
    await assert.rejects(() => promiseMaterialReadyDate({...actor,role:'worker'},input), {status:403});
    const [custom] = await db`INSERT INTO access_roles(tenant_id,name,name_key,base_role,permissions)
      VALUES (${tenantId},'No inventory fixture','no-inventory-fixture','office','{"production":["view"]}'::jsonb) RETURNING id`;
    await db`UPDATE tenant_members SET access_role=${custom.id} WHERE tenant_id=${tenantId} AND user_id=${userId}`;
    // Fresh DB capability, even with a stale actor claiming the unrestricted base role.
    await assert.rejects(() => promiseMaterialReadyDate(actor,input), {status:403});
    await db`UPDATE access_roles SET permissions='{"inventory":["view"]}'::jsonb WHERE id=${custom.id}`;
    await assert.rejects(() => promiseMaterialReadyDate(actor,input), {status:403});
    await db`UPDATE tenant_members SET access_role=NULL WHERE tenant_id=${tenantId} AND user_id=${userId}`;
    await db`UPDATE stock_reservations SET status='active' WHERE id=${reservation.id}`;
    await db`DELETE FROM stock_reservation_lines WHERE reservation_id=${reservation.id}`;
    await db`INSERT INTO stock_reservation_lines(tenant_id,reservation_id,item_id,warehouse_id,lot_id,reserved_qty,consumed_qty,released_qty)
      VALUES (${tenantId},${reservation.id},${kg},${warehouseId},${kgLot},2,0.5,0.5)`;
    result = await promiseMaterialReadyDate(actor,input);
    assert.equal(result.missing.find(l=>l.itemId===kg)?.available,2);
    assert.equal(result.missing.find(l=>l.itemId===kg)?.shortage,1);
    await db`UPDATE stock_reservation_lines SET lot_id=NULL WHERE reservation_id=${reservation.id}`;
    assert.equal((await promiseMaterialReadyDate(actor,input)).missing.find(l=>l.itemId===kg)?.available,2);
    await db`UPDATE stock_reservation_lines SET item_id=${count},reserved_qty=3,consumed_qty=1,released_qty=1 WHERE reservation_id=${reservation.id}`;
    assert.equal((await promiseMaterialReadyDate(actor,input)).undefinedLeadTime.find(l=>l.itemId===count)?.available,3);
    await db`UPDATE stock_reservation_lines SET lot_id=(SELECT id FROM stock_lots WHERE tenant_id=${tenantId} AND item_id=${count} AND remaining_qty=4) WHERE reservation_id=${reservation.id}`;
    assert.equal((await promiseMaterialReadyDate(actor,input)).undefinedLeadTime.find(l=>l.itemId===count)?.available,3);
    await db`UPDATE stock_reservations SET status='released' WHERE id=${reservation.id}`;
    await db`UPDATE inventory_items SET stock_uom='adet' WHERE id=${kg}`;
    result = await promiseMaterialReadyDate(actor,input);
    assert.equal(result.readyDate,null);
    assert.equal(result.unitMismatch[0].itemId,kg);
    await db`UPDATE inventory_items SET stock_uom='kg' WHERE id=${kg}`;
    console.log('ok: profile lengths, colours, unit mismatch, calendar lead times, partial reservations, narrowed DB roles, populated tenant isolation and advisory reads');
  } finally {
    try {
      // Only this run's fixtures; FK RESTRICT children are removed before their parents.
      await db`DELETE FROM stock_reservation_lines WHERE tenant_id IN (${tenantId},${otherTenant})`;
      await db`DELETE FROM stock_reservations WHERE tenant_id IN (${tenantId},${otherTenant})`;
      await db`DELETE FROM work_orders WHERE tenant_id IN (${tenantId},${otherTenant})`;
      await db`DELETE FROM stock_lots WHERE tenant_id IN (${tenantId},${otherTenant})`;
      await db`DELETE FROM inventory_items WHERE tenant_id IN (${tenantId},${otherTenant})`;
      await db`DELETE FROM warehouse_location_balances WHERE tenant_id IN (${tenantId},${otherTenant})`;
      await db`DELETE FROM warehouse_locations WHERE tenant_id IN (${tenantId},${otherTenant})`;
      await db`DELETE FROM warehouses WHERE tenant_id IN (${tenantId},${otherTenant})`;
      await db`DELETE FROM tenants WHERE id IN (${tenantId},${otherTenant})`;
      await db`DELETE FROM users WHERE id=${userId}`;
    } finally {
      await db.end();
      const { getSql } = await import('../lib/db');
      await getSql().end();
    }
  }
}
main().catch(error => { console.error(error); process.exitCode=1; });
