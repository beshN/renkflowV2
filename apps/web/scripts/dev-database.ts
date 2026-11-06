/** Local-only persistent database. Never uses DATABASE_URL or a remote server. */
import { localTestDatabasePort } from "./local-test-database";
import EmbeddedPostgres from "embedded-postgres";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
async function main() {
  const empty = process.argv.includes("--empty");
  const names = process.argv.includes("--test-only")
    ? ["renkflow_test"]
    : ["renkflow_dev", "renkflow_test"];
  // RENKFLOW_TEST_DB_DIR gives a throwaway cluster (the integration runner uses a fresh temp dir).
  const directory = path.resolve(
    process.env.RENKFLOW_TEST_DB_DIR || ".data/postgres",
  );
  const engine = new EmbeddedPostgres({
    databaseDir: directory,
    user: "postgres",
    password: "renkflow-local-only",
    port: localTestDatabasePort(),
    persistent: true,
    postgresFlags: ["-h", "127.0.0.1"],
    // Same encoding as production (Neon is UTF8); without it the cluster defaults to SQL_ASCII.
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => {},
    onError: (e) => {
      if (String(e).includes("FATAL")) console.error(String(e));
    },
  });
  if (!existsSync(path.join(directory, "PG_VERSION")))
    await engine.initialise();
  await engine.start();
  const admin = postgres(
    `postgres://postgres:renkflow-local-only@127.0.0.1:${localTestDatabasePort()}/postgres`,
  );
  for (const name of names) {
    if (!(await admin`SELECT 1 FROM pg_database WHERE datname=${name}`).length)
      await admin.unsafe(
        `CREATE DATABASE ${name} ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0`,
      );
  }
  const ascii =
    await admin`SELECT datname FROM pg_database WHERE datname IN ${admin(names)} AND pg_encoding_to_char(encoding) <> 'UTF8'`;
  if (ascii.length)
    console.warn(
      `Not UTF8 (created by an older version of this script): ${ascii.map((r) => r.datname).join(", ")}. Drop them and rerun to match production.`,
    );
  await admin.end();
  if (!empty) {
    const { ensureBackendSchema } = await import("./ensure-backend-schema");
    for (const name of names) {
      const db = postgres(
        `postgres://postgres:renkflow-local-only@127.0.0.1:${localTestDatabasePort()}/${name}`,
        { onnotice: () => {} },
      );
      if (!(await db`SELECT to_regclass('public.orders') AS name`)[0].name) {
        await db.unsafe(readFileSync("lib/db/schema.sql", "utf8"));
        for (const file of [
          "002_add_tenant_templates.sql",
          "003_add_order_custom_fields.sql",
          "003_order_qr.sql",
          "004_inventory.sql",
          "005_inventory_stock_cache.sql",
        ])
          await db.unsafe(readFileSync(`lib/db/migrations/${file}`, "utf8"));
      }
      await ensureBackendSchema(db, { logPrefix: `[${name}]` });
      await db.end();
    }
  }
  console.log(
    `Local PostgreSQL ready on port ${localTestDatabasePort()} · ${names.join(" / ")}${empty ? " · empty mode (no schema or migrations)" : ""}`,
  );
  async function stop() {
    await engine.stop();
    process.exit(0);
  }
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  await new Promise(() => {});
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
