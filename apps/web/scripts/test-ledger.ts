/**
 * Automatic ledger on the isolated local test database only: sales (with and without withholding),
 * collections from both write paths, cancellation and deleted-collection reversals, idempotent
 * re-sync, a balanced trial balance, VAT rows, closed periods and foreign currency without a rate.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';

import { localTestDatabaseURL } from './local-test-database';

async function main() {
  process.env.AUTH_SECRET = 'ledger-integration-local-only-12345678901234567';
  process.env.DATABASE_URL = localTestDatabaseURL();
  delete process.env.E_INVOICE_PROVIDER;
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  try {
    assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
    const inv = await import('../lib/features/finance/invoices.server');
    const { syncLedger } = await import('../lib/features/accounting/posting.server');
    const { productionCommand } = await import('../lib/features/manufacturing/platform.service');

    const tenantId = randomUUID();
    const accId = randomUUID();
    await db`INSERT INTO tenants (id, name, slug) VALUES (${tenantId}, 'Defter Test', ${'led-' + tenantId.slice(0, 8)})`;
    await db`INSERT INTO users (id, email, name) VALUES (${accId}, ${`acc-${accId}@test.local`}, 'Muhasebe')`;
    await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${tenantId}, ${accId}, 'accountant')`;
    const acc = { tenantId, userId: accId, role: 'accountant' as any };
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date());
    const period = today.slice(0, 7);

    async function order(amount: number, currency = 'TRY') {
      const [c] = await db`INSERT INTO customers (tenant_id, full_name, tax_number) VALUES (${tenantId}, 'Işık İnşaat', '9876543210') RETURNING id`;
      const [o] = await db`INSERT INTO orders (tenant_id, order_number, customer_id, customer_name, status, total_amount, currency, product_name)
        VALUES (${tenantId}, ${'L-' + randomUUID().slice(0, 6)}, ${c.id}, 'Işık İnşaat', 'approved', ${amount * 1.2}, ${currency}, 'Pergola') RETURNING id`;
      const [it] = await db`INSERT INTO order_items (order_id, product_name, quantity, unit_price, total_price) VALUES (${o.id}, 'Pergola', 1, ${amount}, ${amount}) RETURNING id`;
      return { orderId: String(o.id), itemId: String(it.id) };
    }
    const entries = async (sourcePrefix: string) => db`
      SELECT j.entry_number, j.source_key, a.code, l.debit::float AS debit, l.credit::float AS credit
      FROM journal_entries j JOIN journal_entry_lines l ON l.journal_entry_id = j.id JOIN accounts a ON a.id = l.account_id
      WHERE j.tenant_id = ${tenantId} AND j.source_key LIKE ${sourcePrefix + '%'} ORDER BY j.created_at, l.line_no`;
    const byAccount = (rows: any[]) => Object.fromEntries(rows.map((r) => [r.code, r.debit || -r.credit]));

    // Sale: 120 / 600 / 391, booked in the issuing transaction.
    const a = await order(10000);
    const d1 = await inv.createInvoiceDraft(acc, a.orderId, { lines: [{ orderItemId: a.itemId, quantity: 1 }] });
    await inv.issueInvoice(acc, d1.id, {});
    assert.deepEqual(byAccount(await entries(`invoice:${d1.id}`)), { 120: 12000, 600: -10000, 391: -2000 });
    const [chart] = await db`SELECT count(*)::int AS n FROM accounts WHERE tenant_id = ${tenantId}`;
    assert(chart.n >= 13, 'Tekdüzen accounts are created');

    // Sale with 601 withholding: 391 only gets the VAT the seller collects.
    const b = await order(10000);
    const d2 = await inv.createInvoiceDraft(acc, b.orderId, { lines: [{ orderItemId: b.itemId, quantity: 1, withholdingCode: '601' }] });
    await inv.issueInvoice(acc, d2.id, {});
    assert.deepEqual(byAccount(await entries(`invoice:${d2.id}`)), { 120: 11200, 600: -10000, 391: -1200 });

    // Collection through the invoice screen (bank) and through the production command (cash).
    await inv.recordCollection(acc, { orderId: a.orderId, invoiceId: d1.id, amount: 5000, method: 'bank_transfer', paidOn: today });
    const [p1] = await db`SELECT id FROM payments WHERE order_id = ${a.orderId}`;
    assert.deepEqual(byAccount(await entries(`payment:${p1.id}`)), { 102: 5000, 120: -5000 });
    const owner = randomUUID();
    await db`INSERT INTO users (id, email, name) VALUES (${owner}, ${`own-${owner}@test.local`}, 'Sahip')`;
    await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${tenantId}, ${owner}, 'owner')`;
    const cash = await productionCommand({ tenantId, userId: owner, role: 'owner' } as any, { commandId: randomUUID(), action: 'finance.payment.create', data: { orderId: b.orderId, amount: 3000, currency: 'TRY', method: 'cash', paidAt: new Date().toISOString(), note: '' } });
    assert.deepEqual(byAccount(await entries(`payment:${(cash as any).id}`)), { 100: 3000, 120: -3000 });

    // Cancelling an invoice books the mirror entry and negative VAT.
    const c = await order(1000);
    const d3 = await inv.createInvoiceDraft(acc, c.orderId, { lines: [{ orderItemId: c.itemId, quantity: 1 }] });
    await inv.issueInvoice(acc, d3.id, {});
    await inv.cancelInvoice(acc, d3.id, { reason: 'müşteri vazgeçti' });
    assert.deepEqual(byAccount(await entries(`invoice-cancel:${d3.id}`)), { 120: -1200, 600: 1000, 391: 200 });
    const [vat] = await db`SELECT coalesce(sum(tax_amount), 0)::float AS t FROM tax_transactions WHERE tenant_id = ${tenantId} AND tax_type = 'vat' AND related_invoice_id = ${d3.id}`;
    assert.equal(vat.t, 0, 'the cancelled invoice nets to zero VAT');

    // A deleted collection is reversed by the next sync (the original entry stays).
    await db`DELETE FROM payments WHERE id = ${p1.id}`;
    const afterDelete = await syncLedger(db, tenantId);
    assert.equal(afterDelete.posted, 1);
    assert.deepEqual(byAccount(await entries(`payment-delete:${p1.id}`)), { 102: -5000, 120: 5000 });

    // Running it again books nothing.
    assert.deepEqual(await syncLedger(db, tenantId), { posted: 0, skippedClosed: 0, awaitingRate: 0, failed: 0 });

    // The trial balance balances and 120 is what customers still owe.
    const tb = await db`
      SELECT a.code, sum(l.debit)::float AS debit, sum(l.credit)::float AS credit FROM journal_entries j
      JOIN journal_entry_lines l ON l.journal_entry_id = j.id JOIN accounts a ON a.id = l.account_id
      WHERE j.tenant_id = ${tenantId} AND j.period = ${period} GROUP BY a.code`;
    const debit = tb.reduce((s, r) => s + r.debit, 0);
    const credit = tb.reduce((s, r) => s + r.credit, 0);
    assert(Math.abs(debit - credit) < 0.005, 'trial balance balances');
    const receivable = tb.find((r) => r.code === '120')!;
    assert.equal(Math.round((receivable.debit - receivable.credit) * 100) / 100, 12000 + 11200 - 3000, '120 = invoices due − cash collected (bank collection was deleted)');
    const [output] = await db`SELECT coalesce(sum(tax_amount), 0)::float AS t FROM tax_transactions WHERE tenant_id = ${tenantId} AND tax_type = 'vat' AND type = 'output'`;
    assert.equal(output.t, 2000 + 1200, 'output VAT = collected VAT of the live invoices');
    const [withheld] = await db`SELECT coalesce(sum(tax_amount), 0)::float AS t FROM tax_transactions WHERE tenant_id = ${tenantId} AND tax_type = 'withholding'`;
    assert.equal(withheld.t, 800);

    // A collection in a hard-closed period waits; foreign currency without a rate waits.
    const last = new Date(); last.setMonth(last.getMonth() - 2);
    const closed = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(last).slice(0, 7);
    await db`INSERT INTO accounting_period_closes (tenant_id, period, status) VALUES (${tenantId}, ${closed}, 'hard_closed')`;
    await db`INSERT INTO payments (tenant_id, order_id, amount, currency, method, paid_at) VALUES (${tenantId}, ${b.orderId}, 100, 'TRY', 'cash', ${`${closed}-15T12:00:00+03:00`})`;
    // An older foreign-currency invoice issued without a rate waits for one.
    const [legacy] = await db`INSERT INTO invoices (tenant_id, invoice_number, order_id, customer_name, status, issued_on, due_on, currency, subtotal, vat_total, total)
      VALUES (${tenantId}, 'ESKI-GBP-1', ${b.orderId}, 'UK Ltd', 'issued', ${today}, ${today}, 'GBP', 100, 20, 120) RETURNING id`;
    const pending = await syncLedger(db, tenantId);
    assert.deepEqual([pending.posted, pending.skippedClosed, pending.awaitingRate], [0, 1, 1]);
    await db`UPDATE invoices SET exchange_rate = 60 WHERE id = ${legacy.id}`;
    assert.equal((await syncLedger(db, tenantId)).posted, 1);
    assert.deepEqual(byAccount(await entries(`invoice:${legacy.id}`)), { 120: 7200, 600: -6000, 391: -1200 });

    // A new EUR invoice takes the TCMB rate in force on its date when issued (stored bulletin of the
    // day before, so no network) and is booked in TRY at once.
    const yesterday = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date(Date.now() - 86_400_000));
    await db`INSERT INTO exchange_rates (bulletin_date, currency, forex_buying) VALUES (${yesterday}, 'EUR', 50) ON CONFLICT (bulletin_date, currency) DO UPDATE SET forex_buying = 50`;
    const eur = await order(1000, 'EUR');
    const d4 = await inv.createInvoiceDraft(acc, eur.orderId, { lines: [{ orderItemId: eur.itemId, quantity: 1 }] });
    await inv.issueInvoice(acc, d4.id, {});
    assert.equal(Number((await db`SELECT exchange_rate FROM invoices WHERE id = ${d4.id}`)[0].exchange_rate), 50);
    assert.deepEqual(byAccount(await entries(`invoice:${d4.id}`)), { 120: 60000, 600: -50000, 391: -10000 });

    // An account with entries cannot be deleted on its own (checked at commit, so a firm-wide
    // cascade still works: test-finance deletes its firm with a ledger).
    await assert.rejects(db.begin((tx) => tx`DELETE FROM accounts WHERE tenant_id = ${tenantId} AND code = '120'`), /violates foreign key/);
    const [fk] = await db`SELECT condeferrable, condeferred FROM pg_constraint WHERE conname = 'journal_entry_lines_account_id_fkey'`;
    assert.deepEqual([fk.condeferrable, fk.condeferred], [true, true]);

    console.log('PASS · ledger: 120/600/391 sale, 601 withholding keeps 391 at collected VAT, bank and cash collections from both paths, cancel and deleted-collection reversals, idempotent re-sync, balanced trial balance, VAT rows net, closed period and a legacy invoice without a rate wait, a new EUR invoice is stamped with the TCMB rate and booked at once; account with entries protected, firm deletion cascades');
  } finally {
    await db.end({ timeout: 5 });
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
