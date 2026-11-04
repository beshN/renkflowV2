/** Integration coverage for real services; loopback renkflow_test only. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { localTestDatabaseURL } from './local-test-database';
async function main() {
  process.env.DATABASE_URL = localTestDatabaseURL();
  process.env.AUTH_SECRET = 'isolated-test-only-tenant-review-secret';
  process.env.NATIVE_INVENTORY_ENABLED = '1';
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  try {
    assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
    // Inventory is diagnostic, not a claim that application-role RLS is effective.
    const inventory = await db`
      SELECT c.relname AS table_name, c.relrowsecurity AS rls,
        c.relforcerowsecurity AS force_rls,
        (SELECT count(*)::int FROM pg_policy p WHERE p.polrelid=c.oid) AS policies
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='r'
        AND EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid
          AND a.attname IN ('tenant_id','organization_id'))
      ORDER BY c.relname
    `;
    console.log('RLS_INVENTORY=' + JSON.stringify(inventory));
    const children = await db`
      SELECT child.relname AS table_name, parent.relname AS parent_table,
        child.relrowsecurity AS rls,
        (SELECT count(*)::int FROM pg_policy p WHERE p.polrelid=child.oid) AS policies
      FROM pg_constraint fk
      JOIN pg_class child ON child.oid=fk.conrelid
      JOIN pg_namespace n ON n.oid=child.relnamespace
      JOIN pg_class parent ON parent.oid=fk.confrelid
      WHERE fk.contype='f' AND n.nspname='public'
        AND NOT EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=child.oid
          AND a.attname IN ('tenant_id','organization_id'))
        AND EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=parent.oid
          AND a.attname IN ('tenant_id','organization_id'))
      ORDER BY child.relname, parent.relname
    `;
    console.log('TENANT_CHILDREN=' + JSON.stringify(children));
    const { PostgresOrderService } = await import('../lib/features/orders/postgres/order.postgres');
    const { PostgresQuotationService } = await import('../lib/features/quotations/postgres.service');
    const wo = await import('../lib/features/work-orders/service');
    const stock = await import('../lib/features/manufacturing/inventory.service');
    const platform = await import('../lib/features/manufacturing/platform.service');
    const { sql: serviceSql } = await import('../lib/db');
    assert.equal((await serviceSql`SELECT current_database() AS name`)[0].name, 'renkflow_test');
    const invoices = await import('../lib/features/finance/invoices.server');
    const finance = await import('../lib/features/finance/receivables.server');
    const { syncLedger } = await import('../lib/features/accounting/posting.server');
    // Execute the actual private query text, without exporting a test-only application API.
    const planningSource = readFileSync('lib/ai/commands/run.server.ts', 'utf8');
    const titlesQuery = planningSource.match(/sql`(SELECT w.id, w.title, w.order_id, o.order_number FROM work_orders w LEFT JOIN orders o[^`]+)`/);
    assert.ok(titlesQuery, 'AI planning titles query must be identifiable');
    const { customerKey } = await import('../lib/features/finance/engine');
    const orders = new PostgresOrderService(), quotes = new PostgresQuotationService();
    const fixtures = [];
    for (const name of ['a', 'b']) {
      const tenantId = randomUUID(), userId = randomUUID();
      await db`INSERT INTO tenants(id,name,slug) VALUES(${tenantId},${name},${tenantId})`;
      await db`INSERT INTO users(id,name,email) VALUES(${userId},${name},${userId + '@test.local'})`;
      await db`INSERT INTO tenant_members(tenant_id,user_id,role) VALUES(${tenantId},${userId},'owner')`;
      const actor = { tenantId, userId, role: 'owner' as const };
      const [order] = await db`INSERT INTO orders(tenant_id,order_number,customer_name,status,total_amount) VALUES(${tenantId},${name},${name},'approved',100) RETURNING *`;
      const [customer] = await db`INSERT INTO customers(tenant_id,full_name) VALUES(${tenantId},${name}) RETURNING id`;
      await db`UPDATE orders SET customer_id=${customer.id} WHERE id=${order.id}`;
      const [job] = await db`INSERT INTO work_orders(tenant_id,title,order_id,created_by) VALUES(${tenantId},${name},${order.id},${userId}) RETURNING *`;
      const [item] = await db`INSERT INTO inventory_items(tenant_id,sku,name) VALUES(${tenantId},${name},${name}) RETURNING *`;
      const [warehouse] = await db`INSERT INTO warehouses(tenant_id,code,name,warehouse_type) VALUES(${tenantId},${name},${name},'FINISHED') RETURNING *`;
      const entry = await stock.postStockEntry(actor, { entryType: 'MATERIAL_RECEIPT', idempotencyKey: randomUUID(), lines: [{ itemId: item.id, warehouseId: warehouse.id, quantityDelta: 5, uom: 'adet' }] });
      const [shipment] = await db`INSERT INTO production_shipments(tenant_id,order_id,work_order_id,quantity,stock_entry_id,created_by) VALUES(${tenantId},${order.id},${job.id},1,${entry.id},${userId}) RETURNING *`;
      const quote = await quotes.createQuotation(tenantId, { currency: 'TRY', discountPercent: 0, customerName: name, items: [{ productName: name, quantity: 1, unitPrice: 100, discountPercent: 0, totalPrice: 100 }] }, userId);
      fixtures.push({ actor, order, job, item, warehouse, shipment, quote, customer });
    }
    for (const [own, other] of [[fixtures[0], fixtures[1]], [fixtures[1], fixtures[0]]]) {
      const t = own.actor.tenantId;
      // Single-column FKs accept these inconsistent links; HTTP creation is not established.
      const insertInvoice = async (orderId: string, status: 'issued' | 'cancelled') => {
        const [invoice] = await db`INSERT INTO invoices(tenant_id,order_id,customer_name,status,invoice_number,issued_on,due_on,total,cancelled_at)
          VALUES(${t},${orderId},'Local invoice snapshot',${status},${randomUUID()},CURRENT_DATE,CURRENT_DATE,100,${status === 'cancelled' ? new Date() : null}) RETURNING id`;
        return invoice;
      };
      const ownInvoice = await insertInvoice(own.order.id, 'issued');
      const foreignInvoice = await insertInvoice(other.order.id, 'issued');
      await insertInvoice(other.order.id, 'cancelled');
      for (const orderId of [own.order.id, other.order.id])
        await db`INSERT INTO payments(tenant_id,order_id,amount,currency,method) VALUES(${t},${orderId},1,'TRY','cash')`;
      const receivables = await finance.receivables(own.actor);
      assert.deepEqual(receivables.customers.map(c => c.customerId), [own.customer.id]);
      assert.equal(receivables.customers[0].collected, 1);
      assert.equal((await finance.customerStatement(own.actor, customerKey(own.customer.id, own.order.customer_name), '2000-01-01', '2099-12-31')).lines.length, 2);
      await assert.rejects(finance.customerStatement(own.actor, customerKey(other.customer.id, other.order.customer_name), '2000-01-01', '2099-12-31'), /Müşteri bulunamadı/);
      assert.deepEqual((await invoices.listInvoices(own.actor)).map(i => i.id), [ownInvoice.id]);
      assert.equal((await invoices.getInvoice(own.actor, ownInvoice.id)).id, ownInvoice.id);
      await assert.rejects(invoices.getInvoice(own.actor, foreignInvoice.id), /Fatura bulunamadı/);
      // Cancelled-only foreign relation: no issued foreign invoice can mask this check.
      await db`UPDATE invoices SET status='draft' WHERE id=${foreignInvoice.id}`;
      await insertInvoice(own.order.id, 'cancelled');
      assert.equal((await finance.customerStatement(own.actor, customerKey(own.customer.id, own.order.customer_name), '2000-01-01', '2099-12-31')).lines.length, 4);
      await assert.rejects(finance.customerStatement(own.actor, customerKey(other.customer.id, other.order.customer_name), '2000-01-01', '2099-12-31'), /Müşteri bulunamadı/);
      // Scoped ledger sync must book the own payment but never an inconsistent foreign order.
      const paymentRows = await db`SELECT id,order_id FROM payments WHERE tenant_id=${t}`;
      for (const payment of paymentRows) {
        const result = await syncLedger(serviceSql, t, { paymentId: payment.id });
        assert.equal(result.failed, 0);
        assert.equal(result.posted, payment.order_id === own.order.id ? 1 : 0);
        const entries = await db`SELECT id FROM journal_entries WHERE tenant_id=${t} AND source_key=${'payment:' + payment.id}`;
        assert.equal(entries.length, payment.order_id === own.order.id ? 1 : 0);
      }
      // A mismatched order and an absent order must retain their LEFT JOIN work-order rows.
      const [foreignJob] = await db`INSERT INTO work_orders(tenant_id,title,order_id) VALUES(${t},'foreign-linked test job',${other.order.id}) RETURNING id`;
      const [unlinkedJob] = await db`INSERT INTO work_orders(tenant_id,title) VALUES(${t},'unlinked test job') RETURNING id`;
      const titles = await serviceSql.unsafe(titlesQuery[1].replace('${tenantId}', '$1'), [t]);
      assert.equal(titles.find((w: { id: string }) => w.id === own.job.id)?.order_number, own.order.order_number);
      assert.equal(titles.find((w: { id: string }) => w.id === foreignJob.id)?.order_number, null);
      assert.equal(titles.find((w: { id: string }) => w.id === unlinkedJob.id)?.order_number, null);
      assert.ok(!titles.some((w: { id: string }) => w.id === other.job.id));
      const listed = await orders.getOrders(t);
      assert.ok(listed.some(o => o.id === own.order.id));
      assert.ok(!listed.some(o => o.id === other.order.id));
      await assert.rejects(orders.getOrderById(t, other.order.id), /Tenant mismatch/);
      await assert.rejects(orders.updateOrder(t, other.order.id, { customerName: 'forbidden' }), /Tenant mismatch/);
      assert.ok(await quotes.getQuotationById(t, own.quote.id));
      assert.equal(await quotes.getQuotationById(t, other.quote.id), null);
      await assert.rejects(quotes.updateQuotation(t, other.quote.id, { customerName: 'forbidden' }), /Teklif bulunamadı/);
      assert.equal((await wo.getWorkOrderDetails(t, own.job.id)).id, own.job.id);
      await assert.rejects(wo.getWorkOrderDetails(t, other.job.id), /bulunamadı/);
      await assert.rejects(wo.updateWorkOrder(own.actor, other.job.id, { title: 'forbidden' }), /bulunamadı/);
      const balances = await stock.getStockBalances(t);
      assert.ok(balances.some((b: { item_id: string }) => b.item_id === own.item.id));
      assert.ok(!balances.some((b: { item_id: string }) => b.item_id === other.item.id));
      await assert.rejects(stock.postStockEntry(own.actor, { entryType: 'MATERIAL_RECEIPT', idempotencyKey: randomUUID(), lines: [{ itemId: other.item.id, warehouseId: own.warehouse.id, quantityDelta: 1, uom: 'adet' }] }), /bulunamadı/);
      const overview = await platform.productionOverview(own.actor);
      assert.ok(overview.shipments.some((s: { id: string }) => s.id === own.shipment.id));
      assert.ok(!overview.shipments.some((s: { id: string }) => s.id === other.shipment.id));
      await assert.rejects(platform.productionCommand(own.actor, { commandId: randomUUID(), action: 'shipment.delivered', data: { id: other.shipment.id, version: 1 } }), /Sevkiyat bulunamadı/);
      assert.equal((await db`SELECT customer_name FROM orders WHERE id=${other.order.id}`)[0].customer_name, other.order.customer_name);
      assert.equal((await db`SELECT customer_name FROM quotations WHERE id=${other.quote.id}`)[0].customer_name, other.quote.customerName);
      assert.equal((await db`SELECT title FROM work_orders WHERE id=${other.job.id}`)[0].title, other.job.title);
      assert.equal(Number((await db`SELECT on_hand_qty FROM stock_balances WHERE item_id=${other.item.id} AND tenant_id=${other.actor.tenantId}`)[0].on_hand_qty), 5);
      assert.equal((await db`SELECT status FROM production_shipments WHERE id=${other.shipment.id}`)[0].status, other.shipment.status);
    }
    // FKs permit inconsistent ownership; HTTP creation of this state is not established.
    const [a, b] = fixtures;
    const [ownDocument] = await db`INSERT INTO documents(tenant_id,order_id,name,file_path) VALUES(${a.actor.tenantId},${a.order.id},'own-document','own-test-key') RETURNING id`;
    await db`INSERT INTO documents(tenant_id,order_id,name,file_path) VALUES(${b.actor.tenantId},${a.order.id},'foreign-document','foreign-test-key')`;
    assert.deepEqual((await orders.getOrderById(a.actor.tenantId, a.order.id))!.documents?.map(d => d.id), [ownDocument.id]);
    assert.deepEqual((await orders.getOrders(a.actor.tenantId)).find(o => o.id === a.order.id)!.documents?.map(d => d.id), [ownDocument.id]);
    const { generateOrderReportPDF } = await import('../lib/export/service');
    const pdf = Buffer.from(await generateOrderReportPDF(a.actor.tenantId, a.order.id)).toString('utf8');
    assert.ok(pdf.includes(`(Order Report: ${a.order.order_number})`));
    assert.ok(!pdf.includes('foreign-test-key'));
    await assert.rejects(generateOrderReportPDF(b.actor.tenantId, a.order.id), /Order not found/);
    console.log('PASS: both tenants; orders, quotes, work orders, stock, shipments, finance and export');
  } finally {
    await db.end();
    const { getSql, getMetaSql } = await import('../lib/db');
    await Promise.all([getSql().end(), getMetaSql().end()]);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
