/** Creates its own disposable local PostgreSQL cluster; never connects to a configured remote database. */
import assert from "node:assert/strict";
import EmbeddedPostgres from "embedded-postgres";
import postgres from "postgres";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ensureBackendSchema } from "./ensure-backend-schema";

async function main() {
  const directory = mkdtempSync(path.join(tmpdir(), "renkflow-product-3d-")),
    port = 55548;
  const engine = new EmbeddedPostgres({
    databaseDir: directory,
    user: "postgres",
    password: "local-3d-test",
    port,
    persistent: false,
    postgresFlags: ["-h", "127.0.0.1"],
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => {},
    onError: () => {},
  });
  let db: ReturnType<typeof postgres> | undefined, appDb: any;
  try {
    await engine.initialise();
    await engine.start();
    process.env.DATABASE_URL = `postgres://postgres:local-3d-test@127.0.0.1:${port}/postgres`;
    process.env.AUTH_SECRET = "local-only-product-3d-storage-test-secret";
    db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
    await db.unsafe(readFileSync("lib/db/schema.sql", "utf8"));
    for (const file of [
      "002_add_tenant_templates.sql",
      "003_add_order_custom_fields.sql",
      "003_order_qr.sql",
      "004_inventory.sql",
      "005_inventory_stock_cache.sql",
    ])
      await db.unsafe(readFileSync(`lib/db/migrations/${file}`, "utf8"));
    await ensureBackendSchema(db, { logPrefix: "[3d-test]" });
    const { quotationService } =
      await import("../lib/features/quotations/service");
    const { defaultVisualization } =
      await import("../lib/features/product-3d/catalog");
    const { storeVisualization } =
      await import("../lib/features/product-3d/storage");
    appDb = (await import("../lib/db")).getSql();
    const tenant = randomUUID(),
      other = randomUUID(),
      user = randomUUID();
    await db`INSERT INTO tenants(id,name,slug) VALUES(${tenant},'3D storage test',${tenant}),(${other},'Other tenant',${other})`;
    await db`INSERT INTO users(id,email,name) VALUES(${user},${user + "@test.local"},'Test')`;
    await db`INSERT INTO tenant_members(tenant_id,user_id,role) VALUES(${tenant},${user},'owner')`;
    const visual = {
      configuration: defaultVisualization("zip"),
      image: "data:image/jpeg;base64,dGVzdA==",
    };
    const item = {
      productName: "Zip test",
      quantity: 2,
      unitPrice: 1250,
      totalPrice: 2500,
      discountPercent: 0,
      widthMm: 3200,
      heightMm: 2400,
      productVisualization: visual,
    };
    const quote: any = await quotationService.createQuotation(
      tenant,
      {
        customerName: "Local 3D customer",
        currency: "TRY",
        discountPercent: 0,
        items: [item],
      } as any,
      user,
    );
    assert.deepEqual(quote.items[0].productVisualization, visual);
    assert.equal(quote.items[0].widthMm, 3200);
    assert.equal(quote.items[0].unitPrice, 1250);
    assert.equal(
      await quotationService.getQuotationById(other, quote.id),
      null,
    );
    const changed = { configuration: defaultVisualization("wind-piston") };
    await db.begin(async (tx) => {
      await storeVisualization(
        tx,
        "quotation_items",
        other,
        quote.items[0].id,
        changed,
      );
    });
    assert.deepEqual(
      (await quotationService.getQuotationById(tenant, quote.id))?.items[0]
        .productVisualization,
      visual,
    );
    const updated: any = await quotationService.updateQuotation(
      tenant,
      quote.id,
      {
        expectedVersion: quote.version,
        items: [{ ...quote.items[0], productVisualization: changed }],
      } as any,
    );
    assert.deepEqual(updated.items[0].productVisualization, changed);
    assert.equal(updated.items[0].unitPrice, 1250);
    assert.equal(updated.items[0].widthMm, 3200);
    const converted = await quotationService.convertToOrder(
      tenant,
      quote.id,
      user,
      updated.version,
      "owner",
    );
    const [line] =
      await db`SELECT product_visualization,unit_price,width_mm FROM order_items WHERE order_id=${converted.orderId}`;
    assert.deepEqual(line.product_visualization, changed);
    assert.equal(Number(line.unit_price), 1250);
    assert.equal(Number(line.width_mm), 3200);
    await db.begin(async (tx) => {
      const [l] =
        await tx`SELECT id FROM order_items WHERE order_id=${converted.orderId}`;
      await storeVisualization(tx, "order_items", other, l.id, visual);
    });
    assert.deepEqual(
      (
        await db`SELECT product_visualization FROM order_items WHERE order_id=${converted.orderId}`
      )[0].product_visualization,
      changed,
    );
    console.log(
      "PASS: create → read → edit → convert preserves visuals and commercial fields; tenant isolation enforced.",
    );
    const { searchAssistantRecords } =
      await import("../lib/ai/assistant-records.server");
    const actor = { tenantId: tenant, userId: user, role: "owner" as const };
    const found: any = await searchAssistantRecords(
      actor,
      "quote-detail",
      quote.id,
    );
    assert.equal(found.quote.id, quote.id);
    assert.equal(found.items[0].product_name, "Zip test");
    const stranger = randomUUID();
    await db`INSERT INTO users(id,email,name) VALUES(${stranger},${stranger + "@test.local"},'Test other')`;
    await db`INSERT INTO tenant_members(tenant_id,user_id,role) VALUES(${other},${stranger},'owner')`;
    assert.deepEqual(
      await searchAssistantRecords(
        { tenantId: other, userId: stranger, role: "owner" },
        "quote-detail",
        quote.id,
      ),
      { found: false },
    );
    const planner = randomUUID();
    await db`INSERT INTO users(id,email,name) VALUES(${planner},${planner + "@test.local"},'Planner')`;
    await db`INSERT INTO tenant_members(tenant_id,user_id,role,access_role) VALUES(${tenant},${planner},'office','planning')`;
    const restricted: any = await searchAssistantRecords(
      { tenantId: tenant, userId: planner, role: "office" },
      "quote-detail",
      quote.id,
    );
    assert.ok(restricted.scope);
    assert.equal(restricted.quote, undefined);
    console.log(
      "PASS: assistant quote detail is real, tenant scoped, and respects custom role permissions.",
    );
    const { createApprovalLink, publicQuote } =
      await import("../lib/features/sales/quotes.server");
    const customerQuote: any = await quotationService.createQuotation(
      tenant,
      {
        customerName: "Customer preview test",
        currency: "TRY",
        discountPercent: 0,
        items: [item],
      } as any,
      user,
    );
    await db`UPDATE quotations SET status='sent' WHERE id=${customerQuote.id} AND tenant_id=${tenant}`;
    const internal = JSON.stringify({
      ...visual,
      internalOnly: "must not reach the customer",
    });
    await db`UPDATE quotation_items SET product_visualization=${internal}::text::jsonb WHERE quotation_id=${customerQuote.id} AND tenant_id=${tenant}`;
    const link = await createApprovalLink(actor, customerQuote.id);
    const customer = await publicQuote(link.path.split("/").pop()!);
    assert.deepEqual(customer?.items[0].productVisualization, visual);
    assert.equal(customer?.items[0].unitPrice, 1250);
    assert.equal(customer?.items[0].totalPrice, 2500);
    assert.equal(await publicQuote("invalid-token"), null);
    console.log(
      "PASS: customer link forwards the validated visual and prices without extra internal fields.",
    );
  } finally {
    await appDb?.end();
    await db?.end();
    await engine.stop().catch(() => {});
    rmSync(directory, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
