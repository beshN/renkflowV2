/**
 * VAT period summary on the isolated local test database only: real invoices (plain, withheld,
 * exempt, cancelled) and purchase records give the summary the accountant files from; it matches
 * the ledger's 391 account, carries deductible VAT forward, and purchase records respect duplicate
 * document numbers and closed periods, and purchase records are booked (150/770 + 191 / 320) and
 * reversed when deleted.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';

import { localTestDatabaseURL } from './local-test-database';

async function main() {
  process.env.AUTH_SECRET = 'vat-integration-local-only-1234567890123456789';
  process.env.DATABASE_URL = localTestDatabaseURL();
  delete process.env.E_INVOICE_PROVIDER;
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  try {
    assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
    const inv = await import('../lib/features/finance/invoices.server');
    const { loadVatReturn } = await import('../lib/features/accounting/vat-return.server');
    const { addExpense, deleteExpense, listExpenses } = await import('../lib/features/accounting/expenses.server');

    const tenantId = randomUUID();
    const userId = randomUUID();
    await db`INSERT INTO tenants (id, name, slug) VALUES (${tenantId}, 'KDV Test', ${'vat-' + tenantId.slice(0, 8)})`;
    await db`INSERT INTO users (id, email, name) VALUES (${userId}, ${`acc-${userId}@test.local`}, 'Muhasebe')`;
    await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${tenantId}, ${userId}, 'accountant')`;
    const acc = { tenantId, userId, role: 'accountant' as any };
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date());
    const period = today.slice(0, 7);
    const [py, pm] = period.split('-').map(Number);
    const previous = pm === 1 ? `${py - 1}-12` : `${py}-${String(pm - 1).padStart(2, '0')}`;

    async function invoice(amount: number, line: Record<string, unknown> = {}) {
      const [c] = await db`INSERT INTO customers (tenant_id, full_name, tax_number) VALUES (${tenantId}, 'Işık İnşaat', '9876543210') RETURNING id`;
      const [o] = await db`INSERT INTO orders (tenant_id, order_number, customer_id, customer_name, status, total_amount, currency, product_name)
        VALUES (${tenantId}, ${'K-' + randomUUID().slice(0, 6)}, ${c.id}, 'Işık İnşaat', 'approved', ${amount * 1.2}, 'TRY', 'Pergola') RETURNING id`;
      const [it] = await db`INSERT INTO order_items (order_id, product_name, quantity, unit_price, total_price) VALUES (${o.id}, 'Pergola', 1, ${amount}, ${amount}) RETURNING id`;
      const draft = await inv.createInvoiceDraft(acc, String(o.id), { lines: [{ orderItemId: String(it.id), quantity: 1, ...line }] });
      await inv.issueInvoice(acc, draft.id, {});
      return draft.id;
    }

    // Previous month: a small sale and a large purchase, so deductible VAT carries into this month.
    const old = await invoice(1000);
    await db`UPDATE invoices SET issued_on = ${previous + '-15'}, due_on = ${previous + '-28'} WHERE id = ${old}`;
    await addExpense(db, { tenantId, userId }, { date: `${previous}-10`, vendor: 'Alüminyum A.Ş.', documentNumber: 'ALM2026000000001', description: 'Profil', category: 'materials', net: 5000, vatPercent: 20 });
    const before = await loadVatReturn(db, tenantId, previous);
    assert.deepEqual([before.output.vat, before.input.vat, before.carryForward], [200, 1000, 800]);

    // This month: 20% sale, 7/10 withheld sale (603), a cancelled sale, purchases at 20% and 10%.
    await invoice(10000);
    await invoice(10000, { withholdingCode: '603' });
    const cancelled = await invoice(2000);
    await inv.cancelInvoice(acc, cancelled, { reason: 'müşteri vazgeçti' });
    await addExpense(db, { tenantId, userId }, { date: `${period}-01`, vendor: 'Cam Ltd.', documentNumber: 'CAM1', description: 'Cam', category: 'materials', net: 3000, vatPercent: 20 });
    await addExpense(db, { tenantId, userId }, { date: `${period}-01`, vendor: 'Lokanta', description: 'Yemek', category: 'other', net: 100, vatPercent: 10, deductible: false });
    await addExpense(db, { tenantId, userId }, { date: `${period}-01`, vendor: 'Kırtasiye', description: 'Kağıt', category: 'office', net: 250, vatPercent: 10 });

    const v = await loadVatReturn(db, tenantId, period);
    assert.deepEqual(v.sales, [{ vatPercent: 20, base: 10000, vat: 2000 }], 'the cancelled sale nets out in its own month');
    assert.equal(v.withheld.length, 1);
    assert.deepEqual([v.withheld[0].code, v.withheld[0].base, v.withheld[0].vat, v.withheld[0].withheld, v.withheld[0].payable], ['603', 10000, 2000, 1400, 600]);
    assert.deepEqual(v.output, { base: 20000, vat: 2600, withheld: 1400 });
    assert.deepEqual(v.input.byRate, [{ vatPercent: 20, base: 3000, vat: 600 }, { vatPercent: 10, base: 250, vat: 25 }]);
    assert.equal(v.carryIn, 800);
    assert.deepEqual([v.net, v.payable, v.carryForward], [1175, 1175, 0]);
    assert(v.notes.some((n) => n.includes('indirilemez')), 'the non-deductible expense is explained');

    // The summary's output VAT is exactly what the ledger booked to 391 this month.
    const [ledger] = await db`
      SELECT coalesce(sum(l.credit - l.debit), 0)::float AS vat FROM journal_entries j
      JOIN journal_entry_lines l ON l.journal_entry_id = j.id JOIN accounts a ON a.id = l.account_id
      WHERE j.tenant_id = ${tenantId} AND j.period = ${period} AND a.code = '391'
        AND j.source_key IS DISTINCT FROM ${'invoice:' + old}`; // moved to last month by hand above, booked this month
    assert.equal(ledger.vat, v.output.vat, '391 matches the summary');

    // Purchase records are booked too: 191 holds exactly the deductible VAT of the month, material
    // purchases go to 150 (stock), the non-deductible meal goes to 770 with its VAT.
    const balance = async (code: string, p = period) => Number((await db`
      SELECT coalesce(sum(l.debit - l.credit), 0)::float AS b FROM journal_entries j
      JOIN journal_entry_lines l ON l.journal_entry_id = j.id JOIN accounts a ON a.id = l.account_id
      WHERE j.tenant_id = ${tenantId} AND j.period = ${p} AND a.code = ${code}`)[0].b);
    assert.equal(await balance('191'), v.input.vat, '191 matches deductible VAT');
    assert.equal(await balance('191', previous), before.input.vat, '191 of last month');
    assert.equal(await balance('150'), 3000);
    assert.equal(await balance('770'), 110 + 250);
    assert.equal(await balance('320'), -(3600 + 110 + 275));

    // Purchase records: duplicate document numbers are refused, closed periods are refused, deletes are audited.
    await assert.rejects(addExpense(db, { tenantId, userId }, { date: `${period}-02`, vendor: 'cam ltd.', documentNumber: 'CAM1', description: 'Tekrar', category: 'materials', net: 1, vatPercent: 20 }), /aynı numaralı/);
    await assert.rejects(addExpense(db, { tenantId, userId }, { date: `${period}-02`, vendor: 'X', description: 'Y', category: 'materials', net: 1, vatPercent: 18 }), /KDV oranı/);
    await db`INSERT INTO accounting_period_closes (tenant_id, period, status) VALUES (${tenantId}, ${previous}, 'hard_closed')`;
    await assert.rejects(addExpense(db, { tenantId, userId }, { date: `${previous}-20`, vendor: 'X', description: 'Y', category: 'materials', net: 1, vatPercent: 20 }), /hard close/);
    const listed = await listExpenses(db, tenantId, period);
    assert.equal(listed.length, 3);
    assert.deepEqual(listed.find((x) => x.documentNumber === 'CAM1')!.vat, 600);
    const office = listed.find((x) => x.vendor === 'Kırtasiye')!;
    await deleteExpense(db, { tenantId, userId }, office.id);
    assert.equal((await loadVatReturn(db, tenantId, period)).input.vat, 600);
    assert.equal(await balance('191'), 600, 'the deleted record is reversed in the ledger');
    const [reversal] = await db`SELECT count(*)::int AS n FROM journal_entries WHERE tenant_id = ${tenantId} AND source_key = ${'expense-delete:' + office.id}`;
    assert.equal(reversal.n, 1);
    const { syncLedger } = await import('../lib/features/accounting/posting.server');
    const again = await syncLedger(db, tenantId);
    assert.equal(again.posted, 0, 're-sync books nothing twice');
    const [audit] = await db`SELECT count(*)::int AS n FROM activity_logs WHERE tenant_id = ${tenantId} AND entity_type = 'expense' AND action = 'deleted'`;
    assert.equal(audit.n, 1);

    // Another firm sees none of it.
    const other = randomUUID();
    await db`INSERT INTO tenants (id, name, slug) VALUES (${other}, 'Başka', ${'vat-' + other.slice(0, 8)})`;
    const empty = await loadVatReturn(db, other, period);
    assert.deepEqual([empty.output.vat, empty.input.vat, empty.carryIn], [0, 0, 0]);

    console.log('PASS · VAT summary: sales by rate, partial withholding, same-month cancellation, deductible VAT by rate with carry-forward, matches ledger 391; purchase records refuse duplicates and closed periods, deletes audited, tenant isolated');
  } finally {
    await db.end({ timeout: 5 });
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
