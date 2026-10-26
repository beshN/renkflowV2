import "server-only";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import { deleteFile, listFiles, readFile, uploadFile } from "@/lib/storage";
import {
  BACKUP_MANIFEST_VERSION, BACKUP_PREFIX, BACKUP_RETENTION_DAYS, type BackupManifest, type BackupTable,
  backupDate, backupFolder, backupManifestKey, backupTableKey, quoteIdent,
} from "./backup-manifest";

/**
 * Daily logical backup into the app's private Blob store (never GitHub: the repository is public).
 *
 * One REPEATABLE READ, READ ONLY transaction gives every table the same snapshot. Each non-empty
 * table in `public` is streamed out with COPY … TO STDOUT (CSV with header), gzipped and uploaded
 * as backups/<date>/<table>.csv.gz; manifest.json is written last. Empty tables get a manifest
 * entry but no file (Blob operations are metered on Hobby).
 *
 * This deliberately reads every table without a tenant filter: it is a whole-database export run
 * only by the authenticated production cron, and its output never reaches a tenant request.
 */
export type BackupOptions = {
  sql?: any;
  now?: () => Date;
  /** Stop starting new tables after this many ms (default 240 s of the 300 s function limit). */
  softBudgetMs?: number;
  /** Abort the table in flight after this many ms (default 270 s). */
  hardBudgetMs?: number;
  retentionDays?: number;
};
export type BackupResult =
  | { skipped: true; reason: "already-complete" | "running"; date: string }
  | { skipped: false; date: string; complete: boolean; stoppedReason: string | null; tables: number; files: number; rows: number; bytes: number; pruned: number; seconds: number };

// Distinct from db:deploy's 624938512; serializes overlapping cron invocations.
const BACKUP_LOCK = 624938513;

async function existingManifest(date: string): Promise<BackupManifest | null> {
  try {
    const file = await readFile(backupManifestKey(date));
    return JSON.parse(await new Response(file.body).text()) as BackupManifest;
  } catch {
    return null;
  }
}

async function exportTable(tx: any, date: string, table: { name: string; columns: string[] }, hardDeadline: number): Promise<BackupTable> {
  const [{ rows }] = await tx.unsafe(`/* tenant-checked: whole-database backup */ SELECT count(*)::text AS rows FROM public.${quoteIdent(table.name)}`);
  const count = Number(rows);
  if (count === 0) return { name: table.name, columns: table.columns, rows: 0, bytes: 0, csvBytes: 0, key: null };
  const columns = table.columns.map(quoteIdent).join(", ");
  const source = await tx.unsafe(`COPY (SELECT ${columns} FROM public.${quoteIdent(table.name)}) TO STDOUT WITH (FORMAT csv, HEADER true)`).readable();
  let csvBytes = 0;
  const counter = new Transform({ transform(chunk, _encoding, callback) { csvBytes += chunk.length; callback(null, chunk); } });
  const chunks: Buffer[] = [];
  const timer = setTimeout(() => source.destroy(new Error("time budget exceeded")), Math.max(0, hardDeadline - Date.now()));
  try {
    await pipeline(source, counter, createGzip({ level: 6 }), async function (gzipped: AsyncIterable<Buffer>) {
      for await (const chunk of gzipped) chunks.push(chunk);
    });
  } finally {
    clearTimeout(timer);
  }
  const body = Buffer.concat(chunks);
  const key = backupTableKey(date, table.name);
  await uploadFile(key, body, "application/gzip");
  return { name: table.name, columns: table.columns, rows: count, bytes: body.length, csvBytes, key };
}

/** Deletes backups/<date>/ folders older than the retention window; never touches anything else. */
export async function pruneOldBackups(now: Date, retentionDays = BACKUP_RETENTION_DAYS): Promise<number> {
  const cutoff = backupDate(new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000));
  let deleted = 0;
  for (const file of await listFiles(BACKUP_PREFIX)) {
    const date = /^backups\/(\d{4}-\d{2}-\d{2})\//.exec(file.key)?.[1];
    if (!date || date >= cutoff) continue;
    await deleteFile(file.key);
    deleted++;
  }
  return deleted;
}

