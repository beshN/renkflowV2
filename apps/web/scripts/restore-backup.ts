/**
 * Restores a daily logical backup (backups/<date>/ in the private Blob store, written by
 * /api/cron/backup) into an EXISTING, already migrated database. Never creates or drops schema.
 *
 *   npm run db:restore-backup -- --date 2026-10-26 --target "$RESTORE_URL" [--yes] \
 *     [--env-file=.env.vercel.production.local] [--allow-incomplete] [--force-production]
 *
 * Prepare the target first: a new Neon branch or empty database, then
 *   DATABASE_URL_UNPOOLED="$RESTORE_URL" npm run db:deploy
 * from a checkout at least as new as the backup's commit (manifest.commitSha).
 *
 * --env-file loads BLOB_READ_WRITE_TOKEN for reading the backup; every DATABASE_URL* /
 * PRODUCTION_DATABASE_URL it (or the shell) defines counts as production and is refused as the
 * target unless --force-production is given. Everything runs in one transaction: on any error,
 * or when a row count differs from the manifest, nothing in the target changes.
 */
import "./register-server-only.cjs";
import dotenv from "dotenv";
import postgres from "postgres";
import { createInterface } from "node:readline/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { readFile } from "../lib/storage";
import { backupManifestKey, quoteIdent, type BackupManifest } from "../lib/db/backup-manifest";

type Args = { date: string; target: string; yes: boolean; forceProduction: boolean; allowIncomplete: boolean; envFile?: string };

function parseArgs(argv: string[]): Args {
  const value = (name: string) => {
    const inline = argv.find((a) => a.startsWith(`--${name}=`));
    if (inline) return inline.slice(name.length + 3);
    const index = argv.indexOf(`--${name}`);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const date = value("date") || "";
  const target = value("target") || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !target) {
    throw new Error("Kullanım: restore-backup.ts --date YYYY-MM-DD --target <postgres-url> [--yes] [--env-file=<dosya>] [--allow-incomplete] [--force-production]");
  }
  return { date, target, yes: argv.includes("--yes"), forceProduction: argv.includes("--force-production"), allowIncomplete: argv.includes("--allow-incomplete"), envFile: value("env-file") };
}

/** Same database whether reached through the Neon pooler or directly. */
function databaseIdentity(url: string): string {
  const parsed = new URL(url);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) throw new Error("PostgreSQL bağlantısı gerekli");
  const host = parsed.hostname.toLowerCase().replace(/-pooler(?=\.)/, "");
  return `${host}:${parsed.port || "5432"}/${decodeURIComponent(parsed.pathname.slice(1)) || "postgres"}`;
}
function describe(url: string): string {
  const parsed = new URL(url);
  return `${parsed.hostname}/${parsed.pathname.slice(1)}`;
}

async function readManifest(date: string): Promise<BackupManifest> {
  const file = await readFile(backupManifestKey(date));
  return JSON.parse(await new Response(file.body).text()) as BackupManifest;
}

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim() === "evet";
  } finally {
    rl.close();
  }
}

