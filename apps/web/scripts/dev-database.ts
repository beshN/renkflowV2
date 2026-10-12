/** Local-only persistent database. Never uses DATABASE_URL or a remote server. */
import EmbeddedPostgres from "embedded-postgres";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { ensureBackendSchema } from "./ensure-backend-schema";
import { localDatabasePort } from './local-test-database';
async function main() {
  const port=localDatabasePort();
  const directory = path.resolve(".data/postgres");
  const engine = new EmbeddedPostgres({
    databaseDir: directory,
    user: "postgres",
    password: "renkflow-local-only",
    port,
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
    `postgres://postgres:renkflow-local-only@127.0.0.1:${port}/postgres`,
  );
  for (const name of ["renkflow_dev", "renkflow_test"]) {
    if (!(await admin`SELECT 1 FROM pg_database WHERE datname=${name}`).length)
      await admin.unsafe(
        `CREATE DATABASE ${name} ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0`,
      );
  }
  const ascii = await admin`SELECT datname FROM pg_database WHERE datname IN ('renkflow_dev', 'renkflow_test') AND pg_encoding_to_char(encoding) <> 'UTF8'`;
  if (ascii.length)
    console.warn(
      `Not UTF8 (created by an older version of this script): ${ascii.map((r) => r.datname).join(", ")}. Drop them and rerun to match production.`,
    );
  await admin.end();
  for (const name of ["renkflow_dev", "renkflow_test"]) {
    const db = postgres(
      `postgres://postgres:renkflow-local-only@127.0.0.1:${port}/${name}`,
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
  console.log(
    `Local PostgreSQL ready: 127.0.0.1:${port} · renkflow_dev / renkflow_test`,
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
