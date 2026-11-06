/** Synthetic two-tenant fixtures on localhost renkflow_test only; auto-discovered by CI/validate. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { localTestDatabaseURL } from "./local-test-database";
async function main() {
  process.env.DATABASE_URL = localTestDatabaseURL();
  process.env.AUTH_SECRET = "synthetic-local-test-secret-123456789012345";
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal(
    (await db`SELECT current_database() AS name`)[0].name,
    "renkflow_test",
  );
  const { stationWeeklyPlan } =
    await import("../lib/features/manufacturing/station-weekly-plan.server");
  const { sql } = await import("../lib/db");
  const tenants = [randomUUID(), randomUUID()],
    user = randomUUID();
  try {
    await db`INSERT INTO users(id,email,name) VALUES(${user},${user + "@test.local"},'Synthetic planner')`;
    for (const t of tenants) {
      await db`INSERT INTO tenants(id,name,slug) VALUES(${t},'Synthetic weekly plan',${"weekly-" + t})`;
      await db`INSERT INTO tenant_members(tenant_id,user_id,role) VALUES(${t},${user},'owner')`;
    }
    const jobs: string[] = [],
      items: string[] = [],
      ops: string[] = [];
    for (let i = 0; i < tenants.length; i++) {
      const t = tenants[i];
      const [item] =
        await db`INSERT INTO inventory_items(tenant_id,sku,name,unit,stock_uom,item_type) VALUES(${t},'SYNTHETIC',${"Synthetic product " + i},'kg','kg','finished_good') RETURNING id`;
      items.push(item.id);
      const [job] =
        await db`INSERT INTO work_orders(tenant_id,title,category,production_item_id,production_uom,planned_qty,created_by) VALUES(${t},${"Synthetic job " + i},'production',${item.id},${i ? "m" : "kg"},2.5,${user}) RETURNING id`;
      jobs.push(job.id);
      const [op] =
        await db`INSERT INTO production_operations(tenant_id,work_order_id,position,name,work_center_code,planned_minutes,planned_qty,status) VALUES(${t},${job.id},0,'Synthetic cut','CUT',60,2.5,'ready') RETURNING id`;
      ops.push(op.id);
      await db`INSERT INTO work_centers(tenant_id,code,name,parallel_capacity) VALUES(${t},'CUT',${"Synthetic center " + i},${i + 1})`;
    }
    // Deliberately inconsistent tenant FK; cannot hydrate the other tenant's job.
    await db`INSERT INTO production_operations(tenant_id,work_order_id,position,name,work_center_code,planned_minutes,planned_qty) VALUES(${tenants[0]},${jobs[1]},1,'Foreign FK','CUT',60,1)`;
    const [bad] =
      await db`INSERT INTO work_orders(tenant_id,title,category,production_item_id,production_uom,planned_qty,created_by) VALUES(${tenants[0]},'Synthetic mismatched product','production',${items[1]},'adet',1,${user}) RETURNING id`;
    await db`INSERT INTO production_operations(tenant_id,work_order_id,position,name,work_center_code,planned_minutes,planned_qty) VALUES(${tenants[0]},${bad.id},0,'Missing product','CUT',60,1)`;
    const task = (i: number) => ({
      id: ops[i],
      workOrderId: jobs[i],
      workCenterCode: "CUT",
      segments: [
        {
          start: "2026-11-01T23:30:00+03:00",
          end: "2026-11-02T00:30:00+03:00",
        },
      ],
    });
    // Foreign IDs embedded in a tenant's saved JSON must not become visible operations.
    for (const t of tenants)
      await db`INSERT INTO production_schedules(tenant_id,status,starts_at,tasks,inputs,created_by) VALUES(${t},'published','2026-11-01T00:00:00Z',${db.json({ tasks: [task(0), task(1)] })},'{}',${user})`;
    await db`INSERT INTO production_schedules(tenant_id,status,starts_at,tasks,inputs,created_by) VALUES(${tenants[0]},'draft','2026-11-01T00:00:00Z','{"tasks":[]}','{}',${user})`;
    const actor = (tenantId: string) => ({
      tenantId,
      userId: user,
      role: "owner" as const,
    });
    const a = await stationWeeklyPlan(actor(tenants[0]), "2026-11-04");
    const b = await stationWeeklyPlan(actor(tenants[1]), "2026-11-04");
    assert.equal(a.schedule?.status, "published");
    assert.equal(a.rows[0].center.parallelCapacity, 1);
    assert.equal(b.rows[0].center.parallelCapacity, 2);
    assert.equal(a.rows[0].days[0][0].plannedMinutes, 30);
    assert.equal(a.rows[0].days[0][0].operation.unit, "kg");
    assert.equal(b.rows[0].days[0][0].operation.unit, "m");
    assert.equal(a.unscheduled.length, 1);
    assert.equal(a.unscheduled[0].product, null);
    assert.ok(!JSON.stringify(a).includes("Synthetic product 1"));
    assert.ok(!JSON.stringify(a).includes(ops[1]));
    assert.ok(!JSON.stringify(b).includes(ops[0]));
    assert.ok(
      (
        await stationWeeklyPlan(actor(tenants[0]), "2026-12-01")
      ).rows[0].days.every((d: unknown[]) => !d.length),
    );
    // Fresh membership beats stale actor role; role narrowing also applies.
    await db`UPDATE tenant_members SET role='worker' WHERE tenant_id=${tenants[0]} AND user_id=${user}`;
    await assert.rejects(
      stationWeeklyPlan(actor(tenants[0])),
      (e: any) => e.status === 403,
    );
    const custom = randomUUID();
    await db`INSERT INTO access_roles(id,tenant_id,name,name_key,base_role,permissions) VALUES(${custom},${tenants[0]},'Synthetic restricted','synthetic-restricted','office','{}')`;
    await db`UPDATE tenant_members SET role='office',access_role=${custom} WHERE tenant_id=${tenants[0]} AND user_id=${user}`;
    await assert.rejects(
      stationWeeklyPlan(actor(tenants[0])),
      (e: any) => e.status === 403,
    );
    await db`UPDATE tenant_members SET access_role=NULL WHERE tenant_id=${tenants[0]} AND user_id=${user}`;
    assert.equal(
      (await stationWeeklyPlan(actor(tenants[0]))).schedule?.status,
      "published",
    );
    await db`DELETE FROM production_schedules WHERE tenant_id=${tenants[0]}`;
    assert.equal((await stationWeeklyPlan(actor(tenants[0]))).schedule, null);
    console.log(
      "Weekly plan: two-tenant joins, JSON isolation, units, boundary, permissions, missing data passed",
    );
  } finally {
    for (const t of tenants) {
      await db`DELETE FROM production_schedules WHERE tenant_id=${t}`;
      await db`DELETE FROM production_operations WHERE tenant_id=${t}`;
    }
    for (const t of tenants) {
      await db`DELETE FROM work_orders WHERE tenant_id=${t}`;
      await db`DELETE FROM inventory_items WHERE tenant_id=${t}`;
      await db`DELETE FROM work_centers WHERE tenant_id=${t}`;
      await db`DELETE FROM tenant_members WHERE tenant_id=${t}`;
      await db`DELETE FROM access_roles WHERE tenant_id=${t}`;
      await db`DELETE FROM tenants WHERE id=${t}`;
    }
    await db`DELETE FROM users WHERE id=${user}`;
    await db.end();
    await sql.end();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
