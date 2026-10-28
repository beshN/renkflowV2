/** Shared by the backup cron (lib/db/backup.server.ts) and scripts/restore-backup.ts. No server imports. */
import type { BackupEncryption } from "./backup-crypto";

export const BACKUP_PREFIX = "backups/";
export const BACKUP_RETENTION_DAYS = 14;
/** 2: per-file encryption (`encryption`, `.csv.gz.enc`). Version 1 manifests are read as unencrypted. */
export const BACKUP_MANIFEST_VERSION = 2;

export type BackupTable = {
  name: string;
  /** Exported columns in order (generated columns are left out: PostgreSQL recomputes them). */
  columns: string[];
  rows: number;
  /** Stored file size (gzipped, plus header and tag when encrypted); 0 and no key for an empty table (no upload, saves Blob operations). */
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
  /**
   * How the table files are encrypted (key id only, never the key), or null when
   * BACKUP_ENCRYPTION_KEY was not set. Missing in version 1 manifests (= null). The manifest itself
   * is never encrypted and holds no row data.
   */
  encryption?: BackupEncryption | null;
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
export function backupTableKey(date: string, table: string, encrypted = false): string {
  const safe = table.replace(/[^a-zA-Z0-9_.-]/g, "_");
  return `${backupFolder(date)}${safe}.csv.gz${encrypted ? ".enc" : ""}`;
}
/** Always double-quotes, so reserved words, capitals and quotes in names are safe. */
export function quoteIdent(name: string): string {
  if (!name || name.includes("\u0000")) throw new Error("Geçersiz tanımlayıcı");
  return `"${name.replace(/"/g, '""')}"`;
}
