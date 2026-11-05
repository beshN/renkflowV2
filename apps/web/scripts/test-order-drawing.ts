/** Synthetic fixtures only; uses the runner's throwaway loopback renkflow_test. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { localTestDatabaseURL } from "./local-test-database";

async function main() {
  // Ignore inherited/remote URLs before importing any application module.
  process.env.DATABASE_URL = localTestDatabaseURL();
  process.env.AUTH_SECRET = randomUUID() + randomUUID();
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  const { sql, getMetaSql } = await import("../lib/db");
  const { orderDrawings, orderDrawingModels } =
    await import("../lib/features/orders/makasli-drawing.server");
  const { makasliDxf } = await import("../lib/features/orders/makasli-dxf");
  const { WorkOrderApiError } =
    await import("../lib/features/work-orders/security");
  const identity = async (client: any) => {
    const [row] =
      await client`SELECT current_database() AS name,host(inet_server_addr()) AS host`;
    assert.equal(row.name, "renkflow_test");
    assert.equal(row.host, "127.0.0.1");
  };
  await identity(db);
  await identity(sql); // Verify the real service pool too, before fixture writes.
  const tenants: string[] = [],
    users: string[] = [];
  const denied = (fn: () => Promise<unknown>) =>
    assert.rejects(
      fn,
      (e: unknown) => e instanceof WorkOrderApiError && e.status === 404,
    );
  try {
    const actors = [];
    const orders: string[] = [];
    const lines: string[] = [];
    for (const name of ["A", "B"]) {
      const [tenant] =
        await db`INSERT INTO tenants(name,slug) VALUES(${`TEST Drawing ${name}`},${`test-drawing-${randomUUID()}`}) RETURNING id`;
      tenants.push(tenant.id);
      const [user] =
        await db`INSERT INTO users(name,email) VALUES('TEST drawing owner',${`${randomUUID()}@test.invalid`}) RETURNING id`;
      users.push(user.id);
      await db`INSERT INTO tenant_members(tenant_id,user_id,role) VALUES(${tenant.id},${user.id},'owner')`;
      actors.push({
        tenantId: tenant.id,
        userId: user.id,
        role: "owner" as const,
      });
      const [order] =
        await db`INSERT INTO orders(tenant_id,order_number,product_name,customer_name,total_amount) VALUES(${tenant.id},${`TEST-DRAW-${randomUUID()}`},'Makaslı tente','TEST synthetic customer',0) RETURNING id`;
      orders.push(order.id);
      const [line] =
        await db`INSERT INTO order_items(order_id,product_name,quantity,unit_price,total_price,width_mm,projection_mm,mounting_height_mm)
        VALUES(${order.id},${`TEST ${name} makaslı tente`},1,0,0,5000.5,3000,2800) RETURNING id`;
      // Explicit family makes these intentionally synthetic names unambiguous.
      await db`UPDATE order_items SET product_configuration='{"family":"makasli"}'::jsonb WHERE id=${line.id} AND order_id=${order.id}`;
      lines.push(line.id);
    }
    for (const i of [0, 1]) {
      const result = await orderDrawings(actors[i], orders[i]);
      assert.deepEqual(
        result.lines.map((l) => l.id),
        [lines[i]],
      );
      assert(result.lines[0].svg?.includes("5000,5 mm"));
      const model = await orderDrawingModels(actors[i], orders[i]);
      const dxf = makasliDxf(model);
      assert(dxf.includes("5000,5 mm"));
      assert(dxf.includes(`TEST ${i === 0 ? "A" : "B"} makasli tente`));
      assert(!dxf.includes(`TEST ${i === 0 ? "B" : "A"} makasli tente`));
      await denied(() => orderDrawingModels(actors[i], orders[1 - i]));
      assert(!JSON.stringify(result).includes(lines[1 - i]));
      await denied(() => orderDrawings(actors[i], orders[1 - i]));
    }
    // order_items has no tenant_id. Its only ownership is order_id: a foreign order's
    // line cannot be fetched/associated through an actor's own-order read.
    assert.equal(
      (await orderDrawings(actors[0], orders[0])).lines.some(
        (l) => l.id === lines[1],
      ),
      false,
    );
    const [workerRow] =
      await db`INSERT INTO users(name,email) VALUES('TEST drawing worker',${`${randomUUID()}@test.invalid`}) RETURNING id`;
    users.push(workerRow.id);
    await db`INSERT INTO tenant_members(tenant_id,user_id,role) VALUES(${tenants[0]},${workerRow.id},'worker')`;
    const worker = {
      tenantId: tenants[0],
      userId: workerRow.id,
      role: "worker" as const,
    };
    await denied(() => orderDrawings(worker, orders[0]));
    await denied(() => orderDrawingModels(worker, orders[0]));
    // A malformed foreign-tenant job pointing at our order must not grant assignment.
    await db`INSERT INTO work_orders(tenant_id,title,order_id,assigned_to) VALUES(${tenants[1]},'TEST foreign assignment',${orders[0]},${worker.userId})`;
    await denied(() => orderDrawings(worker, orders[0]));
    await denied(() => orderDrawingModels(worker, orders[0]));
    await db`INSERT INTO work_orders(tenant_id,title,order_id,assigned_to,status) VALUES(${tenants[0]},'TEST cancelled assignment',${orders[0]},${worker.userId},'cancelled')`;
    await denied(() => orderDrawings(worker, orders[0]));
    await denied(() => orderDrawingModels(worker, orders[0]));
    await db`INSERT INTO work_orders(tenant_id,title,order_id,assigned_to) VALUES(${tenants[0]},'TEST own assignment',${orders[0]},${worker.userId})`;
    assert.equal(
      (await orderDrawings(worker, orders[0])).lines[0].id,
      lines[0],
    );
    assert(
      makasliDxf(await orderDrawingModels(worker, orders[0])).includes(
        "5000,5 mm",
      ),
    );
    await denied(() => orderDrawings(worker, orders[1]));
    await denied(() => orderDrawingModels(worker, orders[1]));
    await db`UPDATE order_items SET projection_mm=NULL WHERE id=${lines[0]} AND order_id=${orders[0]}`;
    const missing = (await orderDrawings(actors[0], orders[0])).lines[0];
    assert.equal(missing.svg, null);
    assert.equal(missing.message, "ölçü eksik: açılım/çıkma");
    const missingDxf = makasliDxf(
      await orderDrawingModels(actors[0], orders[0]),
    );
    assert(missingDxf.includes("olcu eksik: acilim/cikma"));
    assert(!missingDxf.includes("\r\nLINE\r\n"));
    await db`INSERT INTO order_items(order_id,product_name,quantity,unit_price,total_price) VALUES(${orders[0]},'Makaslı tente motoru',1,0,0)`;
    assert.equal((await orderDrawings(actors[0], orders[0])).lines.length, 1);
    console.log(
      "PASS: real PG two-tenant isolation, foreign line exclusion, worker assignment/foreign/cancelled denial, missing dimensions and accessory exclusion",
    );
  } finally {
    if (tenants.length)
      await db`DELETE FROM work_orders WHERE tenant_id=ANY(${tenants}::uuid[])`;
    if (tenants.length)
      await db`DELETE FROM tenants WHERE id=ANY(${tenants}::uuid[])`;
    if (users.length)
      await db`DELETE FROM users WHERE id=ANY(${users}::uuid[])`;
    await db.end();
    await sql.end();
    await getMetaSql().end();
  }
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
