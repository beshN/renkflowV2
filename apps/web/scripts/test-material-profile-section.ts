/** material.save regression: only the runner's loopback renkflow_test database. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { ZodError } from "zod";
import { localTestDatabaseURL } from "./local-test-database";

async function main() {
  // Override inherited URLs before importing any application database code.
  process.env.DATABASE_URL = localTestDatabaseURL();
  process.env.AUTH_SECRET = "material-profile-section-local-test-only-1234567890";
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  try {
    assert.equal((await db`SELECT current_database() AS name`)[0].name, "renkflow_test");
    const { productionCommand, productionOverview } = await import("../lib/features/manufacturing/platform.service");
    // Only identity/tenant setup uses INSERT; every material is created through material.save.
    const [tenant] = await db`INSERT INTO tenants(name,slug) VALUES('TEST material profile section',${"material-section-" + randomUUID()}) RETURNING id`;
    const [owner] = await db`INSERT INTO users(name,email) VALUES('TEST owner',${randomUUID() + "@test.invalid"}) RETURNING id`;
    await db`INSERT INTO tenant_members(tenant_id,user_id,role) VALUES(${tenant.id},${owner.id},'owner')`;
    const actor = { tenantId: tenant.id, userId: owner.id, role: "owner" as const };
    const profile = {
      sku: "TEST-170", name: "TEST Makaslı Dere", itemType: "raw_material", uom: "m",
      standardLengthMm: 6000, weightPerMeterKg: 3.482,
      profileCode: "170", sizeLabel: "40x60", processedStates: ["boyali"], minStock: 2,
    };
    const save = (data: Record<string, unknown>, commandId = randomUUID()) =>
      productionCommand(actor, { action: "material.save", commandId, data });
    const commandId = randomUUID();
    const data = { ...profile, profileSection: "  40x60  " };
    const saved = await save(data, commandId);
    assert.equal(saved.profile_section, "40x60");
    const [stored] = await db`SELECT * FROM inventory_items WHERE tenant_id=${tenant.id} AND id=${saved.id}`;
    assert.equal(stored.profile_section, "40x60");
    assert.equal(Number(stored.standard_length_m), 6);
    assert.equal(Number(stored.weight_per_meter_kg), 3.482);
    assert.equal(Number(stored.min_stock), 2);
    assert.equal(stored.profile_code, "170");
    assert.equal(stored.size_label, "40x60");
    assert.deepEqual(stored.processed_states, ["boyali"]);
    assert.equal((await save(data, commandId)).id, saved.id);
    const overview = await productionOverview(actor);
    assert.equal(overview.items.find((item: { id: string }) => item.id === saved.id)?.profile_section, "40x60");
    console.log("PASS · Hazırlık: material.save → inventory_items.profile_section → productionOverview = 40x60 (renkflow_test)");
    console.log("PASS · Existing profile fields and command replay preserved");

    for (const profileSection of ["", "   ", 42, {}, [], true, "x".repeat(181)]) {
      await assert.rejects(save({ ...profile, sku: randomUUID(), profileCode: undefined, profileSection }),
        (error: unknown) => error instanceof ZodError && error.issues.some((issue) => issue.path.includes("profileSection")));
    }
    assert.equal(Number((await db`SELECT count(*) AS n FROM inventory_items WHERE tenant_id=${tenant.id}`)[0].n), 1);
    console.log("PASS · Invalid section values rejected without material writes");

    for (const [sku, itemType, uom] of [["TEST-LEGACY-PROFILE", "raw_material", "m"], ["TEST-SCREW", "consumable", "adet"], ["TEST-FINISHED", "finished_good", "adet"]]) {
      const row = await save({ ...profile, sku, itemType, uom, profileCode: undefined });
      assert.equal(row.profile_section, null);
      assert.equal(row.stock_uom, uom);
      assert.equal(row.item_type, itemType);
    }
    const nullable = await save({ ...profile, sku: "TEST-NULL", profileCode: undefined, profileSection: null });
    assert.equal(nullable.profile_section, null);
    await assert.rejects(save({ ...profile, sku: "TEST-DUPLICATE" }), (error: unknown) => (error as { status?: number }).status === 409);
    console.log("PASS · Legacy calls, explicit null and duplicate identity validation preserved");
  } finally {
    await db.end();
  }
}
main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