export async function restoreBackup(args: Args): Promise<{ table: string; expected: number; actual: number }[]> {
  if (args.envFile) dotenv.config({ path: args.envFile, quiet: true });
  const production = ["DATABASE_URL", "DATABASE_URL_UNPOOLED", "PRODUCTION_DATABASE_URL"]
    .map((name) => process.env[name])
    .filter((url): url is string => Boolean(url))
    .map((url) => { try { return databaseIdentity(url); } catch { return null; } });
  if (production.includes(databaseIdentity(args.target)) && !args.forceProduction) {
    throw new Error("Hedef production veritabanı görünüyor (DATABASE_URL* ile aynı). Yeni bir Neon dalına geri yükleyin; bilerek production'a yazmak için --force-production gerekir.");
  }

  const manifest = await readManifest(args.date);
  if (!manifest.complete && !args.allowIncomplete) {
    throw new Error(`Bu yedek eksik (${manifest.stoppedReason || "bilinmiyor"}; eksik tablolar: ${manifest.missingTables.join(", ")}). Yine de yüklemek için --allow-incomplete.`);
  }

  const parsed = new URL(args.target);
  parsed.searchParams.delete("channel_binding");
  const notices: string[] = [];
  const db = postgres(parsed.toString(), { max: 1, prepare: false, connect_timeout: 15, onnotice: (n) => notices.push(String(n.message)) });
  try {
    // The schema must already exist: this script only loads data.
    const columns = await db<{ table: string; column: string }[]>`
      SELECT c.relname AS table, a.attname AS column
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')`;
    const targetColumns = new Map<string, Set<string>>();
    for (const row of columns) {
      if (!targetColumns.has(row.table)) targetColumns.set(row.table, new Set());
      targetColumns.get(row.table)!.add(row.column);
    }
    if (!targetColumns.size) throw new Error("Hedefte public şeması boş. Önce: DATABASE_URL_UNPOOLED=<hedef> npm run db:deploy");
    const problems: string[] = [];
    for (const table of manifest.tables) {
      const present = targetColumns.get(table.name);
      if (!present) { problems.push(`tablo yok: ${table.name}`); continue; }
      const missing = table.columns.filter((c) => !present.has(c));
      if (missing.length) problems.push(`${table.name}: sütun yok ${missing.join(", ")}`);
    }
    if (targetColumns.has("schema_migrations")) {
      const applied = new Set((await db`SELECT filename FROM public.schema_migrations`).map((r) => String(r.filename)));
      const notApplied = manifest.schemaMigrations.map((m) => m.filename).filter((f) => !applied.has(f));
      if (notApplied.length) problems.push(`hedefte uygulanmamış migration: ${notApplied.join(", ")}`);
    }
    if (problems.length) throw new Error(`Hedef şema yedekle uyuşmuyor; önce güncel main'den db:deploy çalıştırın:\n  ${problems.join("\n  ")}`);

    // The target keeps its own migration ledger: it describes the schema db:deploy built there.
    const tables = manifest.tables.filter((t) => t.name !== "schema_migrations");
    const extra = [...targetColumns.keys()].filter((name) => name !== "schema_migrations" && !manifest.tables.some((t) => t.name === name));
    console.log(`Yedek ${manifest.date} (commit ${manifest.commitSha || "?"}, ${manifest.complete ? "tam" : "EKSİK"}): ${tables.length} tablo, ${tables.reduce((s, t) => s + t.rows, 0)} satır`);
    console.log(`Hedef: ${describe(args.target)}. Bu tablolardaki mevcut veriler SİLİNECEK.`);
    if (extra.length) console.log(`Yedekte olmayan hedef tablolar (dokunulmaz, FK ile bağlıysa boşalır): ${extra.join(", ")}`);
    if (!args.yes && !(await confirm("Devam etmek için 'evet' yazın: "))) throw new Error("İptal edildi");

    const results = await db.begin(async (tx: any) => {
      try {
        await tx`SET LOCAL session_replication_role = replica`;
      } catch (error) {
        throw new Error(`session_replication_role ayarlanamadı (rol yetkisi gerekli: superuser / neon_superuser): ${error instanceof Error ? error.message : error}`);
      }
      // One statement, so foreign keys between restored tables do not block it; CASCADE also empties
      // newer target-only tables that reference them (listed above and in the notices below).
      if (tables.length) await tx.unsafe(`TRUNCATE ${tables.map((t) => `public.${quoteIdent(t.name)}`).join(", ")} CASCADE`);
      for (const table of tables) {
        if (!table.key || table.rows === 0) continue;
        const file = await readFile(table.key);
        const writable = await tx.unsafe(`COPY public.${quoteIdent(table.name)} (${table.columns.map(quoteIdent).join(", ")}) FROM STDIN WITH (FORMAT csv, HEADER true)`).writable();
        await pipeline(Readable.fromWeb(file.body as any), createGunzip(), writable);
      }
      // Column-owned sequences (serial / identity) follow the restored data.
      const owned = !tables.length ? [] : await tx`
        SELECT c.relname AS table, a.attname AS column, pg_get_serial_sequence(format('public.%I', c.relname), a.attname) AS seq
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relname IN ${tx(tables.map((t) => t.name))}
          AND pg_get_serial_sequence(format('public.%I', c.relname), a.attname) IS NOT NULL`;
      for (const row of owned) {
        await tx.unsafe(`SELECT setval($1::regclass, coalesce((SELECT max(${quoteIdent(row.column)}) FROM public.${quoteIdent(row.table)}), 1), (SELECT max(${quoteIdent(row.column)}) IS NOT NULL FROM public.${quoteIdent(row.table)}))`, [row.seq]);
      }
      // Free-standing sequences take the value recorded at backup time.
      for (const seq of manifest.sequences) {
        const [exists] = await tx`SELECT to_regclass(${`public.${quoteIdent(seq.name)}`}) AS oid`;
        if (!exists?.oid) continue;
        if (seq.lastValue == null) await tx`SELECT setval(${`public.${quoteIdent(seq.name)}`}::regclass, 1, false)`;
        else await tx`SELECT setval(${`public.${quoteIdent(seq.name)}`}::regclass, ${seq.lastValue}::bigint, true)`;
      }
      const counts = [];
      for (const table of tables) {
        const [{ rows }] = await tx.unsafe(`SELECT count(*)::text AS rows FROM public.${quoteIdent(table.name)}`);
        counts.push({ table: table.name, expected: table.rows, actual: Number(rows) });
      }
      const wrong = counts.filter((c) => c.expected !== c.actual);
      if (wrong.length) throw new Error(`Satır sayıları tutmuyor, geri alındı: ${wrong.map((c) => `${c.table} ${c.actual}/${c.expected}`).join(", ")}`);
      return counts;
    });
    for (const notice of notices) console.log(`notice: ${notice}`);
    return results;
  } finally {
    await db.end({ timeout: 5 });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const counts = await restoreBackup(args);
  const width = Math.max(5, ...counts.map((c) => c.table.length));
  console.log(`${"tablo".padEnd(width)}  manifest   hedef`);
  for (const c of counts.filter((c) => c.expected || c.actual)) console.log(`${c.table.padEnd(width)}  ${String(c.expected).padStart(8)}  ${String(c.actual).padStart(6)}`);
  console.log(`Tamam: ${counts.length} tablo, ${counts.reduce((s, c) => s + c.actual, 0)} satır; satır sayıları manifest ile aynı. Boş tablolar listelenmedi.`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[restore] ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  });
}
