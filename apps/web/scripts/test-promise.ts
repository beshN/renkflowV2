/** Isolated acceptance fixtures; exclusively the existing local test database. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { localTestDatabaseURL } from './local-test-database';
async function main() {
  process.env.DATABASE_URL = localTestDatabaseURL();
  process.env.AUTH_SECRET = randomUUID();
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  const t = randomUUID(), other = randomUUID(), userId = randomUUID(), orderId = randomUUID(), otherOrder = randomUUID();
  try {
    assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
    const { orderPromise } = await import('../lib/features/manufacturing/promise-order.server');
    await db`INSERT INTO tenants(id,name,slug) VALUES (${t},'Promise fixture',${t}),(${other},'Promise isolation',${other})`;
    await db`INSERT INTO users(id,email,name) VALUES (${userId},${userId+'@test.local'},'Promise fixture')`;
    await db`INSERT INTO tenant_members(tenant_id,user_id,role) VALUES (${t},${userId},'office')`;
    await db`INSERT INTO orders(id,tenant_id,order_number,customer_name,total_amount) VALUES (${orderId},${t},${orderId},'Fixture',0),(${otherOrder},${other},${otherOrder},'Other',0)`;
    const actor = { tenantId: t, userId, role: 'office' as const };
    const { GET } = await import('../app/api/v1/orders/[id]/promise/route');
    const token = jwt.sign({ sub: userId, tenantId: t, role: 'office' }, process.env.AUTH_SECRET!, { expiresIn: '5m' });
    const request = (id: string) => new NextRequest(`http://localhost/api/v1/orders/${id}/promise`, { headers: { authorization: `Bearer ${token}` } });
    assert.equal((await GET(request(otherOrder), { params: Promise.resolve({ id: otherOrder }) })).status, 404);
    await assert.rejects(() => orderPromise(actor, otherOrder), { status: 404 });
    let result = await orderPromise(actor, orderId);
    assert.equal(result.earliestFinish, null);
    assert.ok(result.missing.length);
    const finished = randomUUID(), material = randomUUID(), recipe = randomUUID();
    await db`INSERT INTO inventory_items(id,tenant_id,sku,name,unit,stock_uom,lead_time_days) VALUES
      (${finished},${t},${finished},'Finished','adet','adet',0),(${material},${t},${material},'Material','kg','kg',2)`;
    const limits = { minWidthMm:1,maxWidthMm:10000,minProjectionMm:1,maxProjectionMm:10000,minMountingHeightMm:1,maxMountingHeightMm:10000 };
    await db`INSERT INTO production_recipes(id,tenant_id,code,name,version,status,finished_item_id,rules,operations,limits)
      VALUES (${recipe},${t},'PROMISE','Promise fixture',1,'published',${finished},
      ${JSON.stringify([{itemId:material,kind:'material',uom:'kg',quantityFormula:'2'}])}::text::jsonb,
      ${JSON.stringify([{name:'Fixture',workCenterCode:'TEST',minutesFormula:'30 * quantity',qualityChecks:[]}])}::text::jsonb,${JSON.stringify(limits)}::text::jsonb)`;
    const configuration = { recipeId:recipe,color:'Boyasız',parameters:{widthMm:1000,projectionMm:1000,mountingHeightMm:1000,motor:false,led:false} };
    await db`INSERT INTO order_items(order_id,product_name,quantity,unit_price,total_price,product_configuration) VALUES
      (${orderId},'Fixture',1,0,0,${JSON.stringify(configuration)}::text::jsonb),(${orderId},'Fixture',1,0,0,${JSON.stringify(configuration)}::text::jsonb)`;
    result = await orderPromise(actor,orderId,'2026-11-09T05:00:00Z');
    assert.equal(result.earliestFinish,null); // unknown center
    assert.ok(result.missing.some(m => m.reason.includes('TEST')), JSON.stringify(result));
    await db`INSERT INTO work_centers(tenant_id,code,name,shift_start,shift_end,work_days) VALUES (${t},'TEST','Fixture','08:00','17:00',ARRAY[1,2,3,4,5])`;
    result = await orderPromise(actor,orderId,'2026-11-09T05:00:00Z');
    assert.ok(result.earliestFinish,JSON.stringify(result));
    assert.equal(result.material[0].missing[0].quantity,4); // combined demand; no unit/currency total
    assert.equal(result.material[0].missing[0].uom,'kg');
    assert.equal(result.material[0].readyDate,'2026-11-11');
    assert.equal(result.requiresHumanApproval,true);
    const response = await GET(request(orderId), { params: Promise.resolve({ id: orderId }) });
    assert.equal(response.status,200);
    assert.equal(response.headers.get('cache-control'),'private, no-store');
    assert.ok((await response.json()).data.earliestFinish);
    const jobId = randomUUID();
    await db`INSERT INTO work_orders(id,tenant_id,title,order_id,recipe_id,reservation_status) VALUES (${jobId},${t},'Existing load',${orderId},${recipe},'not_reserved')`;
    await db`INSERT INTO production_operations(tenant_id,work_order_id,position,name,work_center_code,planned_minutes,planned_qty)
      VALUES (${t},${jobId},0,'Pending load','TEST',60,1)`;
    result = await orderPromise(actor,orderId,'2026-11-09T05:00:00Z');
    assert.equal(result.optimistic,true);
    assert.equal(result.ignoredLoad[0].workOrderId,jobId);
    const { promiseLine } = await import('../lib/features/manufacturing/promise-order');
    const [saved] = await db`SELECT * FROM production_recipes WHERE tenant_id=${t} AND id=${recipe}`;
    assert.throws(() => promiseLine({ quantity:1, product_configuration:configuration },
      { ...saved, operations:[{name:'Fixture',workCenterCode:'TEST',qualityChecks:[]}] }));
    await db`UPDATE production_recipes SET status='draft' WHERE tenant_id=${t} AND id=${recipe}`;
    assert.equal((await orderPromise(actor,orderId)).earliestFinish,null);
    await db`UPDATE tenant_members SET role='worker' WHERE tenant_id=${t} AND user_id=${userId}`;
    assert.equal((await GET(request(orderId), { params: Promise.resolve({ id: orderId }) })).status,404);
    await assert.rejects(() => orderPromise(actor,orderId),{status:404}); // fresh role defeats stale actor
    console.log('Promise acceptance passed: two tenants, missing inputs, published recipe, combined demand, worker 404.');
  } finally {
    try {
      await db`DELETE FROM production_operations WHERE tenant_id IN (${t},${other})`;
      await db`DELETE FROM work_orders WHERE tenant_id IN (${t},${other})`;
      await db`DELETE FROM work_centers WHERE tenant_id IN (${t},${other})`;
      await db`DELETE FROM order_items WHERE order_id IN (${orderId},${otherOrder})`;
      await db`DELETE FROM orders WHERE tenant_id IN (${t},${other})`;
      await db`DELETE FROM production_recipes WHERE tenant_id IN (${t},${other})`;
      await db`DELETE FROM inventory_items WHERE tenant_id IN (${t},${other})`;
      await db`DELETE FROM tenant_members WHERE tenant_id IN (${t},${other})`;
      await db`DELETE FROM tenants WHERE id IN (${t},${other})`;
      await db`DELETE FROM users WHERE id=${userId}`;
    } finally {
      await db.end();
      const { getSql } = await import('../lib/db'); await getSql().end();
    }
  }
}
main().catch(error => { console.error(error); process.exitCode=1; });
