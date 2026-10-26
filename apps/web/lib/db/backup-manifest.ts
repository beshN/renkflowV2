/** Shared by the backup cron (lib/db/backup.server.ts) and scripts/restore-backup.ts. No server imports. */
export const BACKUP_PREFIX = "backups/";
export const BACKUP_RETENTION_DAYS = 14;
export const BACKUP_MANIFEST_VERSION = 1;

export type BackupTable = {
  name: string;
  /** Exported columns in order (generated columns are left out: PostgreSQL recomputes them). */
  columns: string[];
  rows: number;
  /** Gzipped CSV size; 0 and no key for an empty table (no upload, saves Blob operations). */
  bytes: number;
  csvBytes: number;
  key: string | null;
};

export type BackupManifest = {
  version: number;
  date: string;
  complete: boolean;
  /** Set when the run stopped early: time budget or a failed table. Never contains connection details. */
  stoppedReason: string | null;
  startedAt: string;
  finishedAt: string;
  commitSha: string | null;
  serverVersion: string;
  tables: BackupTable[];
  /** Tables that exist but were not exported because the run stopped. */
  missingTables: string[];
  schemaMigrations: Array<{ filename: string; checksum: string }>;
  /** Sequences not owned by a column; owned ones are reset to max(column) on restore. */
  sequences: Array<{ name: string; lastValue: string | null }>;
};

export function backupDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}
export function backupFolder(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Tarih YYYY-MM-DD olmalı");
  return `${BACKUP_PREFIX}${date}/`;
}
export function backupManifestKey(date: string): string {
  return `${backupFolder(date)}manifest.json`;
}
/** Table names are catalog identifiers; keep the storage key to a safe character set. */
export function backupTableKey(date: string, table: string): string {
  const safe = table.replace(/[^a-zA-Z0-9_.-]/g, "_");
  return `${backupFolder(date)}${safe}.csv.gz`;
}
/** Always double-quotes, so reserved words, capitals and quotes in names are safe. */
export function quoteIdent(name: string): string {
  if (!name || name.includes("\u0000")) throw new Error("Geçersiz tanımlayıcı");
  return `"${name.replace(/"/g, '""')}"`;
}
