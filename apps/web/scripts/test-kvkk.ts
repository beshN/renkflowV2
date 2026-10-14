/**
 * KVKK on the isolated local test database only: the request register (30-day deadline, overdue,
 * closing), the data export, and erasure by anonymisation that keeps invoices and payments.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';

import { localTestDatabaseURL } from './local-test-database';

async function main() {
  process.env.AUTH_SECRET = 'kvkk-integration-local-only-12345678901234567890';
  process.env.DATABASE_URL = localTestDatabaseURL();
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  try {
    assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
    const kvkk = await import('../lib/features/privacy/subject.server');
    const inv = await import('../lib/features/finance/invoices.server');

    const tenantId = randomUUID();
    const ownerId = randomUUID();
    const officeId = randomUUID();
    await db`INSERT INTO tenants (id, name, slug) VALUES (${tenantId}, 'KVKK Test', ${'kvkk-' + tenantId.slice(0, 8)})`;
    for (const [id, role] of [[ownerId, 'owner'], [officeId, 'office']]) {
      await db`INSERT INTO users (id, email, name) VALUES (${id}, ${`${role}-${id}@test.local`}, ${role})`;
      await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${tenantId}, ${id}, ${role})`;
    }
    const owner = { tenantId, userId: ownerId, role: 'owner' as any };
    const office = { tenantId, userId: officeId, role: 'office' as any };

    // A person with an order, a quote decision, a lead, an installation, a tracking link, a message and an invoice.
    const [c] = await db`INSERT INTO customers (tenant_id, full_name, email, phone, address, billing_address, tax_number, contacts, notes)
      VALUES (${tenantId}, 'Ayşe Yılmaz', 'ayse@example.test', '+905551112233', 'Moda Cad. 1', 'Moda Cad. 1', '10000000146',
        ${JSON.stringify([{ name: 'Ali Yılmaz', phone: '+905550000000' }])}::jsonb, 'Arka bahçe, köpek var') RETURNING id`;
    const [o] = await db`INSERT INTO orders (tenant_id, order_number, customer_id, customer_name, email, phone, status, total_amount, currency, product_name)
      VALUES (${tenantId}, 'K-1', ${c.id}, 'Ayşe Yılmaz', 'ayse@example.test', '+905551112233', 'approved', 12000, 'TRY', 'Pergola') RETURNING id`;
    const [it] = await db`INSERT INTO order_items (order_id, product_name, quantity, unit_price, total_price) VALUES (${o.id}, 'Pergola', 1, 10000, 10000) RETURNING id`;
    await db`INSERT INTO quotations (tenant_id, quotation_number, customer_id, customer_name, status, customer_decision_name, customer_decision_ip)
      VALUES (${tenantId}, 'TKL-1', ${c.id}, 'Ayşe Yılmaz', 'accepted', 'Ayşe Yılmaz', '10.0.0.5')`;
    await db`INSERT INTO leads (tenant_id, lead_number, title, contact_name, phone, email, customer_id) VALUES (${tenantId}, 'L-1', 'Pergola', 'Ayşe Yılmaz', '+905551112233', 'ayse@example.test', ${c.id})`;
    await db`INSERT INTO installations (tenant_id, installation_number, order_id, address, signed_name, signed_ip) VALUES (${tenantId}, 'M-1', ${o.id}, 'Moda Cad. 1', 'Ayşe Yılmaz', '10.0.0.5')`;
    await db`INSERT INTO customer_tracking_links (tenant_id, order_id, token_hash, expires_at) VALUES (${tenantId}, ${o.id}, ${randomUUID()}, now() + interval '30 days')`;
    await db`INSERT INTO notification_outbox (tenant_id, order_id, event_key, channel, recipient, payload, status) VALUES
      (${tenantId}, ${o.id}, 'shipped', 'email', 'ayse@example.test', '{"name":"Ayşe"}', 'sent'),
      (${tenantId}, ${o.id}, 'installed', 'whatsapp', '+905551112233', '{"name":"Ayşe"}', 'pending')`;
    await db`INSERT INTO activity_logs (tenant_id, entity_type, entity_id, action, changes) VALUES (${tenantId}, 'customer', ${c.id}, 'field_updated', ${JSON.stringify({ email: { from: 'eski@example.test', to: 'ayse@example.test' } })}::jsonb)`;
    const acc = { tenantId, userId: ownerId, role: 'owner' as any };
    const draft = await inv.createInvoiceDraft(acc, String(o.id), { lines: [{ orderItemId: it.id, quantity: 1 }] });
    await inv.issueInvoice(acc, draft.id, {});

    // --- Register --------------------------------------------------------------------------------
    await assert.rejects(kvkk.listRequests(db, office), /firma yöneticisi/);
    const req = await kvkk.createRequest(db, owner, { kind: 'erasure', subjectName: 'Ayşe Yılmaz', subjectContact: 'ayse@example.test', customerId: c.id, receivedOn: '2026-09-01' });
    assert.equal(req.dueOn, '2026-10-01', 'answer due 30 days after receipt');
    await kvkk.createRequest(db, owner, { kind: 'access', subjectName: 'Mehmet Demir' });
    await assert.rejects(kvkk.createRequest(db, owner, { kind: 'access', subjectName: 'X', receivedOn: '2999-01-01' }), /ileri/);
    let list = await kvkk.listRequests(db, owner);
    assert.equal(list.find((r: any) => r.id === req.id)!.overdue, true, 'an open request past its deadline is flagged');

    // --- Export ----------------------------------------------------------------------------------
    const dump = await kvkk.exportCustomerData(db, owner, c.id);
    assert.equal(dump.customer.full_name, 'Ayşe Yılmaz');
    assert.equal(dump.orders.length, 1);
    assert.equal(dump.invoices.length, 1);
    assert.equal(dump.leads.length, 1);
    assert.equal(dump.installations.length, 1);
    assert.equal((dump.customer as any).tenant_id, undefined, 'internal ids of the firm are not exported');

    // --- Erasure ---------------------------------------------------------------------------------
    await assert.rejects(kvkk.anonymizeCustomer(db, office, c.id, { confirmName: 'Ayşe Yılmaz' }), /firma yöneticisi/);
    await assert.rejects(kvkk.anonymizeCustomer(db, owner, c.id, { confirmName: 'Ayşe' }), /aynen yazın/);
    const erased = await kvkk.anonymizeCustomer(db, owner, c.id, { confirmName: 'ayşe yılmaz', requestId: req.id });
    assert.match(erased.placeholder, /^Silinmiş kişi /);

    const [cust] = await db`SELECT * FROM customers WHERE id = ${c.id}`;
    assert.deepEqual([cust.full_name, cust.email, cust.phone, cust.address, cust.billing_address, cust.tax_number, cust.notes, cust.contacts], [erased.placeholder, null, null, null, null, null, null, []]);
    assert(cust.anonymized_at, 'marked as anonymised');
    // The customer's own history keeps its events but not the old values.
    const history = await db`SELECT changes::text AS c FROM activity_logs WHERE entity_type = 'customer' AND entity_id = ${c.id} AND action = 'field_updated'`;
    assert(history.length === 1 && !history[0].c.includes('ayse@'), 'old e-mail no longer in the history');
    const [ord] = await db`SELECT customer_name, email, phone FROM orders WHERE id = ${o.id}`;
    assert.deepEqual([ord.customer_name, ord.email, ord.phone], [erased.placeholder, null, null]);
    const [q] = await db`SELECT customer_name, customer_decision_name, customer_decision_ip FROM quotations WHERE customer_id = ${c.id}`;
    assert.deepEqual([q.customer_name, q.customer_decision_name, q.customer_decision_ip], [erased.placeholder, null, null]);
    const [lead] = await db`SELECT contact_name, phone, email FROM leads WHERE customer_id = ${c.id}`;
    assert.deepEqual([lead.contact_name, lead.phone, lead.email], [erased.placeholder, null, null]);
    const [inst] = await db`SELECT address, signed_name, signed_ip FROM installations WHERE order_id = ${o.id}`;
    assert.deepEqual([inst.address, inst.signed_name, inst.signed_ip], [null, null, null]);
    const [link] = await db`SELECT revoked_at FROM customer_tracking_links WHERE order_id = ${o.id}`;
    assert(link.revoked_at, 'tracking link revoked');
    const msgs = await db`SELECT recipient, payload, status FROM notification_outbox WHERE order_id = ${o.id} ORDER BY event_key DESC`;
    assert(msgs.every((m: any) => m.recipient.startsWith('silindi:') && Object.keys(m.payload).length === 0));
    assert.deepEqual(msgs.map((m: any) => m.status).sort(), ['sent', 'suppressed'], 'an unsent message is never sent');

    // The invoice keeps the name and tax number it was issued with (legal retention).
    const [invoice] = await db`SELECT customer_name, status FROM invoices WHERE id = ${draft.id}`;
    assert.deepEqual([invoice.customer_name, invoice.status], ['Ayşe Yılmaz', 'issued']);

    // The linked request is closed with the outcome, and a second erasure is refused.
    list = await kvkk.listRequests(db, owner);
    assert.equal(list.find((r: any) => r.id === req.id)!.status, 'completed');
    await assert.rejects(kvkk.anonymizeCustomer(db, owner, c.id, { confirmName: erased.placeholder }), /zaten silinmiş/);
    const actions = (await db`SELECT action FROM activity_logs WHERE tenant_id = ${tenantId}`).map((r: any) => r.action);
    for (const a of ['privacy_request_received', 'personal_data_exported', 'personal_data_erased']) assert(actions.includes(a), `audit has ${a}`);

    console.log('PASS · KVKK: register with 30-day deadline and overdue flag, managers only, export of every record, erasure across customer/orders/quotes/leads/installations/links/messages, invoice kept, request closed, no second erasure, audited');
  } finally {
    await db.end({ timeout: 5 });
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
