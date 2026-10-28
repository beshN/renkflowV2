import "server-only";
import { PassThrough, Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import { deleteFile, listFiles, readFile, uploadFile, uploadStream } from "@/lib/storage";
import { BACKUP_ENCRYPTION_ALG, BACKUP_ENCRYPTION_FORMAT, backupKeyFromEnv, backupKeyId, createBackupEncryptStream } from "./backup-crypto";
import {
  BACKUP_MANIFEST_VERSION, BACKUP_PREFIX, BACKUP_RETENTION_DAYS, type BackupManifest, type BackupTable,
  backupDate, backupFolder, backupManifestKey, backupTableKey, quoteIdent,
} from "./backup-manifest";

/**
 * Daily logical backup into the app's private Blob store (never GitHub: the repository is public).
 *
 * One REPEATABLE READ, READ ONLY transaction gives every table the same snapshot. Each non-empty
 * table in `public` is streamed out with COPY … TO STDOUT (CSV with header), gzipped, encrypted
 * with AES-256-GCM when BACKUP_ENCRYPTION_KEY is set (lib/db/backup-crypto.ts) and uploaded as
 * backups/<date>/<table>.csv.gz.enc (unencrypted: .csv.gz); manifest.json is written last and
 * names the key id, never the key. Files up to SINGLE_PUT_MAX_BYTES go up in one Blob put, larger
 * ones stream as a multipart upload, so no table is held in memory. Empty tables get a manifest
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
  /** Overrides BACKUP_ENCRYPTION_KEY (tests); null forces an unencrypted run. */
  encryptionKey?: Buffer | null;
  /** Files above this size stream as a multipart upload (default SINGLE_PUT_MAX_BYTES). */
  singlePutMaxBytes?: number;
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

/** A table file up to this size is uploaded in one Blob operation; larger ones stream as multipart. */
export const SINGLE_PUT_MAX_BYTES = 8 * 1024 * 1024;

async function exportTable(tx: any, date: string, table: { name: string; columns: string[] }, hardDeadline: number, encryptionKey: Buffer | null, singlePutMaxBytes: number): Promise<BackupTable> {
  const [{ rows }] = await tx.unsafe(`/* tenant-checked: whole-database backup */ SELECT count(*)::text AS rows FROM public.${quoteIdent(table.name)}`);
  const count = Number(rows);
  if (count === 0) return { name: table.name, columns: table.columns, rows: 0, bytes: 0, csvBytes: 0, key: null };
  const columns = table.columns.map(quoteIdent).join(", ");
  const key = backupTableKey(date, table.name, Boolean(encryptionKey));
  const contentType = encryptionKey ? "application/octet-stream" : "application/gzip";
  const source = await tx.unsafe(`COPY (SELECT ${columns} FROM public.${quoteIdent(table.name)}) TO STDOUT WITH (FORMAT csv, HEADER true)`).readable();
  let csvBytes = 0;
  let bytes = 0;
  const counter = new Transform({ transform(chunk, _encoding, callback) { csvBytes += chunk.length; callback(null, chunk); } });
  // gzip first (ciphertext does not compress), then AES-256-GCM when a key is configured.
  const encrypt = encryptionKey ? createBackupEncryptStream(encryptionKey, key) : new PassThrough();
  const timer = setTimeout(() => source.destroy(new Error("time budget exceeded")), Math.max(0, hardDeadline - Date.now()));
  try {
    await pipeline(source, counter, createGzip({ level: 6 }), encrypt, async function (stored: AsyncIterable<Buffer>) {
      // Small files (most tables) go up in one put; once a file outgrows that, the part already read
      // and the rest of the stream go up as a multipart upload, so memory stays bounded.
      const iterator = stored[Symbol.asyncIterator]();
      const head: Buffer[] = [];
      for (;;) {
        const next = await iterator.next();
        if (next.done) { await uploadFile(key, Buffer.concat(head), contentType); return; }
        head.push(next.value);
        bytes += next.value.length;
        if (bytes > singlePutMaxBytes) break;
      }
      const rest = Readable.from((async function* () {
        yield* head;
        head.length = 0;
        for (;;) {
          const next = await iterator.next();
          if (next.done) return;
          bytes += next.value.length;
          yield next.value;
        }
      })());
      await uploadStream(key, rest, contentType);
    });
  } finally {
    clearTimeout(timer);
  }
  return { name: table.name, columns: table.columns, rows: count, bytes, csvBytes, key };
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

  // A malformed key fails the run (never a silent unencrypted fallback); a missing key is allowed
  // but logged, and the manifest records encryption: null.
  const encryptionKey = options.encryptionKey !== undefined ? options.encryptionKey : backupKeyFromEnv();
  if (!encryptionKey) console.warn("[backup] BACKUP_ENCRYPTION_KEY tanımlı değil: yedek dosyaları yalnız gzip'li, şifresiz yazılıyor (parola özetleri ve anahtarlar dahil).");
  const encryption = encryptionKey ? { alg: BACKUP_ENCRYPTION_ALG, keyId: backupKeyId(encryptionKey), format: BACKUP_ENCRYPTION_FORMAT } : null;
  const singlePutMaxBytes = options.singlePutMaxBytes ?? SINGLE_PUT_MAX_BYTES;

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
        encryption,
      };
      const m: BackupManifest = manifest;
      for (const [index, table] of tableRows.entries()) {
        if (Date.now() > softDeadline) {
          m.stoppedReason = "time budget";
          m.missingTables = tableRows.slice(index).map((t) => t.name);
          return;
        }
        try {
          m.tables.push(await exportTable(tx, date, { name: table.name, columns: [...table.columns] }, hardDeadline, encryptionKey, singlePutMaxBytes));
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
