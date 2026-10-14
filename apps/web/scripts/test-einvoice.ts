/**
 * e-Belge core on the isolated local test database only: the firm's legal identity (validated,
 * audited), gap-free GİB numbering under concurrency and rollback, withholding on a real draft,
 * and receivables owed after withholding.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';

import { localTestDatabaseURL } from './local-test-database';

async function main() {
  process.env.AUTH_SECRET = 'einvoice-integration-local-only-1234567890123';
  process.env.DATABASE_URL = localTestDatabaseURL();
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {}, max: 4 });
  try {
    assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');

    const identity = await import('../lib/features/einvoice/identity.server');
    const { nextSeriesNumber } = await import('../lib/features/einvoice/numbering');
    const inv = await import('../lib/features/finance/invoices.server');
    const rec = await import('../lib/features/finance/receivables.server');

    const tenantId = randomUUID();
    const ownerId = randomUUID();
    const accountantId = randomUUID();
    await db`INSERT INTO tenants (id, name, slug) VALUES (${tenantId}, 'e-Belge Test', ${'eb-' + tenantId.slice(0, 8)})`;
    for (const [id, role] of [[ownerId, 'owner'], [accountantId, 'accountant']]) {
      await db`INSERT INTO users (id, email, name) VALUES (${id}, ${`${role}-${id}@test.local`}, ${role})`;
      await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${tenantId}, ${id}, ${role})`;
    }

    // --- Legal identity ------------------------------------------------------------------------
    const before = await identity.getLegalIdentity(db, tenantId);
    assert(before, 'migration 053 is applied');
    assert.equal(before.legalName, 'e-Belge Test', 'falls back to the firm name');
    assert.deepEqual([before.eFaturaPrefix, before.eArsivPrefix], ['RNK', 'RNA']);
    const valid = {
      legalName: 'Renk Alüminyum San. ve Tic. Ltd. Şti.', taxNumber: '1234567890', taxOffice: 'Gebze', addressLine: 'OSB 5. Cad. No: 12',
      district: 'Gebze', city: 'Kocaeli', postalCode: '41400', mersisNo: '', tradeRegistryNo: '', phone: '', invoiceEmail: 'fatura@renk.com.tr',
      iban: 'TR33 0006 1005 1978 6457 8413 26', eFaturaPrefix: 'rnk', eArsivPrefix: 'RNA',
    };
    const owner = { tenantId, userId: ownerId };
    await assert.rejects(identity.saveLegalIdentity(db, owner, { ...valid, iban: 'TR33 0006 1005 1978 6457 8413 27' }), /IBAN/);
    await assert.rejects(identity.saveLegalIdentity(db, owner, { ...valid, taxNumber: '10000000147' }), /VKN 10 haneli/);
    await assert.rejects(identity.saveLegalIdentity(db, owner, { ...valid, eArsivPrefix: 'RNK' }), /farklı olmalı/);
    const saved = await identity.saveLegalIdentity(db, owner, valid);
    assert.equal(saved.eFaturaPrefix, 'RNK', 'prefix is upper-cased');
    assert.equal(saved.iban, 'TR330006100519786457841326', 'IBAN is stored without spaces');
    assert.equal(saved.mersisNo, '', 'empty optional fields stay empty');
    const [audit] = await db`SELECT changes FROM activity_logs WHERE tenant_id = ${tenantId} AND action = 'legal_identity_updated'`;
    assert.equal(audit.changes.tax_number.to, '1234567890');

    // --- Numbering -----------------------------------------------------------------------------
    // Parallel issues get distinct, consecutive numbers.
    const parallel = await Promise.all(Array.from({ length: 5 }, () => db.begin((tx) => nextSeriesNumber(tx, tenantId, 'RNK', 2026))));
    assert.deepEqual([...parallel].sort(), ['RNK2026000000001', 'RNK2026000000002', 'RNK2026000000003', 'RNK2026000000004', 'RNK2026000000005']);
    // A rolled-back issue gives its number back: no gap.
    await assert.rejects(db.begin(async (tx) => { await nextSeriesNumber(tx, tenantId, 'RNK', 2026); throw new Error('rollback'); }), /rollback/);
    assert.equal(await db.begin((tx) => nextSeriesNumber(tx, tenantId, 'RNK', 2026)), 'RNK2026000000006');
    // Each year and each series counts on its own.
    assert.equal(await db.begin((tx) => nextSeriesNumber(tx, tenantId, 'RNK', 2027)), 'RNK2027000000001');
    assert.equal(await db.begin((tx) => nextSeriesNumber(tx, tenantId, 'RNA', 2026)), 'RNA2026000000001');

    // --- Withholding on a real draft and in receivables --------------------------------------
    const [customer] = await db`INSERT INTO customers (tenant_id, full_name, company_name, tax_number, payment_terms) VALUES (${tenantId}, 'Ali Işık', 'Işık İnşaat', '9876543210', 30) RETURNING id`;
    const [order] = await db`INSERT INTO orders (tenant_id, order_number, customer_id, customer_name, status, total_amount, currency, product_name)
      VALUES (${tenantId}, ${'ORD-EB-' + tenantId.slice(0, 6)}, ${customer.id}, 'Işık İnşaat', 'approved', 12000, 'TRY', 'Pergola') RETURNING id`;
    const [item] = await db`INSERT INTO order_items (order_id, product_name, quantity, unit_price, total_price) VALUES (${order.id}, 'Pergola montajı', 1, 10000, 10000) RETURNING id`;
    const acc = { tenantId, userId: accountantId, role: 'accountant' as any };

    await assert.rejects(inv.createInvoiceDraft(acc, String(order.id), { lines: [{ orderItemId: item.id, quantity: 1, withholdingCode: '999' }] }), /Tanınmayan tevkifat kodu/);
    const draft = await inv.createInvoiceDraft(acc, String(order.id), { lines: [{ orderItemId: item.id, quantity: 1, withholdingCode: '601', unitCode: 'SET' }] });
    assert.deepEqual([draft.subtotal, draft.vatTotal, draft.total, draft.withholdingTotal, draft.payable], [10000, 2000, 12000, 800, 11200]);
    const [row] = await db`SELECT invoice_type_code, withholding_total, payable_total FROM invoices WHERE id = ${draft.id}`;
    assert.deepEqual([row.invoice_type_code, Number(row.withholding_total), Number(row.payable_total)], ['TEVKIFAT', 800, 11200]);
    const [line] = await db`SELECT unit_code, withholding_code, withholding_percent, withholding_amount FROM invoice_lines WHERE invoice_id = ${draft.id}`;
    assert.deepEqual([line.unit_code, line.withholding_code, Number(line.withholding_percent), Number(line.withholding_amount)], ['SET', '601', 40, 800]);

    await inv.issueInvoice(acc, draft.id, {});
    const listed = (await inv.listInvoices(acc)).find((x: any) => x.id === draft.id)!;
    assert.deepEqual([listed.grandTotal, listed.withholdingTotal, listed.payableTotal, listed.typeCode], [12000, 800, 11200, 'TEVKIFAT']);

    // The buyer owes 11 200 (the withheld 800 goes to the tax office), and a collection is capped there.
    const r = await rec.receivables(acc);
    const mine = r.customers.find((c: any) => c.customerId === String(customer.id))!;
    assert.equal(mine.invoiceTotal, 11200);
    await assert.rejects(inv.recordCollection(acc, { orderId: String(order.id), amount: 11300, method: 'bank_transfer', paidOn: new Date().toISOString().slice(0, 10) }), /aşamaz/);

    console.log('PASS · legal identity validated (IBAN mod-97, TCKN, prefixes) and audited; GİB numbers gap-free under 5 parallel issues and a rollback, per year and series; 601 withholding on a real draft (TEVKIFAT, 800 withheld, 11 200 payable) carried to the list and to receivables');
  } finally {
    await db.end({ timeout: 5 });
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
