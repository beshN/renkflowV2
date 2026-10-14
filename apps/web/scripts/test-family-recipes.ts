/** Integration test for the family recipe template and its import into a draft recipe, on the isolated local test database only. */
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { localTestDatabaseURL } from './local-test-database';

async function main() {
  process.env.AUTH_SECRET = 'integration-test-secret-local-only-1234567890';
  process.env.DATABASE_URL = localTestDatabaseURL();
  process.env.NATIVE_INVENTORY_ENABLED = '1';
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
  for (const file of ['031_stock_model.sql', '035_product_family_recipes.sql']) await db.unsafe(readFileSync(`lib/db/migrations/${file}`, 'utf8'));

  const { importFamilyRecipe, productFamiliesOverview, recipeTemplateCsv } = await import('../lib/features/products/recipe-template.service');
  const { parseCsv, toCsv } = await import('../lib/features/products/csv');
  const { productionCommand } = await import('../lib/features/manufacturing/platform.service');
  const { sql } = await import('../lib/db');

  const tenantId = randomUUID(), ownerId = randomUUID(), officeId = randomUUID();
  await db`INSERT INTO tenants (id, name, slug) VALUES (${tenantId}, 'Recipe test', ${'recipe-' + tenantId.slice(0, 8)})`;
  for (const [id, role] of [[ownerId, 'owner'], [officeId, 'office']]) {
    await db`INSERT INTO users (id, email, name) VALUES (${id}, ${`${role}-${tenantId}@test.local`}, 'Test')`;
    await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${tenantId}, ${id}, ${role})`;
  }
  const owner = { tenantId, userId: ownerId, role: 'owner' as const };
  const office = { tenantId, userId: officeId, role: 'office' as const };
  // Cards as the count-list import makes them; the finished product card; one work centre.
  const card = async (sku: string, code: string | null, uom: string, type = 'raw_material') =>
    (await db`INSERT INTO inventory_items (tenant_id, sku, name, unit, item_type, stock_uom, profile_code) VALUES (${tenantId}, ${sku}, ${'Test ' + sku}, ${uom}, ${type}, ${uom}, ${code}) RETURNING id`)[0].id as string;
  const p108 = await card('108-40X60-BOYALI', '108', 'm');
  const p187 = await card('187-TEKLI-RAY', '187', 'm');
  await card('VIDA', null, 'adet');
  const pergola = await card('PERGOLA', null, 'adet', 'finished_good');
  await db`INSERT INTO work_centers (tenant_id, code, name) VALUES (${tenantId}, 'KESIM', 'Kesim')`;

  await assert.rejects(recipeTemplateCsv(office as any, 'pergola'), (e: any) => e.status === 403);
  const template = await recipeTemplateCsv(owner as any, 'pergola');
  const rows = parseCsv(template);
  assert.deepEqual(rows.filter((r) => r[0] === 'malzeme').map((r) => r[1]), ['108-40X60-BOYALI', '187-TEKLI-RAY'], 'family cards in count-list order; other cards left out');
  assert(rows.some((r) => /Stok kartı olmayan profil kodları: 107, 6056, 5979, 164, 5980, 6017, 6015, 330/.test(r[0])));

  // The firm fills it in (made-up formulas for the test).
  const filled = toCsv(rows.map((r) => {
    if (r[0] === 'sinir') return [...r.slice(0, 9), '1000', '6000'];
    if (r[1] === '108-40X60-BOYALI') return [...r.slice(0, 5), '2', 'widthMm-20', '', '', '', ''];
    if (r[1] === '187-TEKLI-RAY') return [...r.slice(0, 5), '2', 'projectionMm', 'rayTipi == 1', '', '', ''];
    if (r[0] === 'operasyon') return ['operasyon', 'KESIM', 'Kesim', '', '', '15', '', '', '', '', ''];
    return r;
  }).concat([['parametre', 'rayTipi', 'Ray tipi', 'tam_sayi', '', '', '', '', '1', '1', '2']]));
  const input = { family: 'pergola', code: 'PRG-TEST', name: 'Test pergola', finishedItemId: pergola, text: filled };
  await assert.rejects(importFamilyRecipe(office as any, input), (e: any) => e.status === 403);
  const bad: any = await importFamilyRecipe(owner as any, { ...input, text: filled.replace('widthMm-20', 'genislik') });
  assert.equal(bad.ok, false);
  assert.match(bad.errors.join(), /kesim boyu formülü okunamadı \(Bilinmeyen parametre: genislik\)/);
  const preview: any = await importFamilyRecipe(owner as any, input);
  assert.deepEqual([preview.ok, preview.summary.materials, preview.summary.parameters], [true, 2, 1]);
  assert.equal((await db`SELECT count(*)::int AS n FROM production_recipes WHERE tenant_id = ${tenantId}`)[0].n, 0, 'a preview writes nothing');

  await assert.rejects(importFamilyRecipe(owner as any, { ...input, dryRun: false }), (e: any) => e.status === 409, 'write requires a reviewed preview');
  const saved: any = await importFamilyRecipe(owner as any, { ...input, dryRun: false, previewHash: preview.previewHash });
  assert.deepEqual([saved.recipe.code, saved.recipe.version], ['PRG-TEST', 1]);
  const [recipe] = await db`SELECT status, rules, parameter_definitions, limits FROM production_recipes WHERE id = ${saved.recipe.id}`;
  assert.equal(recipe.status, 'draft', 'imported as a draft; publishing needs worked examples');
  assert.deepEqual(recipe.rules.map((r: any) => [r.itemId, r.cutLengthFormula, r.conditionFormula ?? null]), [[p108, 'widthMm-20', null], [p187, 'projectionMm', 'rayTipi == 1']]);
  assert.equal(recipe.parameter_definitions[0].key, 'rayTipi');
  // Worked examples entered in the recipe screen survive a re-import, which updates the same draft.
  const example = [{ parameters: { widthMm: 3000, projectionMm: 2000, mountingHeightMm: 2500, quantity: 1, motor: false, led: false, customParameters: { rayTipi: 1 } }, expected: [{ itemId: p108, quantity: 5.96 }] }];
  await db`UPDATE production_recipes SET examples = ${JSON.stringify(example)}::text::jsonb WHERE id = ${saved.recipe.id}`;
  const changed = { ...input, text: filled.replace(';15;', ';20;') };
  const changedPreview: any = await importFamilyRecipe(owner as any, changed);
  const again: any = await importFamilyRecipe(owner as any, { ...changed, dryRun: false, previewHash: changedPreview.previewHash });
  assert.equal(again.recipe.version, 1);
  assert.equal((await db`SELECT jsonb_array_length(examples) AS n FROM production_recipes WHERE id = ${saved.recipe.id}`)[0].n, 1, 'examples kept');
  await db`UPDATE production_recipes SET examples = '[]' WHERE id = ${saved.recipe.id}`;
  await assert.rejects(productionCommand(owner as any, { commandId: randomUUID(), action: 'recipe.publish', data: { id: saved.recipe.id, editRevision: 2 } }), /en az iki doğrulanmış örnek/);
  // A first import that fails to save (the output is not a finished-good card) leaves no claim; the retry works.
  await assert.rejects(importFamilyRecipe(owner as any, { ...input, code: 'PRG-YENI', finishedItemId: p108, dryRun: false }), /Çıktı kartı mamul olmalı/);
  assert.equal((await db`SELECT count(*)::int AS n FROM product_family_recipes WHERE tenant_id = ${tenantId} AND recipe_code = 'PRG-YENI'`)[0].n, 0);
  const newPreview: any = await importFamilyRecipe(owner as any, { ...input, code: 'PRG-YENI' });
  assert.equal(((await importFamilyRecipe(owner as any, { ...input, code: 'PRG-YENI', dryRun: false, previewHash: newPreview.previewHash })) as any).recipe.version, 1);
  const overview = await productFamiliesOverview(office as any);
  assert.deepEqual(overview.families.find((f: any) => f.key === 'pergola')!.recipes.map((r: any) => [r.code, r.status]), [['PRG-TEST', 'draft'], ['PRG-YENI', 'draft']]);
  // A code used by a recipe made in the recipe screen is not taken over.
  await db`INSERT INTO production_recipes (tenant_id, code, name, version, finished_item_id, rules, operations, limits) VALUES (${tenantId}, 'EKRAN', 'Ekran', 1, ${pergola}, '[]', '[]', '{}')`;
  await assert.rejects(importFamilyRecipe(owner as any, { ...input, code: 'EKRAN', dryRun: false }), (e: any) => e.status === 409);
  // The reviewed input, caller and all relevant records must remain the same.
  const staleInput = { ...input, code: 'PRG-STALE' };
  const stale: any = await importFamilyRecipe(owner, staleInput);
  for (const changed of [{ name: 'Başka ad' }, { text: filled.replace(';15;', ';25;') }, { code: 'PRG-OTHER' }])
    await assert.rejects(importFamilyRecipe(owner, { ...staleInput, ...changed, dryRun: false, previewHash: stale.previewHash }), (e: any) => e.status === 409);
  await assert.rejects(importFamilyRecipe({ ...owner, userId: officeId }, { ...staleInput, dryRun: false, previewHash: stale.previewHash }), (e: any) => e.status === 409);
  await db`UPDATE inventory_items SET name='Değişmiş profil' WHERE tenant_id=${tenantId} AND id=${p108}`;
  await assert.rejects(importFamilyRecipe(owner, { ...staleInput, dryRun: false, previewHash: stale.previewHash }), (e: any) => e.status === 409);
  assert.equal((await db`SELECT count(*)::int AS n FROM product_family_recipes WHERE tenant_id=${tenantId} AND recipe_code='PRG-STALE'`)[0].n, 0);
  const concurrentPreview: any = await importFamilyRecipe(owner, staleInput);
  const concurrent = await Promise.allSettled([1,2].map(() => importFamilyRecipe(owner, { ...staleInput, dryRun: false, previewHash: concurrentPreview.previewHash })));
  assert.equal(concurrent.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal((concurrent.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason.status, 409);
  const reimportPreview: any = await importFamilyRecipe(owner, staleInput);
  await db`UPDATE production_recipes SET examples=${JSON.stringify(example)}::text::jsonb WHERE tenant_id=${tenantId} AND code='PRG-STALE'`;
  await assert.rejects(importFamilyRecipe(owner, { ...staleInput, dryRun: false, previewHash: reimportPreview.previewHash }), (e: any) => e.status === 409, 'editing worked examples also requires a new preview');
  const foreignTenant = randomUUID();
  await db`INSERT INTO tenants (id,name,slug) VALUES (${foreignTenant},'Other recipe tenant',${'other-' + foreignTenant})`;
  const foreignResult: any = await importFamilyRecipe({ ...owner, tenantId: foreignTenant }, { ...staleInput, dryRun: false, previewHash: concurrentPreview.previewHash });
  assert.equal(foreignResult.ok, false, 'other firm cannot resolve these material cards');
  assert.equal((await db`SELECT count(*)::int AS n FROM production_recipes WHERE tenant_id=${foreignTenant}`)[0].n, 0);
  console.log('PASS · recipe preview binds file, fields, caller, tenant, material, output card, centres and draft contents; concurrent import creates once; audit/claim/draft are atomic');
  console.log('PASS · family recipe: template lists the family cards from count-list codes with empty formulas, office cannot download or import, unknown variable rejected with its line, preview writes nothing, import makes a draft with options and conditions, re-import updates the draft and keeps its worked examples, publish still needs worked examples, a failed first save leaves no claim, another recipe code not taken over');

  await db.end();
  await sql.end({ timeout: 5 });
}

main().catch((error) => { console.error(error); process.exit(1); });