export async function runDatabaseBackup(options: BackupOptions = {}): Promise<BackupResult> {
  const sql = options.sql ?? (await import("@/lib/db")).sql;
  const now = options.now ?? (() => new Date());
  const started = now();
  const startedMs = Date.now();
  const softDeadline = startedMs + (options.softBudgetMs ?? 240_000);
  const hardDeadline = startedMs + (options.hardBudgetMs ?? 270_000);
  const date = backupDate(started);

  const previous = await existingManifest(date);
  if (previous?.complete) return { skipped: true, reason: "already-complete", date };

  let manifest: BackupManifest | null = null;
  let locked = true;
  try {
    await sql.begin("isolation level repeatable read read only", async (tx: any) => {
      const [{ acquired }] = await tx`SELECT pg_try_advisory_xact_lock(${BACKUP_LOCK}) AS acquired`;
      if (!acquired) { locked = false; return; }
      // A partial run from earlier today is replaced (uploads never overwrite).
      for (const file of await listFiles(backupFolder(date))) await deleteFile(file.key);

      const tableRows: Array<{ name: string; columns: string[] }> = await tx`
        SELECT c.relname AS name,
               array(SELECT a.attname::text FROM pg_attribute a
                     WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = ''
                     ORDER BY a.attnum) AS columns
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relispartition
        ORDER BY c.relname`;
      const [{ version }] = await tx`SELECT current_setting('server_version') AS version`;
      const hasLedger = tableRows.some((t) => t.name === "schema_migrations");
      const schemaMigrations = hasLedger ? await tx`SELECT filename, checksum FROM public.schema_migrations ORDER BY filename` : [];
      const sequences = await tx`
        SELECT s.sequencename AS name, s.last_value::text AS "lastValue"
        FROM pg_sequences s
        WHERE s.schemaname = 'public' AND NOT EXISTS (
          SELECT 1 FROM pg_depend d
          WHERE d.objid = format('%I.%I', s.schemaname, s.sequencename)::regclass::oid AND d.classid = 'pg_class'::regclass AND d.deptype IN ('a', 'i'))
        ORDER BY s.sequencename`;

      manifest = {
        version: BACKUP_MANIFEST_VERSION, date, complete: false, stoppedReason: null,
        startedAt: started.toISOString(), finishedAt: started.toISOString(),
        commitSha: process.env.VERCEL_GIT_COMMIT_SHA || null, serverVersion: String(version),
        tables: [], missingTables: [],
        schemaMigrations: schemaMigrations.map((m: any) => ({ filename: String(m.filename), checksum: String(m.checksum) })),
        sequences: sequences.map((s: any) => ({ name: String(s.name), lastValue: s.lastValue == null ? null : String(s.lastValue) })),
      };
      const m: BackupManifest = manifest;
      for (const [index, table] of tableRows.entries()) {
        if (Date.now() > softDeadline) {
          m.stoppedReason = "time budget";
          m.missingTables = tableRows.slice(index).map((t) => t.name);
          return;
        }
        try {
          m.tables.push(await exportTable(tx, date, { name: table.name, columns: [...table.columns] }, hardDeadline));
        } catch (error) {
          // The transaction is unusable after a failed COPY; record what is missing and stop.
          m.stoppedReason = Date.now() >= hardDeadline ? "time budget" : `table ${table.name} failed`;
          m.missingTables = tableRows.slice(index).map((t) => t.name);
          console.error(`[backup] ${table.name} failed: ${error instanceof Error ? error.message.slice(0, 200) : "unknown"}`);
          return;
        }
      }
      m.complete = true;
    });
  } catch (error) {
    // COMMIT of a broken connection after a stopped COPY; the snapshot is already exported.
    if (!manifest) throw error;
  }
  if (!locked) return { skipped: true, reason: "running", date };
  if (!manifest) throw new Error("Backup did not start");
  const m: BackupManifest = manifest;
  m.finishedAt = now().toISOString();
  await uploadFile(backupManifestKey(date), Buffer.from(JSON.stringify(m, null, 1)), "application/json");

  // Prune only after a complete backup, so failures never shrink the set of good backups.
  const pruned = m.complete && Date.now() < hardDeadline ? await pruneOldBackups(started, options.retentionDays) : 0;
  return {
    skipped: false, date, complete: m.complete, stoppedReason: m.stoppedReason,
    tables: m.tables.length, files: m.tables.filter((t) => t.key).length,
    rows: m.tables.reduce((sum, t) => sum + t.rows, 0), bytes: m.tables.reduce((sum, t) => sum + t.bytes, 0),
    pruned, seconds: Math.round((Date.now() - startedMs) / 1000),
  };
}
