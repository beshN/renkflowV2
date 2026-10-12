import { localTestDatabaseUrl } from './local-test-database';
/** Integration test for the stock count list import, on the isolated local test database only. */
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

// A synthetic count list laid out like the printed one; every figure is made up.
function html() {
  const at = (x: number, y: number, text: string) => `<div style="position:absolute;left:${x}px;top:${y}px">${text}</div>`;
  const header = (y: number) => [at(45, y, 'Profil'), at(103, y, 'Kod'), at(213, y, 'Malzeme'), at(352, y, 'Boy'), at(421, y, 'Gramaj'), at(506, y, 'Ağırlık')].join('');
  return `<html><body style="font:11px Arial;margin:0;position:relative">
    ${at(170, 20, 'MALZEME SAYIM LİSTESİ')}${at(514, 20, '01.02.2026')}
    ${at(40, 70, 'TEST PROFİLLERİ')}${header(95)}
    ${at(103, 120, '900')}${at(144, 120, '40x60 / Test Mavi')}${at(338, 120, '120,00 m')}${at(416, 120, '1,000 kg/m')}${at(510, 120, '120,00 kg')}
    ${at(103, 145, '900')}${at(144, 145, '40x60 / Boyasız')}${at(338, 145, '60,00 m')}${at(416, 145, '1,000 kg/m')}${at(510, 145, '60,00 kg')}
    ${at(103, 170, '901')}${at(144, 170, 'Test Dere')}${at(338, 170, '10,00 m')}${at(416, 170, '2,000 kg/m')}${at(510, 170, '25,00 kg')}
    ${at(40, 220, 'TEST AKSESUARLARI')}
    ${[at(93, 245, 'Malzeme'), at(202, 245, 'Ölçü'), at(250, 245, 'Miktar'), at(364, 245, 'Malzeme'), at(473, 245, 'Ölçü'), at(522, 245, 'Miktar')].join('')}
    ${at(35, 270, 'Test Makas')}${at(198, 270, '450 cm')}${at(248, 270, '12 Adet')}${at(307, 270, 'Test Köşebent')}${at(518, 270, '40 Adet')}
    ${at(35, 295, 'Test Yay')}${at(246, 295, '5 Takım')}${at(307, 295, 'Test Demir')}${at(518, 295, '3 Boy')}
    ${at(35, 320, 'Test Kapak / Mavi')}${at(248, 320, '3 Adet')}${at(307, 320, 'Test Kapak / Kırmızı')}${at(518, 320, '4 Adet')}
  </body></html>`;
}

