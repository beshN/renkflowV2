/**
 * Integration test for assistant commands (gece 3, AI-4) on the isolated local test database only:
 * a quote draft from one line (ambiguous customer → choice → preview → approval → draft quote),
 * late jobs, bar stock by colour, three what-if scenarios (expedite, delay, cancel) with preview and
 * approval, and role limits (a worker cannot, a price-hiding role sees no prices). No model is used.
 */
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { localTestDatabaseURL } from './local-test-database';

async function main() {
  process.env.AUTH_SECRET = 'integration-test-secret-local-only-1234567890';
  process.env.DATABASE_URL = localTestDatabaseURL();
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
  for (const f of ['029_ai_suggestions.sql', '041_quote_order_depth.sql', '044_access_control.sql', '048_ai_assistant.sql']) await db.unsafe(readFileSync(`lib/db/migrations/${f}`, 'utf8'));

  const { runCommand } = await import('../lib/ai/commands/run.server');
  const svc = await import('../lib/ai/suggestions/service');
  const team = await import('../lib/security/team.server');
  const access = await import('../lib/security/member-access.server');
  const { sql } = await import('../lib/db');

  const tenantId = randomUUID();
  const ids: Record<string, string> = {};
  await db`INSERT INTO tenants (id, name, slug) VALUES (${tenantId}, 'Komut test', ${'cmd-' + tenantId.slice(0, 8)})`;
  for (const role of ['owner', 'office', 'worker']) {
    ids[role] = randomUUID();
    await db`INSERT INTO users (id, email, name) VALUES (${ids[role]}, ${`${role}-${ids[role]}@test.local`}, ${role})`;
    await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${tenantId}, ${ids[role]}, ${role})`;
  }
  const actor = (role: string) => ({ tenantId, userId: ids[role], role: role as any });
  const owner = actor('owner');
  const day = (n: number) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date(Date.now() + n * 86_400_000));

  // Quote: two "Ahmet"s → the assistant asks which one; then a preview; approving opens a draft quote.
  const [a1] = await db`INSERT INTO customers (tenant_id, full_name) VALUES (${tenantId}, 'Ahmet Yılmaz') RETURNING id`;
  await db`INSERT INTO customers (tenant_id, full_name, company_name) VALUES (${tenantId}, 'Ahmet Kaya', 'Kaya İnşaat')`;
  const ask: any = await runCommand(owner, { text: "Ahmet Bey'e 3x4 pergola teklif hazırla antrasit" });
  assert.equal(ask.type, 'choose');
  assert.equal(ask.options.length, 2);
  const preview: any = await runCommand(owner, { text: "Ahmet Bey'e 3x4 pergola teklif hazırla antrasit", customerId: a1.id });
  assert.equal(preview.type, 'preview');
  assert.deepEqual(preview.lines.slice(0, 3).map((l: any) => l.value), ['Ahmet Yılmaz', 'Pergola 3 × 4 m', 'RAL 7016']);
  assert.ok(preview.warnings.some((w: string) => /Fiyat matrisi yok/.test(w)), 'no matrix → price by hand, said so, never guessed');
  assert.equal((await db`SELECT count(*)::int AS n FROM quotations WHERE tenant_id = ${tenantId}`)[0].n, 0, 'nothing written before approval');
  const pending = (await svc.listPendingSuggestions(owner, { refresh: false })).find((s) => s.id === preview.suggestionId)!;
  assert.ok(pending, 'the preview waits in the creator\'s queue');
  assert.ok(!(await svc.listPendingSuggestions(actor('office'), { refresh: false })).some((s) => s.id === preview.suggestionId), 'not in anyone else\'s');
  const done: any = await svc.decideSuggestion(owner, preview.suggestionId, { action: 'approve', expectedVersion: preview.version });
  const [q] = await db`SELECT status, customer_id, customer_name FROM quotations WHERE id = ${done.result.quotationId}`;
  assert.deepEqual([q.status, String(q.customer_id), q.customer_name], ['draft', String(a1.id), 'Ahmet Yılmaz']);
  const [qi] = await db`SELECT width_mm, projection_mm, color FROM quotation_items WHERE quotation_id = ${done.result.quotationId}`;
  assert.deepEqual([Number(qi.width_mm), Number(qi.projection_mm), qi.color], [3000, 4000, 'RAL 7016']);
  // A new name → a draft for that name (no card is made up).
  const fresh: any = await runCommand(owner, { text: "Zeynep Arslan'a 4x5 pergola teklif 9016" });
  assert.equal(fresh.type, 'preview');
  assert.match(fresh.lines[0].value, /Zeynep Arslan \(yeni\)/);
  // Missing measure → it asks instead of guessing.
  assert.equal(((await runCommand(owner, { text: "Ahmet Yılmaz'a pergola teklif" })) as any).type, 'need');

  // Late jobs this week; prices only for those who see prices.
  const [late] = await db`INSERT INTO orders (tenant_id, order_number, customer_name, status, total_amount, delivery_date, promised_date, product_name)
    VALUES (${tenantId}, ${'ORD-CMD-' + tenantId.slice(0, 5)}, 'Ahmet Yılmaz', 'in_production', 25000, ${day(-2)}, ${day(-1)}, 'Pergola') RETURNING id, order_number`;
  const list: any = await runCommand(owner, { text: 'bu hafta geciken işler' });
  assert.equal(list.type, 'list');
  assert.equal(list.rows[0].cells[0], late.order_number);
  assert.equal(list.rows[0].cells[3], '1 gün geçti');
  assert.ok(list.columns.includes('Tutar'));
  const priceHidden = await team.saveRole(owner as any, null, { name: 'Fiyatsız ofis', base: 'office', permissions: { orders: ['view', 'edit'], quotations: ['view', 'create', 'edit'], inventory: ['view'] }, hidden: ['price'] });
  await team.updateMember(owner as any, ids.office, { accessRole: priceHidden });
  access.forgetMemberAccess(ids.office, tenantId);
  const list2: any = await runCommand(actor('office'), { text: 'bu hafta geciken işler' });
  assert.ok(!list2.columns.includes('Tutar'), 'a role hiding prices gets no amounts');
  const p2: any = await runCommand(actor('office'), { text: "Zeynep Arslan'a 4x5 pergola teklif 9016" });
  assert.ok(!p2.lines.some((l: any) => l.label === 'Birim fiyat'));
  await team.updateMember(owner as any, ids.office, { accessRole: null });
  access.forgetMemberAccess(ids.office, tenantId);

  // A worker may not ask for quotes or orders.
  assert.equal(((await runCommand(actor('worker'), { text: 'bu hafta geciken işler' })) as any).type, 'denied');
  assert.equal(((await runCommand(actor('worker'), { text: "Ahmet'e 3x4 pergola teklif" })) as any).type, 'denied');

  // Bar stock by colour.
  const [wh] = await db`INSERT INTO warehouses (tenant_id, code, name, warehouse_type) VALUES (${tenantId}, ${'RAW-' + tenantId.slice(0, 4)}, 'Hammadde', 'RAW') RETURNING id`;
  const [item] = await db`INSERT INTO inventory_items (tenant_id, name, sku, stock_uom) VALUES (${tenantId}, 'Taşıyıcı profil', ${'TP-' + tenantId.slice(0, 5)}, 'm') RETURNING id`;
  for (const [len, color] of [[6.5, '7016 Mat'], [6.5, 'RAL 7016'], [7, '7016'], [6.5, '9016']] as const)
    await db`INSERT INTO stock_lots (tenant_id, item_id, warehouse_id, lot_number, original_qty, remaining_qty, length_m, status, metadata)
      VALUES (${tenantId}, ${item.id}, ${wh.id}, ${'L-' + randomUUID().slice(0, 6)}, ${len}, ${len}, ${len}, 'available', ${JSON.stringify({ color })}::text::jsonb)`;
  const stock: any = await runCommand(owner, { text: '7016 mat kaç çubuk var' });
  assert.equal(stock.type, 'answer');
  assert.equal(stock.title, 'RAL 7016 Mat: 3 çubuk');
  assert.match(stock.lines[0].value, /2×6\.500 mm, 1×7\.000 mm/);

  // What-if: delay 2 days → preview → approve → new promise; expedite; cancel preview.
  const delay: any = await runCommand(owner, { text: `${late.order_number}'ye 2 gün ekle` });
  assert.equal(delay.type, 'preview');
  assert.ok(delay.lines.some((l: any) => l.label === 'Yeni termin'));
  await svc.decideSuggestion(owner, delay.suggestionId, { action: 'approve', expectedVersion: delay.version });
  const [after] = await db`SELECT promised_date FROM orders WHERE id = ${late.id}`;
  assert.equal(new Date(after.promised_date).toISOString().slice(0, 10), day(2));
  const exp: any = await runCommand(owner, { text: `${late.order_number}'yi öne al` });
  assert.equal(exp.type, 'preview');
  assert.match(exp.title, /öne alınırsa/);
  const cancel: any = await runCommand(owner, { text: `${late.order_number} iptal etsek ne olur` });
  assert.equal(cancel.type, 'preview');
  assert.match(cancel.title, /iptal edilirse/);
  assert.equal(((await runCommand(owner, { text: "ORD-YOK-999'u öne al" })) as any).type, 'need');

  // Review fixes: "ORD-12" never picks "ORD-112"; another person cannot approve a command preview;
  // an order changed after the preview, or one with open work orders, is not cancelled.
  const n = tenantId.slice(0, 4).replace(/\D/g, '7') || '7';
  const [o112] = await db`INSERT INTO orders (tenant_id, order_number, customer_name, status, total_amount, delivery_date) VALUES (${tenantId}, ${'ORD-' + n + '112'}, 'X', 'approved', 1, ${day(9)}) RETURNING id, order_number`;
  assert.equal(((await runCommand(owner, { text: `ORD-${n}12'yi iptal et` })) as any).type, 'need', 'a suffix is not the order');
  const cx: any = await runCommand(owner, { text: `${o112.order_number} iptal etsek ne olur` });
  assert.equal(cx.type, 'preview');
  assert.equal((await runCommand(owner, { text: `${o112.order_number} iptal etsek ne olur` }) as any).suggestionId, cx.suggestionId, 'the same command is one preview');
  await assert.rejects(svc.decideSuggestion(actor('office'), cx.suggestionId, { action: 'approve', expectedVersion: cx.version }), /komutu yazan|yetkiniz/);
  await db`UPDATE orders SET version = version + 1 WHERE id = ${o112.id}`;
  await assert.rejects(svc.decideSuggestion(owner, cx.suggestionId, { action: 'approve', expectedVersion: cx.version }), /önizlemeden sonra değişti/);
  const cy: any = await runCommand(owner, { text: `${o112.order_number} iptal etsek ne olur` });
  await db`INSERT INTO work_orders (tenant_id, order_id, title, status) VALUES (${tenantId}, ${o112.id}, 'Kesim', 'open')`;
  await assert.rejects(svc.decideSuggestion(owner, cy.suggestionId, { action: 'approve', expectedVersion: cy.version }), /açık iş emirleri/);
  assert.equal((await db`SELECT status FROM orders WHERE id = ${o112.id}`)[0].status, 'approved', 'nothing changed');
  // Units: a measure in mm stays mm.
  const mm: any = await runCommand(owner, { text: "Zeynep Arslan'a 3000x4000 pergola teklif 9016" });
  assert.equal(mm.lines[1].value, 'Pergola 3 × 4 m');

  // Read-only questions: one order's status, a customer's orders, deliveries by day, low stock.
  const [t1] = await db`INSERT INTO orders (tenant_id, order_number, customer_name, status, total_amount, delivery_date, product_name)
    VALUES (${tenantId}, ${'RF-' + n + '501'}, 'Kaya İnşaat', 'in_production', 8000, ${day(0)}, 'Zip perde') RETURNING id, order_number`;
  await db`INSERT INTO orders (tenant_id, order_number, customer_name, status, total_amount, delivery_date, product_name)
    VALUES (${tenantId}, ${'RF-' + n + '502'}, 'Kaya İnşaat', 'approved', 9000, ${day(1)}, 'Tente')`;
  await db`INSERT INTO work_orders (tenant_id, order_id, title, status) VALUES (${tenantId}, ${t1.id}, 'Kesim', 'done'), (${tenantId}, ${t1.id}, 'Montaj', 'open')`;
  const st: any = await runCommand(owner, { text: `${t1.order_number} nerede` });
  assert.equal(st.type, 'list');
  assert.equal(st.rows.length, 1);
  assert.equal(st.rows[0].href, `/orders/${t1.id}`);
  assert.deepEqual([st.rows[0].cells[1], st.rows[0].cells[4], st.rows[0].cells[5]], ['Kaya İnşaat', '0 gün', '1/2 iş emri bitti']);
  assert.match(st.title, /Üretimde/);
  assert.equal(((await runCommand(owner, { text: 'RF-0000 ne durumda' })) as any).type, 'need', 'an unknown order is said, not guessed');
  const co: any = await runCommand(owner, { text: "Kaya İnşaat'ın siparişleri" });
  assert.equal(co.type, 'list');
  assert.deepEqual(co.rows.map((r: any) => r.cells[0]).sort(), [t1.order_number, 'RF-' + n + '502']);
  const dToday: any = await runCommand(owner, { text: 'bugün teslimatlar' });
  assert.ok(dToday.rows.some((r: any) => r.cells[0] === t1.order_number));
  assert.ok(!dToday.rows.some((r: any) => r.cells[0] === 'RF-' + n + '502'));
  const dTomorrow: any = await runCommand(owner, { text: 'yarın teslimatlar' });
  assert.deepEqual(dTomorrow.rows.map((r: any) => r.cells[0]), ['RF-' + n + '502']);
  const [lowItem] = await db`INSERT INTO inventory_items (tenant_id, name, sku, stock_uom, min_stock) VALUES (${tenantId}, 'Vida M6', ${'VD-' + tenantId.slice(0, 5)}, 'adet', 100) RETURNING id`;
  await db`INSERT INTO stock_balances (tenant_id, item_id, warehouse_id, on_hand_qty) VALUES (${tenantId}, ${lowItem.id}, ${wh.id}, 30)`;
  const low: any = await runCommand(owner, { text: 'kritik stok' });
  assert.equal(low.type, 'list');
  assert.equal(low.rows.length, 1, 'only the item below its minimum');
  assert.equal(low.rows[0].cells[0], 'Vida M6');
  const [sup] = await db`INSERT INTO suppliers (tenant_id, name, is_active) VALUES (${tenantId}, 'Alüminyum A.Ş.', true) RETURNING id`;
  await db`INSERT INTO purchase_orders (tenant_id, supplier_id, purchase_order_number, status, expected_at) VALUES (${tenantId}, ${sup.id}, ${'PO-' + n + '1'}, 'submitted', ${day(-3)}), (${tenantId}, ${sup.id}, ${'PO-' + n + '2'}, 'received', ${day(-9)})`;
  const pur: any = await runCommand(owner, { text: 'yoldaki malzemeler' });
  assert.equal(pur.type, 'list');
  assert.deepEqual(pur.rows.map((r: any) => [r.cells[0], r.cells[3]]), [['PO-' + n + '1', '3 gün gecikti']], 'only what is still on its way');
  const inv: any = await runCommand(owner, { text: 'vadesi geçen faturalar' });
  assert.equal(inv.type, 'list', 'finance reads work for the owner even with no invoices');
  assert.equal(((await runCommand(actor('worker'), { text: 'vadesi geçen faturalar' })) as any).type, 'denied');
  // A worker may ask about stock but not about orders; a price-hiding role sees no amounts here either.
  assert.equal(((await runCommand(actor('worker'), { text: 'kritik stok' })) as any).type, 'list');
  assert.equal(((await runCommand(actor('worker'), { text: `${t1.order_number} nerede` })) as any).type, 'denied');
  await team.updateMember(owner as any, ids.office, { accessRole: priceHidden });
  access.forgetMemberAccess(ids.office, tenantId);
  assert.ok(!((await runCommand(actor('office'), { text: `${t1.order_number} nerede` })) as any).columns.includes('Tutar'));
  await team.updateMember(owner as any, ids.office, { accessRole: null });
  access.forgetMemberAccess(ids.office, tenantId);

  for (const t of ['purchase_orders', 'suppliers', 'stock_balances', 'stock_lots', 'warehouse_locations', 'warehouses', 'inventory_items', 'quotation_items', 'quotations', 'work_orders', 'orders', 'ai_suggestions'])
    await db`DELETE FROM ${db(t)} WHERE tenant_id = ${tenantId}`;
  await db`DELETE FROM tenants WHERE id = ${tenantId}`;
  await db`DELETE FROM users WHERE id = ANY(${Object.values(ids)}::uuid[])`;
  await db.end();
  await (sql as any).end?.();
  console.log('test:ai-commands OK');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
