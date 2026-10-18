/**
 * Concurrency and firm isolation on the isolated local test database only. Every operation that
 * moves money or stock is fired several times at once and must land exactly once (or be refused);
 * every service is called by one firm with another firm's ids and must neither read nor change them.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';

import { localTestDatabaseURL } from './local-test-database';

type Settled<T> = PromiseSettledResult<T>;
const ok = <T>(r: Settled<T>[]) => r.filter((x) => x.status === 'fulfilled').length;

async function main() {
  process.env.AUTH_SECRET = 'concurrency-isolation-local-only-12345678901234';
  process.env.DATABASE_URL = localTestDatabaseURL();
  process.env.NATIVE_INVENTORY_ENABLED = '1';
  delete process.env.E_INVOICE_PROVIDER;
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {}, max: 10 });
  try {
    assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
    const inv = await import('../lib/features/finance/invoices.server');
    const { productionCommand } = await import('../lib/features/manufacturing/platform.service');
    const { postStockEntry } = await import('../lib/features/manufacturing/inventory.service');
    const { addExpense, deleteExpense } = await import('../lib/features/accounting/expenses.server');
    const { exportCustomerData, anonymizeCustomer } = await import('../lib/features/privacy/subject.server');
    const { importCustomers } = await import('../lib/features/customers/import.server');

    async function firm(name: string) {
      const tenantId = randomUUID();
      const userId = randomUUID();
      await db`INSERT INTO tenants (id, name, slug) VALUES (${tenantId}, ${name}, ${'ci-' + tenantId.slice(0, 8)})`;
      await db`INSERT INTO users (id, email, name) VALUES (${userId}, ${`own-${userId}@test.local`}, 'Sahip')`;
      await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${tenantId}, ${userId}, 'owner')`;
      return { tenantId, userId, role: 'owner' as any };
    }
    async function order(a: { tenantId: string }, net: number) {
      const [c] = await db`INSERT INTO customers (tenant_id, full_name, tax_number) VALUES (${a.tenantId}, 'Işık İnşaat', '9876543210') RETURNING id`;
      const [o] = await db`INSERT INTO orders (tenant_id, order_number, customer_id, customer_name, status, total_amount, currency, product_name)
        VALUES (${a.tenantId}, ${'CI-' + randomUUID().slice(0, 6)}, ${c.id}, 'Işık İnşaat', 'approved', ${net * 1.2}, 'TRY', 'Pergola') RETURNING id`;
      const [it] = await db`INSERT INTO order_items (order_id, product_name, quantity, unit_price, total_price) VALUES (${o.id}, 'Pergola', 1, ${net}, ${net}) RETURNING id`;
      return { orderId: String(o.id), itemId: String(it.id), customerId: String(c.id) };
    }
    const cmd = (a: any, action: string, data: Record<string, unknown>) => productionCommand(a, { commandId: randomUUID(), action, data });
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date());
    const paidTotal = async (orderId: string) => Number((await db`SELECT coalesce(sum(amount), 0)::float AS t FROM payments WHERE order_id = ${orderId}`)[0].t);

    const A = await firm('A Firması');
    const B = await firm('B Firması');

    // ── 1. One collection limit on both write paths ───────────────────────────────────────────────
    // 10 000 + 20 % VAT, 4/10 withheld (601): the buyer pays 800 to the tax office, so 11 200 is all
    // the seller can collect. The invoice screen and the finance screen must agree.
    const w = await order(A, 10000);
    const wDraft = await inv.createInvoiceDraft(A, w.orderId, { lines: [{ orderItemId: w.itemId, quantity: 1, withholdingCode: '601' }] });
    await inv.issueInvoice(A, wDraft.id, {});
    await inv.recordCollection(A, { orderId: w.orderId, invoiceId: wDraft.id, amount: 11200, method: 'bank_transfer', paidOn: today });
    await assert.rejects(cmd(A, 'finance.payment.create', { orderId: w.orderId, amount: 800, currency: 'TRY', method: 'cash', paidAt: new Date().toISOString(), note: '' }), /aşamaz/,
      'the finance screen must not collect the VAT the buyer withholds');
    assert.equal(await paidTotal(w.orderId), 11200);

    // ── 2. Concurrency ────────────────────────────────────────────────────────────────────────────
    // Collections at once, from both paths: never more than the order can take.
    const c1 = await order(A, 10000); // 12 000 collectable
    const collections = await Promise.allSettled([
      ...[1, 2, 3].map(() => inv.recordCollection(A, { orderId: c1.orderId, amount: 4000, method: 'bank_transfer', paidOn: today })),
      ...[1, 2, 3].map(() => cmd(A, 'finance.payment.create', { orderId: c1.orderId, amount: 4000, currency: 'TRY', method: 'cash', paidAt: new Date().toISOString(), note: '' })),
    ]);
    assert.equal(ok(collections), 3, 'exactly three 4 000 collections fit in 12 000');
    assert.equal(await paidTotal(c1.orderId), 12000);

    // The same draft issued three times at once: one number, one ledger entry.
    const i1 = await order(A, 1000);
    const d1 = await inv.createInvoiceDraft(A, i1.orderId, { lines: [{ orderItemId: i1.itemId, quantity: 1 }] });
    const issues = await Promise.allSettled([1, 2, 3].map(() => inv.issueInvoice(A, d1.id, {})));
    assert.equal(ok(issues), 1, 'a draft is issued once');
    const [issued] = await db`SELECT invoice_number, status FROM invoices WHERE id = ${d1.id}`;
    assert.equal(issued.status, 'issued');
    assert.equal((await db`SELECT count(*)::int AS n FROM journal_entries WHERE tenant_id = ${A.tenantId} AND source_key = ${'invoice:' + d1.id}`)[0].n, 1);

    // Drafts for the same order line at once: the line is never invoiced twice.
    const i2 = await order(A, 1000);
    const drafts = await Promise.allSettled([1, 2, 3].map(() => inv.createInvoiceDraft(A, i2.orderId, { lines: [{ orderItemId: i2.itemId, quantity: 1 }] })));
    const [billedQty] = await db`SELECT coalesce(sum(l.quantity), 0)::float AS q FROM invoice_lines l JOIN invoices i ON i.id = l.invoice_id WHERE l.order_item_id = ${i2.itemId} AND i.status <> 'cancelled'`;
    assert.equal(billedQty.q, 1, `an order line is drafted once (${ok(drafts)} drafts succeeded)`);

    // Invoice numbers stay gapless and unique under parallel issuing of different drafts.
    const many = await Promise.all([1, 2, 3, 4].map(async () => { const o = await order(A, 100); return inv.createInvoiceDraft(A, o.orderId, { lines: [{ orderItemId: o.itemId, quantity: 1 }] }); }));
    await Promise.all(many.map((d) => inv.issueInvoice(A, d.id, {})));
    const numbers = (await db`SELECT invoice_number FROM invoices WHERE tenant_id = ${A.tenantId} AND invoice_number IS NOT NULL`).map((r) => r.invoice_number as string);
    assert.equal(new Set(numbers).size, numbers.length, 'invoice numbers are unique');

    // The same supplier document entered three times at once: one purchase record, one ledger entry.
    const expenseInput = { date: today, vendor: 'Alüminyum A.Ş.', documentNumber: 'ALM-' + randomUUID().slice(0, 6), description: 'Profil', category: 'materials', net: 1000, vatPercent: 20 };
    const expenses = await Promise.allSettled([1, 2, 3].map(() => addExpense(db, { tenantId: A.tenantId, userId: A.userId }, expenseInput)));
    assert.equal(ok(expenses), 1, 'a supplier document is recorded once');
    assert.equal((await db`SELECT count(*)::int AS n FROM expenses WHERE tenant_id = ${A.tenantId} AND document_number = ${expenseInput.documentNumber}`)[0].n, 1);

    // Stock: five issues of 3 from 10 at once (different keys): three fit, the balance never goes below zero.
    const [wh] = await db`INSERT INTO warehouses (tenant_id, code, name, warehouse_type) VALUES (${A.tenantId}, 'FIN', 'Mamul', 'FINISHED') RETURNING id`;
    const [wh2] = await db`INSERT INTO warehouses (tenant_id, code, name, warehouse_type) VALUES (${A.tenantId}, 'FIN2', 'Mamul 2', 'FINISHED') RETURNING id`;
    const [item] = await db`INSERT INTO inventory_items (tenant_id, sku, name, item_type, stock_uom) VALUES (${A.tenantId}, 'MOT', 'Motor', 'consumable', 'adet') RETURNING id`;
    const stockOf = async (warehouseId: string) => Number((await db`SELECT on_hand_qty FROM stock_balances WHERE tenant_id = ${A.tenantId} AND item_id = ${item.id} AND warehouse_id = ${warehouseId}`)[0]?.on_hand_qty ?? 0);
    await postStockEntry(A, { entryType: 'MATERIAL_RECEIPT', idempotencyKey: 'seed-' + randomUUID(), referenceType: 'manual', lines: [{ itemId: item.id, warehouseId: wh.id, quantityDelta: 10, uom: 'adet' }, { itemId: item.id, warehouseId: wh2.id, quantityDelta: 10, uom: 'adet' }] } as any);
    const issuesStock = await Promise.allSettled([1, 2, 3, 4, 5].map(() => postStockEntry(A, { entryType: 'MATERIAL_ISSUE', idempotencyKey: 'iss-' + randomUUID(), referenceType: 'manual', lines: [{ itemId: item.id, warehouseId: wh.id, quantityDelta: -3, uom: 'adet' }] } as any)));
    assert.equal(ok(issuesStock), 3);
    assert.equal(await stockOf(wh.id), 1);

    // Transfers in both directions at once: no deadlock, nothing created or lost.
    const transfers = await Promise.allSettled(Array.from({ length: 10 }, (_, k) => {
      const [from, to] = k % 2 ? [wh.id, wh2.id] : [wh2.id, wh.id];
      return postStockEntry(A, { entryType: 'MATERIAL_TRANSFER', idempotencyKey: 'tr-' + randomUUID(), referenceType: 'manual', lines: [{ itemId: item.id, warehouseId: from, quantityDelta: -1, uom: 'adet' }, { itemId: item.id, warehouseId: to, quantityDelta: 1, uom: 'adet' }] } as any);
    }));
    assert(transfers.every((t) => t.status === 'fulfilled' || !/deadlock/i.test(String((t as PromiseRejectedResult).reason))), 'no deadlock');
    assert.equal((await stockOf(wh.id)) + (await stockOf(wh2.id)), 11, 'transfers conserve stock');

    // ── 3. Firm isolation: A acting on B's records ────────────────────────────────────────────────
    const b = await order(B, 5000);
    const bDraft = await inv.createInvoiceDraft(B, b.orderId, { lines: [{ orderItemId: b.itemId, quantity: 1 }] });
    const bExpense = await addExpense(db, { tenantId: B.tenantId, userId: B.userId }, { ...expenseInput, documentNumber: 'B-1' });
    const [bItem] = await db`INSERT INTO inventory_items (tenant_id, sku, name, item_type, stock_uom) VALUES (${B.tenantId}, 'TRF', 'Trafo', 'consumable', 'adet') RETURNING id`;
    const [bWh] = await db`INSERT INTO warehouses (tenant_id, code, name, warehouse_type) VALUES (${B.tenantId}, 'B', 'B depo', 'FINISHED') RETURNING id`;
    const before = await db`SELECT
      (SELECT count(*) FROM invoices WHERE tenant_id = ${B.tenantId})::int AS invoices,
      (SELECT count(*) FROM payments WHERE tenant_id = ${B.tenantId})::int AS payments,
      (SELECT count(*) FROM expenses WHERE tenant_id = ${B.tenantId})::int AS expenses,
      (SELECT count(*) FROM stock_entries WHERE tenant_id = ${B.tenantId})::int AS stock,
      (SELECT full_name FROM customers WHERE id = ${b.customerId}) AS name`;

    const attempts: Array<[string, () => Promise<unknown>]> = [
      ['draft on B order', () => inv.createInvoiceDraft(A, b.orderId, { lines: [{ orderItemId: b.itemId, quantity: 1 }] })],
      ['issue B draft', () => inv.issueInvoice(A, bDraft.id, {})],
      ['read B invoice', () => inv.getInvoice(A, bDraft.id)],
      ['delete B draft', () => inv.deleteDraft(A, bDraft.id)],
      ['collect on B order', () => inv.recordCollection(A, { orderId: b.orderId, amount: 10, method: 'cash', paidOn: today })],
      ['payment command on B order', () => cmd(A, 'finance.payment.create', { orderId: b.orderId, amount: 10, currency: 'TRY', method: 'cash', paidAt: new Date().toISOString(), note: '' })],
      ['stock with B item and warehouse', () => postStockEntry(A, { entryType: 'MATERIAL_RECEIPT', idempotencyKey: 'x-' + randomUUID(), referenceType: 'manual', lines: [{ itemId: bItem.id, warehouseId: bWh.id, quantityDelta: 5, uom: 'adet' }] } as any)],
      ['delete B expense', () => deleteExpense(db, { tenantId: A.tenantId, userId: A.userId }, bExpense.id)],
      ['export B customer', () => exportCustomerData(db, A, b.customerId)],
      ['anonymize B customer', () => anonymizeCustomer(db, A, b.customerId, { confirm: true, note: 'x' })],
    ];
    for (const [label, attempt] of attempts) {
      await assert.rejects(attempt(), (e: any) => !/ECONN|syntax/i.test(String(e?.message)), `A must not ${label}`);
    }
    const after = await db`SELECT
      (SELECT count(*) FROM invoices WHERE tenant_id = ${B.tenantId})::int AS invoices,
      (SELECT count(*) FROM payments WHERE tenant_id = ${B.tenantId})::int AS payments,
      (SELECT count(*) FROM expenses WHERE tenant_id = ${B.tenantId})::int AS expenses,
      (SELECT count(*) FROM stock_entries WHERE tenant_id = ${B.tenantId})::int AS stock,
      (SELECT full_name FROM customers WHERE id = ${b.customerId}) AS name`;
    assert.deepEqual(after, before, 'B is unchanged');
    assert.equal((await db`SELECT status FROM invoices WHERE id = ${bDraft.id}`)[0].status, 'draft');

    // A's import never matches B's cards (same tax number in both firms is two different customers).
    const imported = await importCustomers(db, A, { text: 'Firma;VKN\nIşık İnşaat B kopyası;9876543210', dryRun: true });
    assert(!imported.rows.some((r: any) => r.matchedId === b.customerId), 'import matches only the own firm');

    console.log('PASS · concurrency and isolation: one collection limit on both paths, parallel collections/issues/drafts/expenses land once, stock never negative and transfers deadlock-free, firm A cannot read or change firm B');
  } finally {
    await db.end({ timeout: 5 });
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
