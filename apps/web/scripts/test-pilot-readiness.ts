/** Focused CLI integration fixtures. Writes only to the empty local renkflow_test database. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import {
  localTestDatabasePort,
  localTestDatabaseURL,
} from "./local-test-database";
import { pilotColumns } from "../lib/features/manufacturing/pilot-readiness";
import {
  requiredColumns,
  requiredTables,
} from "../lib/features/manufacturing/schema-requirements";

type Report = {
  connectionType: string;
  findings: { code: string; severity: string; message: string }[];
  summary: { blockers: number; warnings: number; message: string };
};

function run(databaseUrl: string, json = false) {
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "scripts/check-pilot-readiness.ts",
      ...(json ? ["--json"] : []),
    ],
    {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: databaseUrl },
      encoding: "utf8",
      timeout: 30_000,
    },
  );
  assert.ifError(result.error);
  assert.equal(result.stderr, "", "CLI must not print server details");
  assert(
    !result.stdout.includes(databaseUrl),
    "CLI must not expose connection URL",
  );
  return { status: result.status, output: result.stdout };
}

async function main() {
  // Deliberately ignore inherited DATABASE_URL; no remote URL is accepted by this fixture runner.
  const testUrl = localTestDatabaseURL();
  const devUrl = `postgres://postgres:renkflow-local-only@127.0.0.1:${localTestDatabasePort()}/renkflow_dev`;
  const db = postgres(testUrl, { max: 1, onnotice: () => {} });
  const dev = postgres(devUrl, { max: 1 });
  const created: string[] = [];
  try {
    assert.equal(
      (await db`SELECT current_database() AS name`)[0].name,
      "renkflow_test",
    );
    assert.equal(
      (
        await dev`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'`
      )[0].n,
      0,
      "renkflow_dev must remain completely empty; run db:local -- --empty on a fresh cluster",
    );
    assert.equal(
      (
        await db`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'`
      )[0].n,
      0,
      "refuse fixture writes unless local renkflow_test is completely empty",
    );

    const empty = run(devUrl);
    assert.equal(empty.status, 1);
    assert.match(empty.output, /Bağlantı türü: yerel/);
    assert.match(empty.output, /SCHEMA_TABLE/);
    assert.match(
      empty.output,
      /engel, 0 uyarı\. Engel olmaması pilota hazır olunduğu anlamına gelmez\./,
    );
    console.log("--- Boş renkflow_dev (çıkış 1) ---\n" + empty.output.trim());
    const emptyJson = JSON.parse(run(devUrl, true).output) as Report;
    assert.equal(emptyJson.connectionType, "yerel");
    assert(emptyJson.summary.blockers > 0);

    // Focused fixture schema, not application migrations: only fields inspected by this CLI.
    const requirements = new Map<string, Set<string>>();
    for (const table of requiredTables)
      requirements.set(table, new Set(["id"]));
    for (const list of [requiredColumns, pilotColumns])
      for (const [table, columns] of Object.entries(list)) {
        const names = requirements.get(table) || new Set<string>();
        columns.forEach((c) => names.add(c));
        requirements.set(table, names);
      }
    requirements.get("tenant_members")!.add("deactivated_at");
    const jsonColumns = new Set([
      "rules",
      "operations",
      "limits",
      "examples",
      "parameter_definitions",
      "constraints",
      "metadata",
    ]);
    const numericColumns = new Set([
      "version",
      "parallel_capacity",
      "weight_per_meter_kg",
      "standard_length_m",
      "remaining_qty",
      "on_hand_qty",
    ]);
    const arrayColumns = new Set(["member_ids", "work_center_codes"]);
    const booleanColumns = new Set([
      "active",
      "machine_required",
      "team_required",
    ]);
    for (const [table, columns] of requirements) {
      const definitions = [...columns].map((column) => {
        const type =
          column === "version"
            ? "integer"
            : jsonColumns.has(column)
              ? "jsonb"
              : numericColumns.has(column)
                ? "numeric"
                : arrayColumns.has(column)
                  ? "text[]"
                  : booleanColumns.has(column)
                    ? "boolean"
                    : "text";
        return `"${column}" ${type}`;
      });
      await db.unsafe(
        `CREATE TABLE public."${table}" (${definitions.join(", ")})`,
      );
      created.push(table);
    }
    const tenant = randomUUID(),
      item = randomUUID(),
      finished = randomUUID(),
      user = randomUUID();
    const parameters = {
      widthMm: 3000,
      projectionMm: 2000,
      mountingHeightMm: 2500,
      quantity: 1,
      motor: false,
      led: false,
    };
    const examples = [parameters, { ...parameters, widthMm: 4000 }].map(
      (parameters) => ({
        parameters,
        expected: [{ itemId: item, quantity: 2 }],
      }),
    );
    const rules = [
      {
        itemId: item,
        kind: "profile",
        uom: "m",
        quantityFormula: "2",
        cutLengthFormula: "1000",
      },
    ];
    const operations = [
      { name: "Kesim", workCenterCode: "CUT", minutesFormula: "10" },
    ];
    const limits = {
      minWidthMm: 1000,
      maxWidthMm: 6000,
      minProjectionMm: 1000,
      maxProjectionMm: 4000,
      minMountingHeightMm: 1000,
      maxMountingHeightMm: 5000,
    };
    await db`INSERT INTO product_family_recipes (tenant_id,recipe_code,family) VALUES (${tenant},'PILOT-TEST','makasli')`;
    await db`INSERT INTO inventory_items (id,tenant_id,name,weight_per_meter_kg,standard_length_m,profile_section) VALUES (${item},${tenant},'Test taşıyıcı profil',1,6,'170')`;
    await db`INSERT INTO inventory_items (id,tenant_id,name) VALUES (${finished},${tenant},'Test mamul')`;
    await db`INSERT INTO production_recipes (tenant_id,code,name,version,status,finished_item_id,rules,operations,limits,examples,parameter_definitions,constraints) VALUES (${tenant},'PILOT-TEST','Test makaslı tente',1,'published',${finished},${db.json(rules)},${db.json(operations)},${db.json(limits)},${db.json(examples)},'[]','[]')`;
    await db`INSERT INTO production_recipes (tenant_id,code,name,version,status,finished_item_id,rules,operations,limits,examples,parameter_definitions,constraints) VALUES (${tenant},'PILOT-TEST','Eksik taslak',2,'draft',${finished},'[]','[]','{}','[]','[]','[]')`;
    await db`INSERT INTO work_centers (tenant_id,code,active,parallel_capacity,machine_required,team_required) VALUES (${tenant},'CUT',true,1,false,false)`;
    // operation.assign checks active tenant membership and does not require an employee resource.
    await db`INSERT INTO tenant_members (tenant_id,user_id,role) VALUES (${tenant},${user},'worker')`;
    await db`INSERT INTO stock_lots (tenant_id,item_id,remaining_qty,status) VALUES (${tenant},${item},10,'available')`;
    await db`INSERT INTO stock_balances (tenant_id,item_id,on_hand_qty) VALUES (${tenant},${item},10)`;

    // Force SELECT-only transactions at the PostgreSQL session level as well as in the CLI.
    const readOnlyUrl = new URL(testUrl);
    readOnlyUrl.searchParams.set(
      "options",
      "-c default_transaction_read_only=on",
    );
    const complete = run(readOnlyUrl.toString());
    assert.equal(complete.status, 0, complete.output);
    assert.match(
      complete.output,
      /0 engel, 0 uyarı\. Engel olmaması pilota hazır olunduğu anlamına gelmez\./,
    );
    console.log(
      "--- Test reçeteli renkflow_test (çıkış 0) ---\n" +
        complete.output.trim(),
    );
    const completeJson = JSON.parse(
      run(readOnlyUrl.toString(), true).output,
    ) as Report;
    assert.equal(completeJson.summary.blockers, 0);
    assert.equal(completeJson.summary.warnings, 0);
    assert(
      completeJson.findings.some(
        (f) => f.message.includes("(taslak)") && f.severity === "info",
      ),
    );
    assert.equal(
      (await db`SELECT count(*)::int AS n FROM production_recipes`)[0].n,
      2,
      "CLI never modifies recipes",
    );
    assert.equal(
      (
        await dev`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'`
      )[0].n,
      0,
      "development DB remains empty",
    );

    // Exercise the actual server service on this isolated local fixture database.
    // Set the URL before importing the lazy application DB client; never use inherited config.
    const otherTenant = randomUUID();
    await db`INSERT INTO product_family_recipes (tenant_id,recipe_code,family) VALUES (${otherTenant},'OTHER-TENANT-PRIVATE','makasli')`;
    const previousUrl = process.env.DATABASE_URL;
    const previousSecret = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = randomUUID();
    process.env.DATABASE_URL = readOnlyUrl.toString();
    const { pilotReadinessReport } =
      await import("../lib/features/manufacturing/pilot-readiness.service");
    const { getSql } = await import("../lib/db");
    try {
      const actor = { userId: user, tenantId: tenant, role: "admin" as const };
      const report = await pilotReadinessReport(actor);
      assert.equal(report.empty, false);
      assert(report.findings.every((f) => f.severity === "info"));
      assert(!JSON.stringify(report).includes("OTHER-TENANT-PRIVATE"));
      const other = await pilotReadinessReport({
        ...actor,
        tenantId: otherTenant,
      });
      assert(JSON.stringify(other).includes("OTHER-TENANT-PRIVATE"));
      assert(!JSON.stringify(other).includes("PILOT-TEST"));
      const emptyTenant = await pilotReadinessReport({
        ...actor,
        tenantId: randomUUID(),
      });
      assert.equal(emptyTenant.empty, true);
      assert(emptyTenant.findings.some((f) => f.code === "RECIPE_MISSING"));
      for (const role of ["office", "worker", "member", "accountant"] as const)
        await assert.rejects(
          pilotReadinessReport({ ...actor, role }),
          (error: unknown) =>
            error instanceof Error && "status" in error && error.status === 403,
        );
      assert.equal(
        (await db`SELECT count(*)::int AS n FROM production_recipes`)[0].n,
        2,
      );
      assert.equal(
        (await db`SELECT count(*)::int AS n FROM product_family_recipes`)[0].n,
        2,
      );
      console.log(
        "PASS · server report: tenant A/B isolation, empty tenant, forbidden roles, default READ ONLY session, unchanged fixture rows",
      );
    } finally {
      await getSql().end({ timeout: 5 });
      if (previousSecret === undefined) delete process.env.AUTH_SECRET;
      else process.env.AUTH_SECRET = previousSecret;
      if (previousUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousUrl;
    }

    const remote = run("postgres://blocked.invalid/readiness_guard_test");
    assert.equal(remote.status, 1);
    assert.match(remote.output, /uzak/);
    assert.match(remote.output, /REMOTE_BLOCKED/);
    assert(!remote.output.includes("blocked.invalid"));
    console.log(
      "PASS · empty DB, complete recipe plus incomplete draft, JSON, default read-only session, remote guard and non-disclosure",
    );
  } finally {
    // Drop only the tables this test created after asserting the dedicated test DB was empty.
    for (const table of created.reverse())
      await db.unsafe(`DROP TABLE public."${table}"`);
    await db.end({ timeout: 5 });
    await dev.end({ timeout: 5 });
  }
}
main().catch((error: unknown) => {
  console.error(
    error instanceof assert.AssertionError
      ? error.message
      : "Pilot readiness integration failed; inspect local test assertions without exposing connection details.",
  );
  process.exitCode = 1;
});
