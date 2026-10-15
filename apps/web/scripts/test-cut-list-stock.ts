/** Physical stock and painting regression; always runs against an isolated local database. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { localTestDatabaseURL } from './local-test-database';

async function main() {
  process.env.DATABASE_URL = localTestDatabaseURL();
  process.env.AUTH_SECRET = 'cut-list-local-integration-secret-2026';
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
  const { planCutListFromDoc } = await import('../lib/features/manufacturing/cut-list.server');
  const { parseFoy } = await import('../lib/features/foy/parse');
  const [tenant] = await db`INSERT INTO tenants(name,slug) VALUES('Cut list test',${'cut-' + randomUUID()}) RETURNING id`;
  const [owner] = await db`INSERT INTO users(name,email,password) VALUES('Local owner',${randomUUID() + '@example.invalid'},'local-test-only') RETURNING id`;
  await db`INSERT INTO tenant_members(tenant_id,user_id,role) VALUES(${tenant.id},${owner.id},'owner')`;
  const actor = { tenantId: tenant.id, userId: owner.id, role: 'owner' as const };
  const [warehouse] = await db`INSERT INTO warehouses(tenant_id,code,name,warehouse_type) VALUES(${tenant.id},'RAW','Raw','RAW') RETURNING id`;
  const [painted] = await db`INSERT INTO inventory_items(tenant_id,sku,name,unit,stock_uom,profile_code,size_label,processed_states,standard_length_m)
    VALUES(${tenant.id},'P','108 40x60 Boyalı','m','m','108','40x60',ARRAY['boyali'],6) RETURNING id`;
  const [raw] = await db`INSERT INTO inventory_items(tenant_id,sku,name,unit,stock_uom,profile_code,size_label,processed_states,piece_length_mm)
    VALUES(${tenant.id},'R','108 40x60 Boyasız','adet','adet','108','40x60',ARRAY['boyasiz'],4000) RETURNING id`;
  const [aggregate] = await db`INSERT INTO stock_lots(tenant_id,item_id,warehouse_id,lot_number,original_qty,remaining_qty,metadata)
    VALUES(${tenant.id},${painted.id},${warehouse.id},'UNKNOWN-TOTAL',220,220,'{"color":"RAL 7016 Mat"}') RETURNING id`;
  await db`INSERT INTO stock_lots(tenant_id,item_id,warehouse_id,lot_number,original_qty,remaining_qty,length_m,metadata)
    VALUES(${tenant.id},${painted.id},${warehouse.id},'PAINTED-4M',4,4,4,'{"color":"RAL 7016 Mat"}')`;
  const [rawLot] = await db`INSERT INTO stock_lots(tenant_id,item_id,warehouse_id,lot_number,original_qty,remaining_qty,metadata)
    VALUES(${tenant.id},${raw.id},${warehouse.id},'RAW-PIECES',3,3,'{}') RETURNING id`;
  const doc = parseFoy(JSON.parse(readFileSync('__tests__/fixtures/foy/pergola-g.json', 'utf8')));
  doc.cutList = [{ kind: 'led', profile: '40 * 60', lengthCm: 379.5, widthCm: null, quantity: 4 }];
  doc.ironCuts = [];
  const result = await planCutListFromDoc(actor, { doc });
  assert.equal(result.plan.summary.toBuy, 0);
  assert.equal(result.plan.summary.toPaint, 3);
  assert.equal(result.plan.groups.flatMap((g) => g.bars).length, 4);
  assert(result.plan.groups.flatMap((g) => g.bars).every((b) => b.sourceLengthMm === 4000));
  assert(result.stockProblems.some((p) => p.lotNumber === 'UNKNOWN-TOTAL'));
  assert.equal(Number((await db`SELECT remaining_qty FROM stock_lots WHERE id=${rawLot.id}`)[0].remaining_qty), 3, 'preview must not consume or paint stock');
  assert.equal(Number((await db`SELECT remaining_qty FROM stock_lots WHERE id=${aggregate.id}`)[0].remaining_qty), 220);
  const [other] = await db`INSERT INTO tenants(name,slug) VALUES('Other tenant',${'cut-other-' + randomUUID()}) RETURNING id`;
  const privateResult = await planCutListFromDoc({ ...actor, tenantId: other.id }, { doc });
  assert.equal(privateResult.stock.bars, 0);
  assert.equal(privateResult.plan.groups.length, 0);
  await assert.rejects(() => planCutListFromDoc({ ...actor, role: 'worker' }, { doc }), /yetkiniz/);
  console.log('PASS: physical stock units, matching painted first, raw-to-paint fallback, unknown totals excluded, no writes and tenant/role isolation');
  await db.end();
  process.exit(0);
}
main().catch((error) => { console.error(error); process.exit(1); });
