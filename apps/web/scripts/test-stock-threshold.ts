/** Integration test for the stock threshold warning and the purchase draft suggestion, on the isolated local test database only. */
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
  for (const file of ['029_ai_suggestions.sql', '031_stock_model.sql']) await db.unsafe(readFileSync(`lib/db/migrations/${file}`, 'utf8'));

  const { stockThresholdWarnings } = await import('../lib/features/inventory/thresholds');
  const { refreshPurchaseDraftSuggestion, PURCHASE_DRAFT_KIND } = await import('../lib/ai/suggestions/kinds/purchase-draft');
  const { decideSuggestion, listPendingSuggestions } = await import('../lib/ai/suggestions/service');
  const { executeProcurement } = await import('../lib/features/manufacturing/purchasing.service');
  const { sql, withTransaction } = await import('../lib/db');

  // Made-up firm, items and prices.
  const tenantId = randomUUID(), ownerId = randomUUID(), officeId = randomUUID(), workerId = randomUUID(), rawId = randomUUID(), supplierId = randomUUID();
  await db`INSERT INTO tenants (id, name, slug) VALUES (${tenantId}, 'Threshold test', ${'threshold-' + tenantId.slice(0, 8)})`;
  for (const [id, role] of [[ownerId, 'owner'], [officeId, 'office'], [workerId, 'worker']]) {
    await db`INSERT INTO users (id, email, name) VALUES (${id}, ${`${role}-${tenantId}@test.local`}, 'Test')`;
    await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${tenantId}, ${id}, ${role})`;
  }
  await db`INSERT INTO warehouses (id, tenant_id, code, name, warehouse_type) VALUES (${rawId}, ${tenantId}, 'HAM', 'Hammadde', 'RAW')`;
  await db`INSERT INTO suppliers (id, tenant_id, name, is_active) VALUES (${supplierId}, ${tenantId}, 'Test Tedarik', true)`;
  const owner = { tenantId, userId: ownerId, role: 'owner' as const };
  const office = { tenantId, userId: officeId, role: 'office' as const };
  const worker = { tenantId, userId: workerId, role: 'worker' as const };
  const item = async (sku: string, uom: string, min: number, onHand: number) => {
    const [row] = await db`INSERT INTO inventory_items (tenant_id, sku, name, unit, item_type, stock_uom, min_stock) VALUES (${tenantId}, ${sku}, ${'Test ' + sku}, ${uom}, 'raw_material', ${uom}, ${min}) RETURNING id`;
    if (onHand) await db`INSERT INTO stock_balances (tenant_id, item_id, warehouse_id, on_hand_qty) VALUES (${tenantId}, ${row.id}, ${rawId}, ${onHand})`;
    return row.id as string;
  };
  const vida = await item('VIDA', 'adet', 10, 4);
  const profil = await item('PROFIL', 'm', 100, 40);
  const yeni = await item('YENI', 'adet', 5, 1);
  const bol = await item('BOL', 'adet', 3, 10);
  const yolda = await item('YOLDA', 'adet', 8, 2);

  // Earlier purchases: one received (price, length, colour come from it), one sent and not yet received.
  const old: any = await withTransaction((tx: any) => executeProcurement(tx, owner as any, 'procurement.purchase.create', { supplierId, lines: [
    { itemId: vida, warehouseId: rawId, quantity: 20, unitPrice: 12.5 },
    { itemId: profil, warehouseId: rawId, quantity: 5, unitPrice: 30, lengthMm: 6500, color: 'Test Gri' },
  ] }, randomUUID()));
  await db`UPDATE purchase_orders SET status = 'received' WHERE id = ${old.id}`;
  await db`UPDATE purchase_order_lines SET received_qty = ordered_qty WHERE purchase_order_id = ${old.id}`;
  const sent: any = await withTransaction((tx: any) => executeProcurement(tx, owner as any, 'procurement.purchase.create', { supplierId, lines: [{ itemId: yolda, warehouseId: rawId, quantity: 6, unitPrice: 2 }] }, randomUUID()));
  await db`UPDATE purchase_orders SET status = 'submitted' WHERE id = ${sent.id}`;

  await assert.rejects(stockThresholdWarnings(worker as any), (e: any) => e.status === 403);
  const warnings = await stockThresholdWarnings(office as any);
  const w = (id: string) => warnings.find((x: any) => x.itemId === id)!;
  assert.equal(w(bol), undefined, 'an item above its minimum is not warned about');
  assert.deepEqual([w(vida).state, w(vida).shortfall, w(vida).supplierName], ['draftable', 6, 'Test Tedarik']);
  assert.deepEqual([w(profil).state, w(profil).shortfall], ['draftable', 60]);
  assert.deepEqual([w(yeni).state, w(yeni).shortfall], ['unknown', 4]);
  assert.match(w(yeni).reason!, /Daha önce satın alınmamış/);
  assert.deepEqual([w(yolda).state, w(yolda).incoming], ['covered', 6]);
  console.log('PASS · threshold: under-minimum items warned with what is ordered, worker refused, items never bought marked unknown instead of guessed, an order already sent covers the need');

  await refreshPurchaseDraftSuggestion(owner);
  assert.deepEqual(await listPendingSuggestions(worker, { refresh: false }), [], 'a worker does not see purchase drafts');
  let [card] = (await listPendingSuggestions(office, { refresh: false })).filter((s: any) => s.kind === PURCHASE_DRAFT_KIND) as any[];
  assert(card, 'the office sees the purchase draft suggestion');
  assert.equal(card.uncertain, true);
  assert.match(card.uncertaintyNote, /1 malzeme için tedarikçi veya alış bilgisi yok/);
  assert.match(card.rationale, /Test PROFIL 10 çubuk × 6,5 m, Test Gri/);
  assert.match(card.rationale, /Test YENI: Daha önce satın alınmamış/);
  // Nothing is ordered before approval.
  assert.equal((await db`SELECT count(*)::int AS n FROM purchase_orders WHERE tenant_id = ${tenantId} AND status = 'draft'`)[0].n, 0);

  // The situation changes before approval: the card is refused, not applied to a different need.
  await db`UPDATE stock_balances SET on_hand_qty = 5 WHERE item_id = ${vida}`;
  await assert.rejects(decideSuggestion(office, card.id, { action: 'approve', expectedVersion: card.version }), (e: any) => e.status === 409);
  await refreshPurchaseDraftSuggestion(owner);
  const pending = (await listPendingSuggestions(office, { refresh: false })).filter((s: any) => s.kind === PURCHASE_DRAFT_KIND) as any[];
  assert.equal(pending.length, 1, 'the out-of-date card expired and a new one was filed');
  assert.notEqual(pending[0].id, card.id);
  assert.equal((await db`SELECT status FROM ai_suggestions WHERE id = ${card.id}`)[0].status, 'expired');
  card = pending[0];

  const decided: any = await decideSuggestion(office, card.id, { action: 'approve', expectedVersion: card.version });
  assert.equal(decided.result.orders.length, 1);
  const lines = await db`SELECT i.sku, l.ordered_qty, l.unit_price, l.metadata, po.status, po.supplier_id FROM purchase_order_lines l JOIN purchase_orders po ON po.id = l.purchase_order_id JOIN inventory_items i ON i.id = l.item_id
    WHERE po.id = ${decided.result.orders[0].id} ORDER BY i.sku`;
  assert.deepEqual(lines.map((l: any) => [l.sku, Number(l.ordered_qty), Number(l.unit_price), l.status, l.supplier_id]), [
    ['PROFIL', 65, 30, 'draft', supplierId],
    ['VIDA', 5, 12.5, 'draft', supplierId],
  ]);
  assert.deepEqual([lines[0].metadata.lengthMm, lines[0].metadata.color, lines[0].metadata.orderedBarCount], [6500, 'Test Gri', 10]);
  // The draft now covers the need: no new card, and the warning says so.
  await refreshPurchaseDraftSuggestion(owner);
  assert.equal((await listPendingSuggestions(office, { refresh: false })).filter((s: any) => s.kind === PURCHASE_DRAFT_KIND).length, 0);
  assert.equal((await stockThresholdWarnings(office as any)).find((x: any) => x.itemId === vida)!.state, 'covered');
  console.log('PASS · purchase draft suggestion: filed with the doubt stated, hidden from workers, nothing ordered before approval, refused and refiled when stock changed, approval opens a draft order with last price, bar length and colour, the draft covers the need');

  await db.end();
  await sql.end({ timeout: 5 });
}

main().catch((error) => { console.error(error); process.exit(1); });
