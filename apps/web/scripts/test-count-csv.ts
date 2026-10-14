/** CSV → pending approval → cards/stock, against isolated local PostgreSQL only. */
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
import { localTestDatabaseURL } from './local-test-database';
async function main() {
  process.env.AUTH_SECRET = 'integration-test-secret-local-only-1234567890';
  process.env.DATABASE_URL = localTestDatabaseURL();
  process.env.NATIVE_INVENTORY_ENABLED = '1';
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
  const { sql } = await import('../lib/db');
  const { fileCountImport, countImports } = await import('../lib/features/warehouse/count-import/service');
  const { decideSuggestion, listPendingSuggestions } = await import('../lib/ai/suggestions/service');
  const setup = async () => {
    const tenantId = randomUUID(), userId = randomUUID(), warehouseId = randomUUID();
    await db`INSERT INTO tenants (id,name,slug) VALUES (${tenantId},'CSV test',${'csv-' + tenantId})`;
    await db`INSERT INTO users (id,name,email) VALUES (${userId},'CSV Owner',${userId + '@test.local'})`;
    await db`INSERT INTO tenant_members (tenant_id,user_id,role) VALUES (${tenantId},${userId},'owner')`;
    await db`INSERT INTO warehouses (id,tenant_id,code,name,warehouse_type) VALUES (${warehouseId},${tenantId},'HAM','Test RAW','RAW')`;
    return { actor: { tenantId, userId, role: 'owner' as const }, warehouseId };
  };
  const a = await setup(), b = await setup();
  const input = { format: 'csv', fileName: 'sayim.csv', warehouseId: a.warehouseId, text: 'Malzeme;Miktar;Birim;Kod;Gramaj (kg/m);Ağırlık (kg)\nKapak;12;adet;;;\nProfil;120;m;900;1,25;150\nHatalı;1,5;adet;;;' };
  for (const role of ['worker', 'office']) await assert.rejects(fileCountImport({ ...a.actor, role } as any, input), (e: any) => e.status === 403);
  await assert.rejects(fileCountImport(b.actor, input), /deposu/);
  await assert.rejects(fileCountImport(a.actor, { ...input, text: 'Malzeme;Miktar\nKapak;2' }), /Birim/);
  const filed = await fileCountImport(a.actor, input);
  assert.deepEqual(filed.summary, { rows: 3, counted: 1, metres: 1, uncertain: 1 });
  assert.equal((await db`SELECT count(*)::int AS n FROM inventory_items WHERE tenant_id=${a.actor.tenantId}`)[0].n, 0);
  const reordered = { ...input, text: '\uFEFFMalzeme,Miktar,Birim,Kod,Gramaj (kg/m),Ağırlık (kg)\nProfil,120,m,900,"1,25",150\nKapak,12,adet,,,\nHatalı,"1,5",adet,,,' };
  assert.equal((await fileCountImport(a.actor, reordered)).suggestionId, filed.suggestionId, 'encoding/delimiter/order changes remain the same pending document');
  const approve = async (id: string) => {
    const suggestion = (await listPendingSuggestions(a.actor, { refresh: false })).find((s) => s.id === id)!;
    return decideSuggestion(a.actor, id, { action: 'approve', expectedVersion: suggestion.version });
  };
  await assert.rejects(decideSuggestion(b.actor, filed.suggestionId, { action: 'approve', expectedVersion: 1 }), (e: any) => e.status === 404);
  const decision: any = await approve(filed.suggestionId);
  assert.deepEqual([decision.result.applied, decision.result.needsBars, decision.result.uncertain], [1,1,1]);
  assert.equal(Number((await db`SELECT sum(on_hand_qty) AS n FROM stock_balances WHERE tenant_id=${a.actor.tenantId}`)[0].n), 12);
  assert.equal((await db`SELECT count(*)::int AS n FROM stock_lots WHERE tenant_id=${a.actor.tenantId} AND length_m IS NOT NULL`)[0].n, 0, 'metres never invent physical bars');
  await assert.rejects(fileCountImport(a.actor, reordered), (e: any) => e.status === 409);
  assert.equal((await countImports(b.actor)).length, 0);
  const ownCopy = await fileCountImport(b.actor, { ...input, warehouseId: b.warehouseId });
  assert(ownCopy.created, 'another tenant can import its own count');
  // Two different counts approved concurrently must reconcile to the greater count, never add both deltas.
  const low = await fileCountImport(a.actor, { ...input, text: 'Malzeme;Miktar;Birim\nKapak;20;adet' });
  const high = await fileCountImport(a.actor, { ...input, text: 'Malzeme;Miktar;Birim\nKapak;30;adet' });
  await Promise.all([approve(low.suggestionId), approve(high.suggestionId)]);
  assert.equal(Number((await db`SELECT sum(on_hand_qty) AS n FROM stock_balances WHERE tenant_id=${a.actor.tenantId}`)[0].n), 30);
  assert.equal((await db`SELECT count(*)::int AS n FROM inventory_items WHERE tenant_id=${a.actor.tenantId} AND name='Kapak'`)[0].n, 1);
  // Same semantic file in two warehouse queues cannot be approved twice.
  const secondWarehouse = randomUUID();
  await db`INSERT INTO warehouses (id,tenant_id,code,name,warehouse_type) VALUES (${secondWarehouse},${a.actor.tenantId},'HAM2','Test RAW2','RAW')`;
  const next = { ...input, text: 'Malzeme;Miktar;Birim\nYeni Kapak;5;adet' };
  const first = await fileCountImport(a.actor, next);
  const second = await fileCountImport(a.actor, { ...next, warehouseId: secondWarehouse });
  const results = await Promise.allSettled([approve(first.suggestionId), approve(second.suggestionId)]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
  assert.equal(rejected.reason.status, 409);
  const collision = await fileCountImport(a.actor, { ...input, text: 'Malzeme;Miktar;Birim\nYeni-Kapak;8;adet' });
  const collisionResult: any = await approve(collision.suggestionId);
  assert.equal(collisionResult.result.skipped, 1, 'a generated SKU collision does not reuse another named material');
  await db`UPDATE inventory_items SET active=false WHERE tenant_id=${a.actor.tenantId} AND name='Kapak'`;
  const archived = await fileCountImport(a.actor, { ...input, text: 'Malzeme;Miktar;Birim\nKapak;40;adet' });
  const archivedResult: any = await approve(archived.suggestionId);
  assert.equal(archivedResult.result.skipped, 1, 'archived cards cannot be revived by stock import');
  assert.equal(Number((await db`SELECT sum(on_hand_qty) AS n FROM stock_balances b JOIN inventory_items i ON i.id=b.item_id WHERE b.tenant_id=${a.actor.tenantId} AND i.name='Kapak'`)[0].n), 30);
  console.log('PASS · CSV approval: role/firma isolation, no stock before approval, canonical dedupe, uncertain rows excluded, metres await physical bars, concurrent counts post no duplicate stock');
  await db.end(); await sql.end({ timeout: 5 });
}
main().catch((e) => { console.error(e); process.exit(1); });
