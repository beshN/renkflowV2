/** Explicit release operation. Audit is the default; builds never execute this script. */
import postgres from 'postgres';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const featureFiles = [
  '040_record_platform.sql', '041_quote_order_depth.sql', '042_production_depth.sql',
  '043_stock_purchasing_depth.sql', '044_access_control.sql', '045_sales_service_chain.sql',
  '046_fleet.sql', '047_finance_foundation.sql', '048_ai_assistant.sql',
];

async function main() {
  const connection = process.env.DATABASE_URL_UNPOOLED;
  if (!connection) throw new Error('MIGRATION_CONNECTION_REQUIRED');
  const url = new URL(connection);
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  const localTest = process.argv.includes('--local-test') && local && url.pathname === '/renkflow_test';
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.searchParams.has('host')) throw new Error('INVALID_MIGRATION_TARGET');
  if (local && !localTest) throw new Error('LOCAL_TARGET_REFUSED');
  if (!local && !['require', 'verify-ca', 'verify-full'].includes(url.searchParams.get('sslmode') ?? '')) throw new Error('TLS_REQUIRED');
  const apply = process.argv.includes('--apply');
  if (apply && !localTest && process.env.RELEASE_DB_BACKUP_VERIFIED !== '1') throw new Error('VERIFIED_BACKUP_REQUIRED');
  url.searchParams.delete('channel_binding');
  const db = postgres(url.toString(), { max: 1, prepare: false, connect_timeout: 15, onnotice: () => {} });
  const mobileDir = path.resolve('lib/features/mobile/migrations');
  const files = [
    ...featureFiles.map(name => ({ name, file: path.resolve('lib/db/migrations', name) })),
    ...readdirSync(mobileDir).filter(name => /^\d+.*\.sql$/.test(name)).sort().map(name => ({ name: `mobile/${name}`, file: path.join(mobileDir, name) })),
  ].map(file => ({ ...file, sql: readFileSync(file.file, 'utf8') }));
  // These are reviewed release migrations, never a historical reset/bootstrap file.
  for (const file of files) if (/\b(?:DROP\s+(?:TABLE|COLUMN)|TRUNCATE|DELETE\s+FROM)\b/i.test(file.sql)) throw new Error('DESTRUCTIVE_MIGRATION_REFUSED');
  const inspect = async () => {
    const relations = new Set<string>();
    const columns = new Set<string>();
    for (const file of files) {
      for (const m of file.sql.matchAll(/CREATE\s+(?:TABLE|(?:UNIQUE\s+)?INDEX)\s+IF\s+NOT\s+EXISTS\s+(?:public\.)?(\w+)/gi)) relations.add(m[1]);
      for (const m of file.sql.matchAll(/ALTER\s+TABLE\s+(?:public\.)?(\w+)\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+(\w+)/gi)) columns.add(`${m[1]}.${m[2]}`);
    }
    const missing: string[] = [];
    for (const relation of relations) {
      const [row] = await db`SELECT to_regclass(${`public.${relation}`}) IS NOT NULL AS present`;
      if (!row.present) missing.push(relation);
    }
    for (const column of columns) {
      const [table, name] = column.split('.');
      const [row] = await db`SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=${table} AND column_name=${name}) AS present`;
      if (!row.present) missing.push(column);
    }
    return missing;
  };
  try {
    for (const table of ['tenants', 'users', 'orders', 'work_orders', 'ai_suggestions']) {
      const [row] = await db`SELECT to_regclass(${`public.${table}`}) IS NOT NULL AS present`;
      if (!row.present) throw new Error('BASE_SCHEMA_REQUIRED');
    }
    console.log(JSON.stringify({ action: apply ? 'apply' : 'audit', missing: await inspect() }));
    if (apply) {
      await db`SELECT pg_advisory_lock(624938512)`;
      await db`CREATE TABLE IF NOT EXISTS public.release_schema_migrations (name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`;
      for (const file of files) {
        const hash = createHash('sha256').update(file.sql).digest('hex');
        await db.begin(async tx => {
          const [old] = await tx`SELECT sha256 FROM release_schema_migrations WHERE name=${file.name} FOR UPDATE`;
          if (old && old.sha256 !== hash) throw new Error('MIGRATION_CHECKSUM_CHANGED');
          await tx.unsafe(file.sql);
          await tx`INSERT INTO release_schema_migrations(name,sha256) VALUES(${file.name},${hash}) ON CONFLICT(name) DO NOTHING`;
        });
        console.log(`[release-db] verified ${file.name}`);
      }
    }
    const missing = await inspect();
    console.log(JSON.stringify({ complete: missing.length === 0, missing }));
    if (missing.length) process.exitCode = 2;
  } finally {
    if (apply) await db`SELECT pg_advisory_unlock(624938512)`.catch(() => {});
    await db.end({ timeout: 5 });
  }
}

main().catch(error => {
  const safe = ['MIGRATION_CONNECTION_REQUIRED', 'INVALID_MIGRATION_TARGET', 'LOCAL_TARGET_REFUSED', 'TLS_REQUIRED', 'VERIFIED_BACKUP_REQUIRED', 'DESTRUCTIVE_MIGRATION_REFUSED', 'BASE_SCHEMA_REQUIRED', 'MIGRATION_CHECKSUM_CHANGED'];
  console.error('[release-db]', safe.includes(error?.message) ? error.message : 'Operation failed; credentials and provider details suppressed');
  process.exitCode = 1;
});
