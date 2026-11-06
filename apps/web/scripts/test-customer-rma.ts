/** Local PG only; fixtures are always removed in finally. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { localTestDatabaseURL } from "./local-test-database";
async function main() {
  process.env.DATABASE_URL = localTestDatabaseURL();
  process.env.AUTH_SECRET = "rma-local-test-placeholder-only-not-a-secret";
  const db = postgres(localTestDatabaseURL(), { onnotice: () => {} });
  assert.equal(
    (await db`SELECT current_database() AS n`)[0].n,
    "renkflow_test",
  );
  const migration = readFileSync(
    "lib/db/migrations/087_customer_rma.sql",
    "utf8",
  );
  await db.unsafe(migration);
  await db.unsafe(migration);
  const s = await import("../lib/features/manufacturing/customer-rma.service");
  const { updateWorkOrder } =
    await import("../lib/features/work-orders/service");
  const { sql } = await import("../lib/db");
  const { openRecord } = await import("../lib/features/records/registry");
  const t = randomUUID(),
    other = randomUUID(),
    userId = randomUUID(),
    workerId = randomUUID(),
    accountId = randomUUID();
  const a = { tenantId: t, userId, role: "owner" as const },
    foreign = { ...a, tenantId: other };
  const refused = (p: Promise<unknown>, status: number) =>
    assert.rejects(p, (e: { status: number }) => e.status === status);
  const input = (sourceLineId: string, quantity: number) => ({
    sourceLineId,
    quantity,
    reason: "Profil hasarı",
    idempotencyKey: randomUUID(),
  });
  try {
    for (const id of [t, other])
      await db`INSERT INTO tenants(id,name,slug)VALUES(${id},'RMA test',${id})`;
    for (const id of [userId, workerId, accountId])
      await db`INSERT INTO users(id,name,email)VALUES(${id},'RMA test',${id + "@test.local"})`;
    for (const id of [t, other])
      await db`INSERT INTO tenant_members(tenant_id,user_id,role)VALUES(${id},${userId},'owner')`;
    await db`INSERT INTO tenant_members(tenant_id,user_id,role)VALUES(${t},${workerId},'worker'),(${t},${accountId},'accountant')`;
    const [o] =
      await db`INSERT INTO orders(tenant_id,order_number,customer_name,total_amount,status)VALUES(${t},${randomUUID()},'RMA fixture',0,'shipped')RETURNING id`;
    const [ticket] =
      await db`INSERT INTO service_tickets(tenant_id,ticket_number,order_id,title)VALUES(${t},${randomUUID()},${o.id},'Mevcut servis')RETURNING id`;
    const [entry] =
      await db`INSERT INTO stock_entries(tenant_id,entry_number,entry_type,idempotency_key,reference_type,reference_id)VALUES(${t},${randomUUID()},'MATERIAL_ISSUE',${randomUUID()},'order',${o.id})RETURNING id`;
    const lines: string[] = [];
    for (const uom of ["adet", "kg", "m"]) {
      const [l] =
        await db`INSERT INTO order_items(order_id,product_name,quantity,quantity_unit,unit_price,total_price)VALUES(${o.id},${"Profil " + uom},10,${uom},0,0)RETURNING id`;
      lines.push(l.id);
      const [w] =
        await db`INSERT INTO work_orders(tenant_id,title,order_id,order_item_id,production_uom,created_by)VALUES(${t},'Teslim kaynağı',${o.id},${l.id},${uom},${userId})RETURNING id`;
      await db`INSERT INTO production_shipments(tenant_id,order_id,work_order_id,quantity,stock_entry_id,created_by,status)VALUES(${t},${o.id},${w.id},6,${entry.id},${userId},'delivered'),(${t},${o.id},${w.id},4,${entry.id},${userId},'shipped')`;
    }
    const [legacy] =
      await db`INSERT INTO orders(tenant_id,order_number,customer_name,total_amount,status)VALUES(${t},${randomUUID()},'Manual delivered fixture',0,'delivered') RETURNING id`;
    const [legacyLine] =
      await db`INSERT INTO order_items(order_id,product_name,quantity,quantity_unit,unit_price,total_price)VALUES(${legacy.id},'Teslim edilmiş profil',10,'m',0,0) RETURNING id`;
    assert.equal(
      Number((await s.customerRmaSources(a, legacy.id))[0].delivered_qty),
      10,
    );
    await refused(s.createCustomerRma(a, input(legacyLine.id, 11)), 409);
    const legacyRma = await s.createCustomerRma(a, input(legacyLine.id, 3.5));
    assert.equal(
      legacyRma.service_ticket_id,
      null,
      "no existing service ticket is created implicitly",
    );
    const [before] =
      await db`SELECT count(*)::int AS n FROM stock_entries WHERE tenant_id=${t}`;
    await db`UPDATE orders SET status='delivered' WHERE tenant_id=${t} AND id=${o.id}`;
    assert.equal(
      Number((await s.customerRmaSources(a, o.id))[0].delivered_qty),
      6,
      "native partial delivery takes precedence over header status",
    );
    await refused(s.createCustomerRma(a, input(lines[0], 7)), 409);
    await refused(s.createCustomerRma(a, input(lines[0], 1.5)), 400);
    await refused(s.createCustomerRma(foreign, input(lines[0], 1)), 404);
    await refused(s.customerRmaSources(foreign, o.id), 404);
    await refused(
      s.createCustomerRma(a, {
        ...input(lines[0], 1),
        photoAttachmentId: randomUUID(),
      }),
      404,
    );
    await refused(
      s.createCustomerRma(a, {
        ...input(lines[0], 1),
        serviceTicketId: randomUUID(),
      }),
      404,
    );
    const [photo] =
      await db`INSERT INTO record_attachments(tenant_id,entity_type,entity_id,file_name,mime_type,size_bytes,storage_key,uploaded_by) VALUES(${t},'order',${o.id},'profil.png','image/png',8,'rma-test-metadata-only',${userId}) RETURNING id`;
    const payload = { ...input(lines[0], 2), photoAttachmentId: photo.id };
    const r = await s.createCustomerRma(a, payload);
    assert.equal((await s.createCustomerRma(a, payload)).id, r.id);
    await refused(
      s.createCustomerRma(a, { ...payload, reason: "Başka neden" }),
      409,
    );
    assert.equal(r.service_ticket_id, ticket.id);
    assert.equal((await openRecord(db, a, "customer_rma", r.id)).head.id, r.id);
    await refused(openRecord(db, foreign, "customer_rma", r.id), 404);
    assert.equal(
      (await s.customerRmas(a, r.id))[0].lines[0].photo_attachment_id,
      photo.id,
    );
    assert.equal((await s.customerRmas(a, r.id))[0].lines[0].uom, "adet");
    await refused(s.customerRmas(foreign, r.id), 404);
    await refused(
      s.decideCustomerRma(foreign, r.id, { decision: "replace" }),
      404,
    );
    await refused(
      s.createCustomerRma(
        { ...a, userId: workerId, role: "worker" },
        input(lines[0], 1),
      ),
      403,
    );
    await refused(
      s.decideCustomerRma(
        { ...a, userId: accountId, role: "accountant" },
        r.id,
        { decision: "repair" },
      ),
      403,
    );
    const replaced = await s.decideCustomerRma(a, r.id, {
      decision: "replace",
    });
    assert.equal(
      (await s.decideCustomerRma(a, r.id, { decision: "replace" }))
        .replacement_work_order_id,
      replaced.replacement_work_order_id,
    );
    const [wo] =
      await db`SELECT * FROM work_orders WHERE tenant_id=${t} AND id=${replaced.replacement_work_order_id}`;
    assert.equal(wo.status, "blocked");
    assert.equal(wo.customer_rma_approval_pending, true);
    assert.equal(wo.recipe_id, null);
    assert.equal(wo.bom_id, null);
    await refused(updateWorkOrder(a, wo.id, { status: "in_progress" }), 409);
    // The database also refuses bypassing the application gate (fresh migration runners).
    const [constraint] =
      await db`SELECT 1 FROM pg_constraint WHERE conrelid='work_orders'::regclass AND pg_get_constraintdef(oid) LIKE '%customer_rma_approval_pending%'`;
    assert.ok(constraint, "DB approval constraint exists");
    await assert.rejects(
      db`UPDATE work_orders SET status='in_progress' WHERE tenant_id=${t} AND id=${wo.id}`,
      (e: { code: string }) => e.code === "23514",
    );
    await refused(s.approveCustomerRmaReplacement(foreign, r.id), 404);
    await s.approveCustomerRmaReplacement(a, r.id);
    assert.equal(
      (
        await db`SELECT customer_rma_approval_pending FROM work_orders WHERE tenant_id=${t} AND id=${wo.id}`
      )[0].customer_rma_approval_pending,
      false,
    );
    await refused(s.decideCustomerRma(a, r.id, { decision: "reject" }), 409);
    const race = await Promise.allSettled([
      s.createCustomerRma(a, input(lines[0], 4)),
      s.createCustomerRma(a, input(lines[0], 4)),
    ]);
    assert.equal(race.filter((x) => x.status === "fulfilled").length, 1);
    for (const [index, decision] of [
      [1, "repair"],
      [2, "reject"],
    ] as const) {
      const result = await s.createCustomerRma(a, input(lines[index], 2.5));
      const decided = await s.decideCustomerRma(a, result.id, { decision });
      assert.equal(decided.replacement_work_order_id, null);
      assert.equal(
        (await s.customerRmas(a, result.id))[0].lines[0].uom,
        index === 1 ? "kg" : "m",
      );
    }
    assert.equal(
      (
        await db`SELECT count(*)::int AS n FROM stock_entries WHERE tenant_id=${t}`
      )[0].n,
      before.n,
    );
    assert.equal(
      (
        await db`SELECT count(*)::int AS n FROM production_runs WHERE tenant_id=${t}`
      )[0].n,
      0,
    );
    console.log(
      "PASS · RMA: migration twice; delivered-only and cumulative limits; concurrent reservations; units; idempotency; three decisions; draft WO and human approval gate; no stock/production; service link; role/tenant isolation",
    );
  } finally {
    try {
      await db.begin(async (tx) => {
        await tx`SET LOCAL session_replication_role=replica`;
        for (const table of [
          "record_attachments",
          "customer_rma_lines",
          "customer_rmas",
          "production_shipments",
          "work_orders",
          "service_tickets",
          "stock_entries",
          "activity_logs",
          "tenant_members",
        ])
          await tx`DELETE FROM ${tx(table)} WHERE tenant_id IN (${t},${other})`;
        await tx`DELETE FROM order_items WHERE order_id IN(SELECT id FROM orders WHERE tenant_id IN(${t},${other}))`;
        await tx`DELETE FROM orders WHERE tenant_id IN(${t},${other})`;
        await tx`DELETE FROM tenants WHERE id IN(${t},${other})`;
        await tx`DELETE FROM users WHERE id IN(${userId},${workerId},${accountId})`;
      });
      assert.equal(
        (
          await db`SELECT count(*)::int AS n FROM tenants WHERE id IN(${t},${other})`
        )[0].n,
        0,
        "finally removes tenant fixtures",
      );
      assert.equal(
        (
          await db`SELECT count(*)::int AS n FROM customer_rmas WHERE tenant_id IN(${t},${other})`
        )[0].n,
        0,
        "finally removes RMA fixtures",
      );
    } finally {
      await db.end();
      await (sql as any).end?.();
    }
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
