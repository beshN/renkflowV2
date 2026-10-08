/** Integration test for the measure-based quote configurator, on the isolated local test database only. */
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

async function main() {
  process.env.AUTH_SECRET = 'integration-test-secret-local-only-1234567890';
  process.env.DATABASE_URL = 'postgres://postgres:renkflow-local-only@127.0.0.1:55432/renkflow_test';
  process.env.NATIVE_INVENTORY_ENABLED = '1';
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
  for (const file of ['031_stock_model.sql', '034_price_matrices.sql', '035_product_family_recipes.sql', '036_product_configuration.sql'])
    await db.unsafe(readFileSync(`lib/db/migrations/${file}`, 'utf8'));

  const { importFamilyRecipe } = await import('../lib/features/products/recipe-template.service');
  const { configurationOptions, previewConfiguration } = await import('../lib/features/products/configure.service');
  const { importPriceMatrix } = await import('../lib/features/products/price-matrix.service');
  const { matrixTemplate } = await import('../lib/features/products/price-matrix');
  const { RECIPE_COLUMNS } = await import('../lib/features/products/recipe-template');
  const { toCsv } = await import('../lib/features/products/csv');
  const { productionCommand } = await import('../lib/features/manufacturing/platform.service');
  const { calculateRecipe } = await import('../lib/features/manufacturing/recipe-engine');
  const { quotationService } = await import('../lib/features/quotations/service');
  const { sql } = await import('../lib/db');

  const tenantId = randomUUID(), ownerId = randomUUID(), officeId = randomUUID(), workerId = randomUUID(), rawId = randomUUID();
  await db`INSERT INTO tenants (id, name, slug) VALUES (${tenantId}, 'Configurator test', ${'conf-' + tenantId.slice(0, 8)})`;
  for (const [id, role] of [[ownerId, 'owner'], [officeId, 'office'], [workerId, 'worker']]) {
    await db`INSERT INTO users (id, email, name) VALUES (${id}, ${`${role}-${tenantId}@test.local`}, 'Test')`;
    await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${tenantId}, ${id}, ${role})`;
  }
  const owner = { tenantId, userId: ownerId, role: 'owner' as const };
  const office = { tenantId, userId: officeId, role: 'office' as const };
  const worker = { tenantId, userId: workerId, role: 'worker' as const };
  await db`INSERT INTO warehouses (id, tenant_id, code, name, warehouse_type) VALUES (${rawId}, ${tenantId}, 'HAM', 'Hammadde', 'RAW')`;
  await db`INSERT INTO work_centers (tenant_id, code, name) VALUES (${tenantId}, 'KESIM', 'Kesim')`;
  const card = async (sku: string, code: string | null, uom: string, type = 'raw_material', states: string[] = []) =>
    (await db`INSERT INTO inventory_items (tenant_id, sku, name, unit, item_type, stock_uom, profile_code, processed_states) VALUES (${tenantId}, ${sku}, ${'Test ' + sku}, ${uom}, ${type}, ${uom}, ${code}, ${states}) RETURNING id`)[0].id as string;
  const p108 = await card('108-BOYALI', '108', 'm', 'raw_material', ['boyali']);
  await card('108-BOYASIZ', '108', 'm', 'raw_material', ['boyasiz']);
  const pergola = await card('PERGOLA', null, 'adet', 'finished_good');
  // A bar in stock gives its colour to the list (made-up colour).
  await db`INSERT INTO stock_lots (tenant_id, item_id, warehouse_id, lot_number, original_qty, remaining_qty, length_m, metadata) VALUES (${tenantId}, ${p108}, ${rawId}, 'L-1', 6, 6, 6, '{"color":"Test Gri"}')`;

  // The firm's recipe (made-up rule) imported as a draft, then published with two worked examples.
  const csv = toCsv([[...RECIPE_COLUMNS], ['sinir', 'en', '', '', '', '', '', '', '', '1000', '6000'], ['sinir', 'acilim', '', '', '', '', '', '', '', '1000', '5000'], ['sinir', 'yukseklik', '', '', '', '', '', '', '', '2000', '3000'],
    ['malzeme', '108-BOYALI', '', 'profil', 'm', '2', 'widthMm-20', '', '', '', ''], ['operasyon', 'KESIM', 'Kesim', '', '', '15', '', '', '', '', '']]);
  const imported: any = await importFamilyRecipe(owner as any, { family: 'pergola', code: 'PRG', name: 'Test pergola', finishedItemId: pergola, text: csv, dryRun: false });
  const draftChoice = { family: 'pergola', recipeId: imported.recipe.id, color: 'Test Gri', parameters: { widthMm: 3000, projectionMm: 2500, mountingHeightMm: 2500 } };
  await assert.rejects(previewConfiguration(office as any, { currency: 'TRY', choice: draftChoice }), /yayında değil/);
  const [row] = await db`SELECT * FROM production_recipes WHERE id = ${imported.recipe.id}`;
  const def = { code: row.code, name: row.name, version: row.version, finishedItemId: pergola, rules: row.rules, operations: row.operations, limits: row.limits, examples: [] };
  const examples = [2000, 4000].map((w) => {
    const parameters = { widthMm: w, projectionMm: 2000, mountingHeightMm: 2500, quantity: 1, motor: false, led: false };
    return { parameters, expected: calculateRecipe(def as any, parameters).materials.map((m) => ({ itemId: m.itemId, quantity: m.quantity })) };
  });
  await db`UPDATE production_recipes SET examples = ${JSON.stringify(examples)}::text::jsonb WHERE id = ${row.id}`;
  await productionCommand(owner as any, { commandId: randomUUID(), action: 'recipe.publish', data: { id: row.id, editRevision: row.edit_revision } });

  await assert.rejects(configurationOptions(worker as any, 'pergola'), (e: any) => e.status === 403);
  const options: any = await configurationOptions(office as any, 'pergola');
  assert.deepEqual(options.recipes.map((r: any) => r.code), ['PRG']);
  assert.deepEqual(options.colors, ['Boyasız', 'Test Gri'], 'colours from the bars and the unpainted card, nothing invented');
  assert.equal(options.matrix, null);

  // No matrix: BOM and cut list come out, the price must be typed and says why.
  const preview: any = await previewConfiguration(office as any, { currency: 'TRY', choice: { ...draftChoice, color: 'test gri' } });
  assert.deepEqual(preview.bom.cuts.map((c: any) => [c.sku, c.lengthMm, c.quantity]), [['108-BOYALI', 2980, 2]]);
  assert.deepEqual([preview.color, preview.price.state, preview.price.source, preview.price.message], ['Test Gri', 'no_matrix', 'manual', 'Fiyat matrisi tanımlı değil']);
  await assert.rejects(previewConfiguration(office as any, { currency: 'TRY', choice: { ...draftChoice, color: 'Mor' } }), /rengi sayım listesinde ya da stokta yok/);
  await assert.rejects(previewConfiguration(office as any, { currency: 'TRY', choice: { ...draftChoice, parameters: { ...draftChoice.parameters, widthMm: 9000 } } }), /En reçete sınırları dışında/);

  const item = (unitPrice: number, extra: object = {}) => ({ productName: 'x', quantity: 2, unitPrice, discountPercent: 0, totalPrice: 0, productConfiguration: draftChoice, ...extra });
  await assert.rejects(quotationService.createQuotation(tenantId, { customerName: 'Test müşteri', currency: 'TRY', discountPercent: 0, items: [item(0)] } as any, officeId), /Kalem 1: Fiyat matrisi tanımlı değil; birim fiyatı elle girin/);
  // The browser cannot slip in its own bill of materials or price source.
  const forged = { ...draftChoice, bom: { materials: [], cuts: [] }, price: { source: 'matrix', matrixUnitPrice: 1 } };
  const quote: any = await quotationService.createQuotation(tenantId, { customerName: 'Test müşteri', currency: 'TRY', discountPercent: 0, items: [item(5000, { productConfiguration: forged })] } as any, officeId);
  const line = quote.items[0];
  assert.deepEqual([line.productName, line.widthMm, line.projectionMm, line.color, line.unitPrice, line.totalPrice], ['Pergola · Test pergola', 3000, 2500, 'Test Gri', 5000, 10000]);
  assert.deepEqual([line.productConfiguration.price.source, line.productConfiguration.price.message, line.productConfiguration.bom.cuts.length], ['manual', 'Fiyat matrisi tanımlı değil', 1]);
  assert.match(line.description, /Pergola · Test pergola · 3000 × 2500 mm, yükseklik 2500 mm · Test Gri/);

  // With the firm's matrix (made-up price) the server sets the price, whatever the browser sent.
  await importPriceMatrix(owner as any, { family: 'pergola', dryRun: false, text: matrixTemplate('pergola') + 'pergola;taban;PRG;1000;6000;1000;5000;;adet;20.000;TRY\r\n' });
  const updated: any = await quotationService.updateQuotation(tenantId, quote.id, { expectedVersion: quote.version, items: [item(1, { productConfiguration: line.productConfiguration })] } as any);
  assert.deepEqual([updated.items[0].unitPrice, updated.items[0].productConfiguration.price.source], [20000, 'matrix']);
  assert.equal(updated.subtotal, 40000);
  // Another currency than the matrix: not converted, typed by hand and flagged.
  const usd: any = await quotationService.updateQuotation(tenantId, quote.id, { expectedVersion: updated.version, currency: 'USD', items: [item(700, { productConfiguration: line.productConfiguration })] } as any);
  assert.deepEqual([usd.items[0].unitPrice, usd.items[0].productConfiguration.price.state], [700, 'currency_mismatch']);
  console.log('PASS · quote configurator: worker refused, only published family recipes offered, colours from stock bars and unpainted cards, BOM and cut list from the recipe, limits and unknown colour refused, no matrix means a typed price that is required and flagged, browser BOM/price ignored, matrix price set by the server, other currency not converted');

  await db.end();
  await sql.end({ timeout: 5 });
}

main().catch((error) => { console.error(error); process.exit(1); });
