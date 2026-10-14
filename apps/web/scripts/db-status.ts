/**
 * Read-only: compares the database's migration ledger with the migration files in this checkout.
 *
 *   npm run db:status -- --env-file=.env.production.local
 *
 * Reports files never applied, files changed after they were applied, and ledger rows with no file.
 * It only runs SELECT statements (inside a READ ONLY transaction).
 */
import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';

import { expectedLedgerEntries, migrationChecksum } from './ensure-backend-schema';

const ROOT = path.resolve(__dirname, '..');

function fileFor(entry: string): string {
  return entry.startsWith('mobile/')
    ? path.join(ROOT, 'lib/features/mobile/migrations', entry.slice('mobile/'.length))
    : path.join(ROOT, 'lib/db/migrations', entry);
}

function checksumOf(entry: string): string {
  const raw = readFileSync(fileFor(entry), 'utf8');
  if (entry !== '001_finance_tables.sql') return migrationChecksum(raw);
  // Only the part before the RLS section is applied (see ensureBackendSchema).
  const marker = '-- ============================================\n-- Row Level Security (RLS)\n-- ============================================';
  return migrationChecksum(raw.split(marker)[0] || raw);
}

async function main() {
  const envFile = process.argv.find((arg) => arg.startsWith('--env-file='))?.slice('--env-file='.length);
  if (envFile) dotenv.config({ path: envFile, quiet: true });
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required');

  const db = postgres(url, { max: 1, prepare: false, connect_timeout: 15, onnotice: () => {} });
  try {
    const rows = await db.begin('read only', async (tx) => {
      const [ledger] = await tx`SELECT to_regclass('public.schema_migrations') AS name`;
      if (!ledger.name) return null;
      return tx<{ filename: string; checksum: string; last_applied_at: Date }[]>`
        SELECT filename, checksum, last_applied_at FROM public.schema_migrations`;
    });
    if (!rows) {
      console.log('No migration ledger yet: the next `npm run db:deploy` creates it.');
      process.exitCode = 1;
      return;
    }

    const applied = new Map(rows.map((row) => [row.filename, row]));
    const expected = expectedLedgerEntries();
    const missing = expected.filter((entry) => !applied.has(entry));
    const changed = expected.filter((entry) => applied.has(entry) && applied.get(entry)!.checksum !== checksumOf(entry));
    const unknown = [...applied.keys()].filter((entry) => !expected.includes(entry));

    console.log(`${expected.length - missing.length}/${expected.length} migration files recorded in the ledger`);
    for (const entry of missing) console.log(`not applied   ${entry}`);
    for (const entry of changed) console.log(`changed since ${applied.get(entry)!.last_applied_at.toISOString()}   ${entry}`);
    for (const entry of unknown) console.log(`no file       ${entry}`);
    if (missing.length || changed.length) process.exitCode = 1;
  } finally {
    await db.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error('[db:status]', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
