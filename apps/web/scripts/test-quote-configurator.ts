/** Integration test for the measure-based quote configurator, on the isolated local test database only. */
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
  for (const file of ['031_stock_model.sql', '034_price_matrices.sql', '035_product_family_recipes.sql', '036_product_configuration.sql', '037_production_lead.sql', '039_firm_colors.sql', '041_quote_order_depth.sql', '042_production_depth.sql'])
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
  const recipeInput = { family: 'pergola', code: 'PRG', name: 'Test pergola', finishedItemId: pergola, text: csv };
  const recipePreview: any = await importFamilyRecipe(owner, recipeInput);
  const imported: any = await importFamilyRecipe(owner, { ...recipeInput, dryRun: false, previewHash: recipePreview.previewHash });
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
  // Every RAL colour can be quoted; the firm's frequently used colours come first in the picker and
  // stock only says whether a colour is on the shelf. An empty list does not stop a quote.
  const { saveColorCatalog } = await import('../lib/features/settings/color-catalog.service');
  assert.deepEqual((await configurationOptions(office as any, 'pergola') as any).colors, { favorites: [], stock: ['Boyasız', 'Test Gri'] });
  assert.equal((await previewConfiguration(office as any, { currency: 'TRY', choice: { ...draftChoice, color: '7016' } }) as any).color, 'RAL 7016', 'any RAL colour, stored in one spelling, with no list');
  assert.equal((await previewConfiguration(office as any, { currency: 'TRY', choice: draftChoice }) as any).color, 'Test Gri', 'an old name on the shelf still works');
  await assert.rejects(saveColorCatalog(office as any, { colors: ['Test Gri'] }), (e: any) => e.status === 403);
  await assert.rejects(saveColorCatalog(owner as any, { colors: ['Test Gri', 'test gri'] }), /iki kez/);
  await assert.rejects(saveColorCatalog(owner as any, { colors: ['Kirli Beyaz', 'KIRLI BEYAZ'] }), /iki kez/);
  await assert.rejects(saveColorCatalog(owner as any, { colors: ['7016 Mat', 'RAL 7016 MAT'] }), /iki kez/);
  await saveColorCatalog(owner as any, { colors: ['Test Gri', 'Mor', 'Boyasız', '7016 mat'] });
  const options: any = await configurationOptions(office as any, 'pergola');
  assert.deepEqual(options.recipes.map((r: any) => r.code), ['PRG']);
  assert.deepEqual(options.colors.favorites, [{ name: 'Test Gri', inStock: true }, { name: 'Mor', inStock: false }, { name: 'Boyasız', inStock: true }, { name: 'RAL 7016 Mat', inStock: false }], 'the firm order, saved in the picker spelling; in stock from the bars and the unpainted card');
  assert.equal(options.matrix, null);

  // No matrix: BOM and cut list come out, the price must be typed and says why.
  const preview: any = await previewConfiguration(office as any, { currency: 'TRY', choice: { ...draftChoice, color: 'test gri' } });
  assert.deepEqual(preview.bom.cuts.map((c: any) => [c.sku, c.lengthMm, c.quantity]), [['108-BOYALI', 2980, 2]]);
  assert.deepEqual([preview.color, preview.price.state, preview.price.source, preview.price.message], ['Test Gri', 'no_matrix', 'manual', 'Fiyat matrisi tanımlı değil']);
  assert.equal((await previewConfiguration(office as any, { currency: 'TRY', choice: { ...draftChoice, color: 'Mor' } }) as any).color, 'Mor', 'a colour out of stock can be quoted');
  await assert.rejects(previewConfiguration(office as any, { currency: 'TRY', choice: { ...draftChoice, color: 'Pembe' } }), /bir RAL rengi değil/);
  assert.equal((await previewConfiguration(office as any, { currency: 'TRY', choice: { ...draftChoice, color: 'Özel renk: Bordo metalik (Parlak)' } }) as any).color, 'Özel renk: Bordo metalik (Parlak)');
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
  // The stored line sent back as it was stays as it was; a fresh calculation takes the matrix price.
  const same: any = await quotationService.updateQuotation(tenantId, quote.id, { expectedVersion: quote.version, items: quote.items } as any);
  assert.deepEqual([same.items[0].unitPrice, same.items[0].productConfiguration.price.source], [5000, 'manual']);
  const fresh = await previewConfiguration(office as any, { currency: 'TRY', choice: draftChoice });
  const updated: any = await quotationService.updateQuotation(tenantId, quote.id, { expectedVersion: same.version, items: [item(1, { productConfiguration: fresh })] } as any);
  assert.deepEqual([updated.items[0].unitPrice, updated.items[0].productConfiguration.price.source], [20000, 'matrix']);
  assert.equal(updated.subtotal, 40000);
  // An edit that leaves the line alone keeps what was stored, even after its colour left stock.
  await db`UPDATE stock_lots SET remaining_qty = 0 WHERE tenant_id = ${tenantId}`;
  const noted: any = await quotationService.updateQuotation(tenantId, quote.id, { expectedVersion: updated.version, notes: 'not', items: updated.items } as any);
  assert.deepEqual([noted.items[0].unitPrice, noted.items[0].productConfiguration.price.source], [20000, 'matrix']);
  await db`UPDATE stock_lots SET remaining_qty = 6 WHERE tenant_id = ${tenantId}`;
  // Another currency than the matrix: the old matrix price is not taken as typed; a typed price is required and flagged.
  await assert.rejects(quotationService.updateQuotation(tenantId, quote.id, { expectedVersion: noted.version, currency: 'USD' } as any), /Kalem 1: Fiyat matrisi TRY, teklif USD; fiyat çevrilmez; birim fiyatı elle girin/);
  const usd: any = await quotationService.updateQuotation(tenantId, quote.id, { expectedVersion: noted.version, currency: 'USD', items: [item(700, { productConfiguration: noted.items[0].productConfiguration })] } as any);
  assert.deepEqual([usd.items[0].unitPrice, usd.items[0].productConfiguration.price.state], [700, 'currency_mismatch']);
  // The order made from the quote keeps the configuration: recipe, cut list and price source.
  const converted = await quotationService.convertToOrder(tenantId, quote.id, officeId, usd.version, 'office');
  const [orderLine] = await db`SELECT product_configuration FROM order_items WHERE order_id = ${converted.orderId}`;
  assert.deepEqual([orderLine.product_configuration.recipe.code, orderLine.product_configuration.bom.cuts[0].lengthMm, orderLine.product_configuration.price.source], ['PRG', 2980, 'manual']);
  // Only a raw-material warehouse: no warehouse is guessed; the line waits for its work order, with the reason.
  assert.deepEqual([converted.workOrders, converted.pendingWorkOrders!.length], [[], 1]);
  assert.match(converted.pendingWorkOrders![0].reason, /Hammadde, yarı mamul ve mamul deposundan birer tane olmalı/);
  assert.equal((await db`SELECT count(*)::int AS n FROM work_orders WHERE tenant_id = ${tenantId}`)[0].n, 0);
  // With one warehouse of each kind, converting opens the work order with the quoted recipe and colour: its cuts join the cutting pool.
  const wipId = randomUUID(), finishedId = randomUUID();
  await db`INSERT INTO warehouses (id, tenant_id, code, name, warehouse_type) VALUES (${wipId}, ${tenantId}, 'YM', 'Yarı mamul', 'WIP'), (${finishedId}, ${tenantId}, 'MM', 'Mamul', 'FINISHED')`;
  await db`INSERT INTO stock_lots (tenant_id, item_id, warehouse_id, lot_number, original_qty, remaining_qty, length_m, metadata) VALUES (${tenantId}, ${p108}, ${rawId}, 'L-2', 6, 6, 6, '{"color":"Test Gri"}')`;
  await db`INSERT INTO stock_balances (tenant_id, item_id, warehouse_id, on_hand_qty) VALUES (${tenantId}, ${p108}, ${rawId}, 12) ON CONFLICT (tenant_id, item_id, warehouse_id) DO UPDATE SET on_hand_qty = 12`;
  const second: any = await quotationService.createQuotation(tenantId, { customerName: 'Test müşteri', currency: 'TRY', discountPercent: 0, items: [item(0, { productConfiguration: await previewConfiguration(office as any, { currency: 'TRY', choice: draftChoice }) })] } as any, officeId);
  assert.equal(second.items[0].unitPrice, 20000);
  const done = await quotationService.convertToOrder(tenantId, second.id, officeId, second.version, 'office');
  assert.deepEqual([done.workOrders!.length, done.pendingWorkOrders], [1, []]);
  const [job] = await db`SELECT recipe_id, assigned_to, configuration, bom_snapshot, source_warehouse_id, wip_warehouse_id, target_warehouse_id FROM work_orders WHERE id = ${done.workOrders![0].id}`;
  assert.deepEqual([job.recipe_id, job.assigned_to, job.configuration.bodyName, job.source_warehouse_id, job.wip_warehouse_id, job.target_warehouse_id], [row.id, officeId, 'Test Gri', rawId, wipId, finishedId]);
  assert.deepEqual(job.bom_snapshot.cuts.map((c: any) => [c.lengthMm, c.quantity]), [[2980, 4]], 'the quoted cut list for both pieces');
  const { proposeCutForPool } = await import('../lib/features/manufacturing/platform.service');
  const proposal: any = await proposeCutForPool(sql, owner as any);
  assert(proposal.jobs.some((j: any) => j.id === done.workOrders![0].id), 'the work order is in the cutting pool');
  assert.deepEqual(proposal.result.unfulfilled, []);
  // The work order of a configured line is built only with the recipe it was quoted with.
  const other: any = await quotationService.createQuotation(tenantId, { customerName: 'Test müşteri', currency: 'TRY', discountPercent: 0, items: [item(0, { productConfiguration: await previewConfiguration(office as any, { currency: 'TRY', choice: draftChoice }) })] } as any, officeId);
  const orderOnly: any = await quotationService.convertToOrder(tenantId, other.id, officeId, other.version, 'accountant');
  assert.match(orderOnly.pendingWorkOrders[0].reason, /yönetici ya da ofis/);
  const [otherLine] = await db`SELECT id FROM order_items WHERE order_id = ${orderOnly.orderId}`;
  const otherRecipe = (await db`INSERT INTO production_recipes (tenant_id, code, name, version, status, finished_item_id, rules, operations, limits) VALUES (${tenantId}, 'BASKA', 'Başka', 1, 'published', ${pergola}, ${row.rules}, ${row.operations}, ${row.limits}) RETURNING id`)[0].id;
  await assert.rejects(productionCommand(owner as any, { commandId: randomUUID(), action: 'job.create', data: { orderItemId: otherLine.id, recipeId: otherRecipe, sourceWarehouseId: rawId, wipWarehouseId: wipId, targetWarehouseId: finishedId, assignedTo: ownerId } }), /teklifte "PRG" reçetesinin 1\. sürümüyle yapılandırıldı/);
  // A cut list that no longer matches the quoted one is refused rather than built differently.
  await db`UPDATE order_items SET product_configuration = jsonb_set(product_configuration, '{bom,cuts,0,lengthMm}', '2970') WHERE id = ${otherLine.id}`;
  await assert.rejects(productionCommand(owner as any, { commandId: randomUUID(), action: 'job.create', data: { orderItemId: otherLine.id, recipeId: row.id, sourceWarehouseId: rawId, wipWarehouseId: wipId, targetWarehouseId: finishedId, assignedTo: ownerId } }), /kesim listesi teklifteki ile aynı değil/);
  // Converting without a known person still makes the order and says the work order waits.
  const third: any = await quotationService.createQuotation(tenantId, { customerName: 'Test müşteri', currency: 'TRY', discountPercent: 0, items: [item(0, { productConfiguration: await previewConfiguration(office as any, { currency: 'TRY', choice: draftChoice }) })] } as any, officeId);
  const anonymous: any = await quotationService.convertToOrder(tenantId, third.id);
  assert.equal(anonymous.pendingWorkOrders.length, 1);
  // A default production lead gets the work orders and is told; a lead who left the team is not replaced by a guess.
  const { saveProductionLead, productionSettings } = await import('../lib/features/settings/production-settings.service');
  await assert.rejects(saveProductionLead(office as any, { leadUserId: workerId }), (e: any) => e.status === 403);
  await assert.rejects(saveProductionLead(owner as any, { leadUserId: randomUUID() }), /üretim ekibinde değil/);
  await saveProductionLead(owner as any, { leadUserId: workerId });
  assert.equal((await productionSettings(owner as any)).leadUserId, workerId);
  const ralChoice = { ...draftChoice, color: 'RAL 7016 Mat' };
  const led: any = await quotationService.createQuotation(tenantId, { customerName: 'Test müşteri', currency: 'TRY', discountPercent: 0, items: [item(0, { productConfiguration: await previewConfiguration(office as any, { currency: 'TRY', choice: ralChoice }) })] } as any, officeId);
  const ledDone: any = await quotationService.convertToOrder(tenantId, led.id, officeId, led.version, 'office');
  const ledJob = ledDone.workOrders[0].id;
  assert.equal(ledDone.workOrders[0].assignedTo, workerId);
  assert.equal((await db`SELECT assigned_to FROM work_orders WHERE id = ${ledJob}`)[0].assigned_to, workerId);
  const [notice] = await db`SELECT type, title, message, data FROM notifications WHERE tenant_id = ${tenantId} AND user_id = ${workerId}`;
  assert.deepEqual([notice.type, notice.title, notice.data.workOrderIds, notice.data.href, notice.data.colors], ['work_order:assigned', 'Yeni üretim emri', [ledJob], '/factory', ['RAL 7016 Mat']]);
  assert.match(notice.message, /\(RAL 7016 Mat\) size atandı/);
  // Bars written before the RAL list ("7016 MAT") are cut for the RAL 7016 Mat job.
  for (const lot of ['L-7016-A', 'L-7016-B'])
    await db`INSERT INTO stock_lots (tenant_id, item_id, warehouse_id, lot_number, original_qty, remaining_qty, length_m, metadata) VALUES (${tenantId}, ${p108}, ${rawId}, ${lot}, 6, 6, 6, '{"color":"7016 MAT"}')`;
  await db`UPDATE stock_balances SET on_hand_qty = on_hand_qty + 12 WHERE tenant_id = ${tenantId} AND item_id = ${p108} AND warehouse_id = ${rawId}`;
  const ralPool: any = await proposeCutForPool(sql, owner as any);
  const ralBars = ralPool.result.bars.filter((b: any) => b.pieces.some((p: any) => p.workOrderId === ledJob));
  assert.deepEqual([ralBars.length, [...new Set(ralBars.map((b: any) => b.source.color))]], [2, ['7016 MAT']], 'the RAL job is cut only from the old-spelling 7016 bars');
  assert(!ralPool.result.unfulfilled.some((p: any) => p.workOrderId === ledJob));
  // The worker sees the colour (code, name, finish, screen hex) on the job, and no price or customer.
  const { productionOverview } = await import('../lib/features/manufacturing/platform.service');
  const { getWorkOrderDetails, listWorkOrders } = await import('../lib/features/work-orders/service');
  const seen: any = await productionOverview(worker as any);
  const workerJob = seen.jobs.find((j: any) => j.id === ledJob);
  const workOrder: any = await getWorkOrderDetails(tenantId, ledJob);
  const listed: any = (await listWorkOrders(tenantId, { page: 1, pageSize: 50 } as any)).data.find((w: any) => w.id === ledJob);
  for (const color of [workerJob.color, workOrder.color, listed.color])
    assert.deepEqual([color.label, color.code, color.name, color.finish, color.hex], ['RAL 7016 Mat', 'RAL 7016', 'Antrasit gri', 'Mat', '#3B4044']);
  assert.deepEqual(Object.keys(workOrder.color).sort(), ['code', 'finish', 'finishAssumed', 'hex', 'kind', 'label', 'name', 'note', 'standIn']);
  const leaks = (value: unknown, path = ''): string[] =>
    value && typeof value === 'object'
      ? Object.entries(value).flatMap(([k, v]) => [
          ...(/price|cost|amount|subtotal|^total$|customer|currency/i.test(k) && v !== null && v !== undefined && !(Array.isArray(v) && !v.length) ? [path + k] : []),
          ...leaks(v, path + k + '.'),
        ])
      : [];
  assert.deepEqual(leaks(seen.jobs), [], 'no price or customer field in the worker\'s jobs');
  assert.deepEqual(leaks(workOrder), [], 'no price or customer field in the work order');
  assert(!JSON.stringify([seen, workOrder]).includes('Test müşteri'), 'the customer name never reaches the worker');
  assert.deepEqual(leaks(seen.cutPlans), [], 'no cost in the cut plans a worker sees');
  // The wall screen: office and up only; no customer, no price, the colour as code/name/hex.
  const { wallBoard } = await import('../lib/features/manufacturing/platform.service');
  await assert.rejects(wallBoard(worker as any), (e: any) => e.status === 403);
  const wall: any = await wallBoard(office as any);
  assert(wall.openJobs >= 1 && wall.nextCuts.some((j: any) => j.id === ledJob && j.color?.code === 'RAL 7016'));
  assert.deepEqual(leaks(wall), [], 'no price or customer field on the wall');
  assert(!JSON.stringify(wall).includes('Test müşteri'), 'no customer name on the wall');
  await db`DELETE FROM tenant_members WHERE tenant_id = ${tenantId} AND user_id = ${workerId}`;
  assert.equal((await productionSettings(owner as any)).leadLeft, true, 'the settings screen says the lead left');
  const gone: any = await quotationService.createQuotation(tenantId, { customerName: 'Test müşteri', currency: 'TRY', discountPercent: 0, items: [item(0, { productConfiguration: await previewConfiguration(office as any, { currency: 'TRY', choice: draftChoice }) })] } as any, officeId);
  const goneDone: any = await quotationService.convertToOrder(tenantId, gone.id, officeId, gone.version, 'office');
  assert.match(goneDone.pendingWorkOrders[0].reason, /üretim sorumlusu artık üretim ekibinde değil/);
  // An applied change request on a configured line: the bill of materials is worked out again with the
  // new width and the unstarted work order is opened again with it (the old one cancelled); once a cut
  // plan holds the job, the line changes but the job waits for rework, said on the request.
  const { proposeChange, decideChange } = await import('../lib/features/sales/orders.server');
  const [doneLine] = await db`SELECT id FROM order_items WHERE order_id = ${done.orderId}`;
  const oldJobId = done.workOrders![0].id;
  const widthChange: any = await proposeChange(office as any, done.orderId, { reason: 'Genişlik 3200 oldu', lines: [{ orderItemId: doneLine.id, widthMm: 3200 }] });
  await decideChange(office as any, done.orderId, widthChange.id, { decision: 'apply', acknowledgeImpact: true });
  const jobsNow = await db`SELECT id, status, configuration, bom_snapshot FROM work_orders WHERE tenant_id = ${tenantId} AND order_item_id = ${doneLine.id} ORDER BY created_at`;
  assert.deepEqual(jobsNow.map((j: any) => [j.id === oldJobId, j.status]), [[true, 'cancelled'], [false, 'open']]);
  assert.equal(jobsNow[1].configuration.widthMm, 3200, 'the new job is built with the new width');
  assert.equal((await db`SELECT status FROM orders WHERE id = ${done.orderId}`)[0].status !== 'pending', true);
  const stepOwners = await db`SELECT DISTINCT assigned_to FROM production_operations WHERE work_order_id = ${jobsNow[1].id}`;
  assert.ok(stepOwners.length >= 1, 'the rebuilt job keeps people on its steps');
  // A price-only change keeps the job (same bill of materials).
  const priceOnly: any = await proposeChange(office as any, done.orderId, { reason: 'Fiyat', lines: [{ orderItemId: doneLine.id, unitPrice: 21000 }] });
  await decideChange(office as any, done.orderId, priceOnly.id, { decision: 'apply' });
  assert.equal((await db`SELECT status FROM work_orders WHERE id = ${jobsNow[1].id}`)[0].status, 'open', 'no rebuild without a bill of materials change');
  const [rebuiltLine] = await db`SELECT product_configuration FROM order_items WHERE id = ${doneLine.id}`;
  assert.equal(rebuiltLine.product_configuration.parameters.widthMm, 3200);
  assert.notDeepEqual(jobsNow[1].bom_snapshot.cuts, (await db`SELECT bom_snapshot FROM work_orders WHERE id = ${oldJobId}`)[0].bom_snapshot.cuts, 'the cut list follows the width');
  await db`INSERT INTO cutting_plans (id, tenant_id, work_order_ids, demand, parameters, result, created_by, idempotency_key) VALUES (${randomUUID()}, ${tenantId}, ${[jobsNow[1].id]}::uuid[], '[]', '{}', '{}', ${officeId}, ${randomUUID()})`;
  const [planned] = await db`SELECT id FROM cutting_plans WHERE tenant_id = ${tenantId} AND ${jobsNow[1].id} = ANY(work_order_ids)`;
  await db`UPDATE work_orders SET cut_plan_id = ${planned.id} WHERE id = ${jobsNow[1].id}`;
  const second2: any = await proposeChange(office as any, done.orderId, { reason: 'Genişlik 3300', lines: [{ orderItemId: doneLine.id, widthMm: 3300 }] });
  const after: any = await decideChange(office as any, done.orderId, second2.id, { decision: 'apply', acknowledgeImpact: true });
  assert.equal((await db`SELECT status FROM work_orders WHERE id = ${jobsNow[1].id}`)[0].status, 'open', 'a planned job is not rebuilt behind the cutting plan');
  assert.match(after.changes.find((c: any) => c.id === second2.id).impact.reasons.join(' '), /Rework gerekli · .*Kesim planına alınmış/);
  console.log('PASS · quote to order: work order opened at conversion with the quoted recipe, measures and colour, assigned to the person converting, its cuts in the cutting pool; warehouses not guessed, a role that cannot open work orders leaves the line waiting with the reason, another recipe or a changed cut list refused for a configured line, no silent skip without a person; the default production lead gets the work order and a notification naming its colour, old-spelling 7016 bars cut for a RAL 7016 Mat job, the worker sees the colour without prices or the customer, a lead who left is not replaced by a guess; an applied change rebuilds an unstarted configured job with the new bill of materials and leaves a planned one for rework');
  console.log('PASS · quote configurator: worker refused, only published family recipes offered, every RAL colour quotable in one spelling with or without the frequently used list (office cannot edit it, duplicates in any spelling refused), an old name kept when the firm uses it and an unknown name refused, stock only as in/out of stock, an out-of-stock colour quotable, BOM and cut list from the recipe, limits and unknown colour refused, no matrix means a typed price that is required and flagged, browser BOM/price ignored, matrix price set by the server, an untouched line kept as stored, other currency not converted and an old matrix price not taken as typed, the order keeps the configuration');

  await db.end();
  await sql.end({ timeout: 5 });
}

main().catch((error) => { console.error(error); process.exit(1); });