async function main() {
  process.env.AUTH_SECRET = 'integration-test-secret-local-only-1234567890';
  process.env.DATABASE_URL = localTestDatabaseUrl();
  process.env.NATIVE_INVENTORY_ENABLED = '1';
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
  for (const file of ['029_ai_suggestions.sql', '031_stock_model.sql', '032_stock_counts.sql', '033_opening_bar_count.sql']) await db.unsafe(readFileSync(`lib/db/migrations/${file}`, 'utf8'));

  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  await page.setContent(html());
  const pdf = await page.pdf({ width: '595px', height: '842px', printBackground: false });
  await browser.close();

  const { fileCountImport } = await import('../lib/features/warehouse/count-import/service');
  const { decideSuggestion, listPendingSuggestions } = await import('../lib/ai/suggestions/service');
  const { sql } = await import('../lib/db');

  const tenantId = randomUUID(), ownerId = randomUUID(), workerId = randomUUID(), rawId = randomUUID();
  await db`INSERT INTO tenants (id, name, slug) VALUES (${tenantId}, 'Count import test', ${'count-' + tenantId.slice(0, 8)})`;
  for (const [id, role] of [[ownerId, 'owner'], [workerId, 'worker']]) {
    await db`INSERT INTO users (id, email, name) VALUES (${id}, ${`${role}-${tenantId}@test.local`}, 'Test')`;
    await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${tenantId}, ${id}, ${role})`;
  }
  await db`INSERT INTO warehouses (id, tenant_id, code, name, warehouse_type) VALUES (${rawId}, ${tenantId}, 'HAM', 'Hammadde', 'RAW')`;
  const owner = { tenantId, userId: ownerId, role: 'owner' as const };
  const upload = { fileName: 'test-sayim.pdf', base64: pdf.toString('base64'), warehouseId: rawId };

  await assert.rejects(fileCountImport({ ...owner, userId: workerId, role: 'worker' } as any, upload), (e: any) => e.status === 403);
  await assert.rejects(fileCountImport(owner as any, { ...upload, base64: Buffer.from('not a pdf at all').toString('base64') }), /PDF dosyası seçin/);
  const filed = await fileCountImport(owner as any, upload);
  assert.equal(filed.created, true);
  assert.deepEqual(filed.summary, { rows: 9, counted: 5, metres: 2, uncertain: 2 });
  const byName = (name: string) => filed.rows.find((r) => r.name === name)!;
  assert.match(byName('Test Dere').issues.join(), /Gramaj tutarsız/);
  assert.match(byName('Test Demir').issues.join(), /çubuk boyu yazmıyor/);
  // Nothing is written before approval.
  assert.equal((await db`SELECT count(*)::int AS n FROM inventory_items WHERE tenant_id = ${tenantId}`)[0].n, 0);
  assert.equal((await db`SELECT count(*)::int AS n FROM stock_entries WHERE tenant_id = ${tenantId}`)[0].n, 0);
  assert.equal((await fileCountImport(owner as any, upload)).created, false, 'the same list waits once');
  const [card] = (await listPendingSuggestions(owner, { refresh: false })).filter((s: any) => s.kind === 'stock.count_import');
  assert.equal(card.uncertain, true);
  assert.match(card.uncertaintyNote, /2 satır emin değilim/);
  console.log('PASS · count list read with fixed rules: weight and bar-length doubts marked, worker refused, not a PDF refused, nothing written before approval, filed once');

  const decided: any = await decideSuggestion(owner, filed.suggestionId, { action: 'approve', expectedVersion: card.version });
  assert.equal(decided.status, 'approved');
  assert.deepEqual({ applied: decided.result.applied, needsBars: decided.result.needsBars, uncertain: decided.result.uncertain, skipped: decided.result.skipped }, { applied: 5, needsBars: 2, uncertain: 2, skipped: 0 });
  const items = await db`SELECT sku, name, stock_uom, profile_code, size_label, processed_states, piece_length_mm, weight_per_meter_kg FROM inventory_items WHERE tenant_id = ${tenantId} ORDER BY sku`;
  const painted = items.find((i: any) => i.profile_code === '900' && i.processed_states.includes('boyali'));
  const unpainted = items.find((i: any) => i.profile_code === '900' && i.processed_states.includes('boyasiz'));
  assert(painted && unpainted && painted.sku !== unpainted.sku, 'painted and unpainted are separate cards; the colour stays on the bars');
  assert.equal(painted.stock_uom, 'm');
  assert.equal(Number(painted.weight_per_meter_kg), 1);
  assert(!items.some((i: any) => i.profile_code === '901'), 'an uncertain row creates nothing');
  const makas = items.find((i: any) => i.name.startsWith('Test Makas'));
  assert.equal(makas.piece_length_mm, 4500);
  const stock = await db`SELECT i.name, i.stock_uom, b.on_hand_qty FROM stock_balances b JOIN inventory_items i ON i.id = b.item_id WHERE b.tenant_id = ${tenantId} ORDER BY i.name`;
  // Two colours of one accessory are one card; their counts are added up.
  assert.deepEqual(stock.map((r: any) => [r.name.split(' ')[1], r.stock_uom, Number(r.on_hand_qty)]), [['Kapak', 'adet', 7], ['Köşebent', 'adet', 40], ['Makas', 'adet', 12], ['Yay', 'takim', 5]]);
  const [entry] = await db`SELECT id, entry_type, reference_type, reference_id FROM stock_entries WHERE tenant_id = ${tenantId}`;
  assert.deepEqual([entry.entry_type, entry.reference_type, entry.reference_id], ['MATERIAL_RECEIPT', 'opening_count', decided.result.documentId]);
  const lines = await db`SELECT name, color, status FROM stock_count_lines WHERE document_id = ${decided.result.documentId} ORDER BY ref`;
  assert.deepEqual(lines.filter((l: any) => l.status === 'needs_bars').map((l: any) => l.color ?? '').sort(), ['', 'Test Mavi']);
  assert.equal(lines.filter((l: any) => l.status === 'uncertain').length, 2);
  await assert.rejects(fileCountImport(owner as any, upload), (e: any) => e.status === 409);
  // A wrongly approved count can be taken back while its lots are untouched.
  const { reverseStockEntry } = await import('../lib/features/manufacturing/inventory.service');
  await reverseStockEntry(owner, entry.id, `reverse-${entry.id}`);
  assert.equal(Number((await db`SELECT coalesce(sum(on_hand_qty),0) AS n FROM stock_balances WHERE tenant_id = ${tenantId}`)[0].n), 0);
  console.log('PASS · approval: cards by code + size + state, piece length kept, opening stock for counted pieces from the count document, metre rows wait for the bar count, uncertain rows not applied, rows of one card added up, the same list cannot be imported twice, the opening entry can be reversed');

  const { recordOpeningCount, openingCountOverview } = await import('../lib/features/warehouse/count-import/opening');
  const pending = (await openingCountOverview(owner as any)).lines as any[];
  const blue = pending.find((l) => l.color === 'Test Mavi');
  const plain = pending.find((l) => !l.color);
  assert(blue && plain, 'both metre lines wait for their bars');
  const bars = [{ lengthMm: 6000, count: 15 }, { lengthMm: 5000, count: 6 }];
  await assert.rejects(recordOpeningCount({ ...owner, userId: workerId, role: 'worker' } as any, { lineId: blue.id, bars }, randomUUID()), (e: any) => e.status === 403);
  const key = randomUUID();
  const counted = await recordOpeningCount(owner as any, { lineId: blue.id, bars }, key);
  assert.deepEqual([counted.bars, counted.countedMeters, counted.listedMeters, counted.differenceMeters], [21, 120, 120, 0]);
  const lots = await db`SELECT length_m, metadata->>'color' AS color FROM stock_lots WHERE tenant_id = ${tenantId} AND metadata->>'countLineId' = ${blue.id}`;
  assert.equal(lots.length, 21, 'one lot per bar');
  assert.deepEqual([...new Set(lots.map((l: any) => `${Number(l.length_m)}:${l.color}`))].sort(), ['5:Test Mavi', '6:Test Mavi']);
  const [barEntry] = await db`SELECT entry_type, reference_type FROM stock_entries WHERE id = ${counted.entryId}`;
  assert.deepEqual([barEntry.entry_type, barEntry.reference_type], ['MATERIAL_RECEIPT', 'opening_count']);
  const again = await recordOpeningCount(owner as any, { lineId: blue.id, bars }, key);
  assert.deepEqual([again.replay, again.entryId, again.bars, again.countedMeters, again.differenceMeters], [true, counted.entryId, 21, 120, 0], 'a retried request posts nothing twice and answers the same');
  await assert.rejects(recordOpeningCount(owner as any, { lineId: plain.id, bars }, key), (e: any) => e.status === 409, 'a key reused for another line is refused');
  assert.equal((await db`SELECT count(*)::int AS n FROM stock_lots WHERE tenant_id = ${tenantId} AND metadata->>'countLineId' = ${blue.id}`)[0].n, 21);
  await assert.rejects(recordOpeningCount(owner as any, { lineId: blue.id, bars }, randomUUID()), (e: any) => e.status === 409);
  // An unpainted profile's bars say so; a short count is entered as counted, with its difference.
  const short = await recordOpeningCount(owner as any, { lineId: plain.id, bars: [{ lengthMm: 6000, count: 9 }] }, randomUUID());
  assert.equal(short.differenceMeters, -6);
  assert.equal((await db`SELECT DISTINCT metadata->>'color' AS c FROM stock_lots WHERE metadata->>'countLineId' = ${plain.id}`)[0].c, 'Boyasız');
  // A profile missing from the list is counted on its own, with a colour.
  const paintedItem = (await db`SELECT id FROM inventory_items WHERE tenant_id = ${tenantId} AND profile_code = '900' AND 'boyali' = ANY(processed_states)`)[0].id;
  await assert.rejects(recordOpeningCount(owner as any, { itemId: paintedItem, warehouseId: rawId, bars }, randomUUID()), /rengini girin/);
  await assert.rejects(recordOpeningCount(owner as any, { itemId: paintedItem, warehouseId: rawId, color: 'Test Kırmızı', bars: [{ lengthMm: 6000, count: 600 }, { lengthMm: 5000, count: 401 }] }, randomUUID()), /en fazla 1000 çubuk/);
  await assert.rejects(recordOpeningCount(owner as any, { itemId: paintedItem, warehouseId: rawId, color: 'Test Kırmızı', bars: [{ lengthMm: 50, count: 1 }] }, randomUUID()), /en az 100 mm/);
  await recordOpeningCount(owner as any, { itemId: paintedItem, warehouseId: rawId, color: 'Test Kırmızı', bars: [{ lengthMm: 6500, count: 2 }] }, randomUUID());
  const onHand = Number((await db`SELECT on_hand_qty FROM stock_balances WHERE tenant_id = ${tenantId} AND item_id = ${paintedItem}`)[0].on_hand_qty);
  assert.equal(onHand, 133);
  // A wrong count is reversed and entered again.
  await reverseStockEntry(owner, counted.entryId, `reverse-${counted.entryId}`);
  const afterReversal = await openingCountOverview(owner as any);
  assert(afterReversal.lines.some((l: any) => l.id === blue.id), 'a reversed count waits again');
  assert(!afterReversal.counted.some((l: any) => l.id === blue.id));
  assert.equal((await db`SELECT status FROM stock_count_lines WHERE id = ${blue.id}`)[0].status, 'needs_bars');
  const recount = await recordOpeningCount(owner as any, { lineId: blue.id, bars: [{ lengthMm: 6000, count: 20 }] }, randomUUID());
  const [recounted] = await db`SELECT status, stock_entry_id, counted_bars, counted_meters FROM stock_count_lines WHERE id = ${blue.id}`;
  assert.deepEqual([recounted.status, recounted.stock_entry_id, recounted.counted_bars, Number(recounted.counted_meters)], ['counted', recount.entryId, 20, 120]);
  assert.equal(Number((await db`SELECT on_hand_qty FROM stock_balances WHERE tenant_id = ${tenantId} AND item_id = ${paintedItem}`)[0].on_hand_qty), 133);
  console.log('PASS · bar-level opening count: one lot per bar with colour and length, difference against the list, worker refused, retried request posts once and answers the same, a reused key refused, a counted line refused, unpainted bars marked, colour required, bar limit and length range, a reversed count waits again and is entered again');

  // Submitted stock entries are immutable by design; the throwaway test tenant stays in the test database.
  await db.end();
  await sql.end({ timeout: 5 });
}

main().catch((error) => { console.error(error); process.exit(1); });
