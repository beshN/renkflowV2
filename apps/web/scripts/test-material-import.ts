/** Product-card import uses native material creation, only in isolated local PostgreSQL. */
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
import { localTestDatabaseURL } from './local-test-database';
async function main() {
  process.env.AUTH_SECRET = 'integration-test-secret-local-only-1234567890';
  process.env.DATABASE_URL = localTestDatabaseURL();
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
  const { sql } = await import('../lib/db');
  const { importMaterialCards } = await import('../lib/features/products/material-import.server');
  const { productionCommand } = await import('../lib/features/manufacturing/platform.service');
  const setup = async () => {
    const tenantId = randomUUID(), userId = randomUUID();
    await db`INSERT INTO tenants (id,name,slug) VALUES (${tenantId},'Material test',${'mat-' + tenantId})`;
    await db`INSERT INTO users (id,name,email) VALUES (${userId},'Material Owner',${userId + '@test.local'})`;
    await db`INSERT INTO tenant_members (tenant_id,user_id,role) VALUES (${tenantId},${userId},'owner')`;
    return { tenantId,userId,role:'owner' as const };
  };
  const owner = await setup(), other = await setup();
  const input = { text: 'Stok kodu;Ad;Tür;Birim;Standart boy (mm);Gramaj (kg/m);Minimum stok;Profil kodu;Ölçü\nPRG;Mamul pergola;mamul;adet;;;0;;\nPR108;Profil;hammadde;m;6000;1,25;0;108;40x60\nVIDA;Vida;sarf;adet;;;100;;\nBAD;Hatalı;sarf;adet;;;1,5;;' };
  for (const role of ['office','worker','accountant']) await assert.rejects(importMaterialCards({ ...owner, role } as any, input), (e: any) => e.status === 403);
  const preview = await importMaterialCards(owner,input);
  assert.deepEqual(preview.summary, { new:3, exists:0, filled:0, nameMatches:0, errors:1 });
  assert.equal((await db`SELECT count(*)::int AS n FROM inventory_items WHERE tenant_id=${owner.tenantId}`)[0].n, 0);
  await assert.rejects(importMaterialCards(owner,{ ...input,dryRun:false }), (e: any) => e.status === 409);
  await assert.rejects(importMaterialCards(other,{ ...input,dryRun:false,previewHash:preview.previewHash }), (e: any) => e.status === 409);
  await assert.rejects(importMaterialCards(owner,{ ...input,text:input.text.replace('Mamul pergola','Başka mamul'),dryRun:false,previewHash:preview.previewHash }), (e: any) => e.status === 409);
  const races = await Promise.allSettled([1,2].map(() => importMaterialCards(owner,{ ...input,dryRun:false,previewHash:preview.previewHash })));
  assert.equal(races.filter((r) => r.status === 'fulfilled').length,1);
  assert.equal((races.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason.status,409);
  const repeated = await importMaterialCards(owner,input);
  assert.deepEqual([repeated.summary.new,repeated.summary.exists,repeated.summary.errors],[0,3,1]);
  assert.equal((await db`SELECT count(*)::int AS n FROM production_commands WHERE tenant_id=${owner.tenantId}`)[0].n,3);
  assert.equal((await db`SELECT count(*)::int AS n FROM activity_logs WHERE tenant_id=${owner.tenantId} AND entity_type='inventory_item' AND action='imported'`)[0].n,3);
  assert.equal((await db`SELECT count(*)::int AS n FROM stock_balances WHERE tenant_id=${owner.tenantId}`)[0].n,0);
  assert.equal((await db`SELECT count(*)::int AS n FROM stock_lots WHERE tenant_id=${owner.tenantId}`)[0].n,0);
  const [profile] = await db`SELECT standard_length_m,weight_per_meter_kg FROM inventory_items WHERE tenant_id=${owner.tenantId} AND sku='PR108'`;
  assert.deepEqual([Number(profile.standard_length_m),Number(profile.weight_per_meter_kg)],[6,1.25]);
  const conflict = await importMaterialCards(owner,{text:'Stok kodu;Ad;Tür;Birim\nPRG;Farklı ad;mamul;adet'});
  assert.equal(conflict.summary.errors,1);
  const identity = await importMaterialCards(owner,{text:'Stok kodu;Ad;Tür;Birim;Profil kodu;Ölçü\nOTHER;Farklı profil;sarf;adet;108;40X60'});
  assert.equal(identity.summary.errors,1);
  await db`UPDATE inventory_items SET active=false WHERE tenant_id=${owner.tenantId} AND sku='VIDA'`;
  assert.equal((await importMaterialCards(owner,input)).summary.errors,2);
  await assert.rejects(importMaterialCards(owner,{...input,dryRun:false,previewHash:repeated.previewHash}),(e: any)=>e.status===409);
  assert.equal((await importMaterialCards(other,input)).summary.new,3,'another firm has its own catalogue');
  // A manual native save and CSV import share one lock: the reviewed creation becomes stale.
  const nativeInput = {text:'Stok kodu;Ad;Tür;Birim\nMANUAL;Manual card;sarf;adet'};
  const nativePreview = await importMaterialCards(owner,nativeInput);
  await productionCommand(owner,{commandId:randomUUID(),action:'material.save',data:{sku:'MANUAL',name:'Manual card',uom:'adet',itemType:'consumable'}});
  await assert.rejects(importMaterialCards(owner,{...nativeInput,dryRun:false,previewHash:nativePreview.previewHash}),(e: any)=>e.status===409);
  console.log('PASS · material import: manager-only, tenant/caller/file/card preview binding, partial row errors, native validation and audit, concurrent duplicate refused, existing/archive/identity protected, no quantities/lots changed');
  await db.end(); await sql.end({timeout:5});
}
main().catch((e)=>{console.error(e);process.exit(1);});
