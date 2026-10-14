/**
 * e-Belge sending with the mock provider, on the isolated local test database only: e-Fatura vs
 * e-Arşiv, series numbers, refusal before a number is spent, the queue (send, poll, failure,
 * retry, rejection), cancel rules, the XML export, and no double send from parallel workers.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';

import { localTestDatabaseURL } from './local-test-database';

async function main() {
  process.env.AUTH_SECRET = 'einvoice-send-local-only-123456789012345678';
  process.env.DATABASE_URL = localTestDatabaseURL();
  process.env.E_INVOICE_PROVIDER = 'mock';
  process.env.E_INVOICE_MOCK_REGISTERED = '9876543210';
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  try {
    assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
    const inv = await import('../lib/features/finance/invoices.server');
    const identity = await import('../lib/features/einvoice/identity.server');
    const { drainEInvoices } = await import('../lib/features/einvoice/document.server');
    const year = new Date().getFullYear();

    const tenantId = randomUUID();
    const ownerId = randomUUID();
    const accId = randomUUID();
    await db`INSERT INTO tenants (id, name, slug) VALUES (${tenantId}, 'Gönderim Test', ${'snd-' + tenantId.slice(0, 8)})`;
    for (const [id, role] of [[ownerId, 'owner'], [accId, 'accountant']]) {
      await db`INSERT INTO users (id, email, name) VALUES (${id}, ${`${role}-${id}@test.local`}, ${role})`;
      await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${tenantId}, ${id}, ${role})`;
    }
    const acc = { tenantId, userId: accId, role: 'accountant' as any };

    async function invoiceFor(name: string, taxNumber: string | null, city: string | null, amount = 1000) {
      const [c] = await db`INSERT INTO customers (tenant_id, full_name, company_name, tax_number, tax_office, billing_address, city, district)
        VALUES (${tenantId}, ${name}, ${taxNumber && taxNumber.length === 10 ? name : null}, ${taxNumber}, ${taxNumber ? 'Kadıköy' : null}, 'Moda Cad. 1', ${city}, 'Kadıköy') RETURNING id`;
      const [o] = await db`INSERT INTO orders (tenant_id, order_number, customer_id, customer_name, status, total_amount, currency, product_name)
        VALUES (${tenantId}, ${'ORD-' + randomUUID().slice(0, 8)}, ${c.id}, ${name}, 'approved', ${amount * 1.2}, 'TRY', 'Pergola') RETURNING id`;
      const [it] = await db`INSERT INTO order_items (order_id, product_name, quantity, unit_price, total_price) VALUES (${o.id}, 'Pergola', 1, ${amount}, ${amount}) RETURNING id`;
      const draft = await inv.createInvoiceDraft(acc, String(o.id), { lines: [{ orderItemId: it.id, quantity: 1 }] });
      return { id: draft.id, orderId: String(o.id) };
    }
    const row = async (id: string) => (await db`SELECT * FROM invoices WHERE id = ${id}`)[0];
    const series = async (prefix: string) => Number((await db`SELECT last_number FROM invoice_number_series WHERE tenant_id = ${tenantId} AND prefix = ${prefix} AND year = ${year}`)[0]?.last_number ?? 0);
    const due = (id: string) => db`UPDATE invoices SET e_invoice_next_attempt_at = now() - interval '1 second' WHERE id = ${id}`;

    // Without the firm's legal identity nothing is issued and no number is spent.
    const early = await invoiceFor('Işık İnşaat', '9876543210', 'İstanbul');
    await assert.rejects(inv.issueInvoice(acc, early.id, {}), /e-Belge kesilemez: .*Firma VKN/);
    assert.equal(await series('RNK'), 0);
    assert.equal((await row(early.id)).status, 'draft');

    await identity.saveLegalIdentity(db, { tenantId, userId: ownerId }, {
      legalName: 'Gönderim Test Alüminyum Ltd. Şti.', taxNumber: '1234567890', taxOffice: 'Gebze', addressLine: 'OSB 5. Cad. No: 12',
      district: 'Gebze', city: 'Kocaeli', eFaturaPrefix: 'RNK', eArsivPrefix: 'RNA',
    });

    // Registered buyer → e-Fatura on the RNK series; the invoice waits in the queue.
    const issued = await inv.issueInvoice(acc, early.id, {});
    assert.equal(issued.number, `RNK${year}000000001`);
    assert.deepEqual(issued.eBelge && [issued.eBelge.documentType, issued.eBelge.status], ['e_fatura', 'queued']);
    let r = await row(early.id);
    assert.deepEqual([r.document_type, r.profile, r.e_invoice_status, r.e_invoice_provider], ['e_fatura', 'TEMELFATURA', 'queued', 'mock']);
    const [cust] = await db`SELECT e_invoice_registered, e_invoice_alias FROM customers WHERE id = ${r.customer_id}`;
    assert.equal(cust.e_invoice_registered, true, 'the provider answer is cached on the customer');

    // A consumer without a tax number → e-Arşiv on the RNA series.
    const consumer = await invoiceFor('Mehmet Demir', null, 'İzmir');
    assert.equal((await inv.issueInvoice(acc, consumer.id, {})).number, `RNA${year}000000001`);
    assert.equal((await row(consumer.id)).document_type, 'e_arsiv');

    // A buyer without a city cannot get an e-Belge, and the refusal names the field.
    const noCity = await invoiceFor('Adresiz Müşteri', null, null);
    await assert.rejects(inv.issueInvoice(acc, noCity.id, {}), /Müşterinin il bilgisi eksik/);
    assert.equal(await series('RNA'), 1, 'a refused invoice spends no number');

    // A queued invoice cannot be cancelled (its number is already in the GİB series).
    await assert.rejects(inv.cancelInvoice(acc, early.id, { reason: 'deneme iptali' }), /gönderimi sürüyor/);

    // Two workers at once send each invoice once.
    const results = await Promise.all([drainEInvoices(10), drainEInvoices(10)]);
    assert.equal(results.reduce((s: number, x: any) => s + (x.sent ?? 0), 0), 2);
    r = await row(early.id);
    assert.equal(r.e_invoice_status, 'sent');
    assert.match(r.e_invoice_provider_id, /^mock:e_fatura:/);

    // Polling turns sent into accepted.
    await due(early.id);
    await due(consumer.id);
    const polled = await drainEInvoices(10);
    assert.equal((polled as any).accepted, 2);
    assert.equal((await row(early.id)).e_invoice_status, 'accepted');

    // An accepted e-Fatura cannot be cancelled here; an accepted e-Arşiv can.
    await assert.rejects(inv.cancelInvoice(acc, early.id, { reason: 'müşteri vazgeçti' }), /iade faturası/);
    await inv.cancelInvoice(acc, consumer.id, { reason: 'müşteri vazgeçti' });
    r = await row(consumer.id);
    assert.deepEqual([r.status, r.e_invoice_status], ['cancelled', 'cancelled']);

    // A failed send is retried later with the error kept; "retry" puts it back now.
    const failing = await invoiceFor('HATA-TEST Yapı', null, 'Bursa');
    await inv.issueInvoice(acc, failing.id, {});
    await drainEInvoices(10);
    r = await row(failing.id);
    assert.deepEqual([r.e_invoice_status, r.e_invoice_attempts], ['error', 1]);
    assert.match(r.e_invoice_error, /HATA-TEST/);
    assert(new Date(r.e_invoice_next_attempt_at) > new Date(), 'waits before the next attempt');
    await inv.retryInvoiceSend(acc, failing.id);
    r = await row(failing.id);
    assert.deepEqual([r.e_invoice_status, r.e_invoice_attempts], ['queued', 0]);

    // A rejected e-Fatura is not resent; it can be cancelled internally.
    const rejected = await invoiceFor('RET-TEST Ltd', '9876543210', 'Ankara');
    await inv.issueInvoice(acc, rejected.id, {});
    await drainEInvoices(10);
    await due(rejected.id);
    await drainEInvoices(10);
    r = await row(rejected.id);
    assert.equal(r.e_invoice_status, 'rejected');
    await assert.rejects(inv.retryInvoiceSend(acc, rejected.id), /yeniden gönderilmez/);
    await inv.cancelInvoice(acc, rejected.id, { reason: 'alıcı reddetti' });

    // The XML export is the document that was sent.
    const { filename, xml } = await inv.invoiceXml(acc, early.id);
    assert.equal(filename, `RNK${year}000000001.xml`);
    assert(xml.includes(`<cbc:ID>RNK${year}000000001</cbc:ID>`) && xml.includes(`<cbc:UUID>${(await row(early.id)).ettn}</cbc:UUID>`));
    assert(xml.includes('<cbc:ProfileID>TEMELFATURA</cbc:ProfileID>'));

    const actions = new Set((await db`SELECT action FROM activity_logs WHERE tenant_id = ${tenantId}`).map((x) => x.action));
    for (const action of ['e_invoice_sent', 'e_invoice_accepted', 'e_invoice_failed', 'e_invoice_rejected', 'e_invoice_retried', 'invoice_cancelled']) assert(actions.has(action), `audit has ${action}`);

    console.log('PASS · e-Belge with the mock provider: e-Fatura/e-Arşiv by registration on RNK/RNA series, refusals spend no number, queued cannot be cancelled, parallel workers send once, poll → accepted, e-Arşiv cancel vs e-Fatura refused, failure kept and retried, rejection not resent, XML export, all audited');
  } finally {
    await db.end({ timeout: 5 });
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
