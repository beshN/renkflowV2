/**
 * Daily backup → restore round trip, on the isolated local test database only.
 *
 * Seeds two tenants in renkflow_test, runs GET /api/cron/backup with local storage (in a temp
 * directory), prepares a second database with `db:deploy`, restores it with
 * scripts/restore-backup.ts and compares every table's row count and a few tricky values.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import postgres from 'postgres';

import { localTestDatabasePort, localTestDatabaseURL } from './local-test-database';

const ROOT = path.resolve(__dirname, '..');
const RESTORE_DB = 'renkflow_restore_migration_test';

function runScript(args: string[], env: NodeJS.ProcessEnv, cwd: string) {
  // Resolved from apps/web, so the restore script can run with the temp storage dir as its cwd.
  const tsx = pathToFileURL(path.join(ROOT, 'node_modules/tsx/dist/loader.mjs')).href;
  const result = spawnSync(process.execPath, ['--import', tsx, ...args], { cwd, env, encoding: 'utf8', timeout: 170_000 });
  return { code: result.status ?? 1, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

async function main() {
  const sourceUrl = localTestDatabaseURL();
  const adminUrl = `postgres://postgres:renkflow-local-only@127.0.0.1:${localTestDatabasePort()}/postgres`;
  const targetUrl = `postgres://postgres:renkflow-local-only@127.0.0.1:${localTestDatabasePort()}/${RESTORE_DB}`;
  const storageDir = mkdtempSync(path.join(tmpdir(), 'renkflow-backup-'));
  Object.assign(process.env, {
    DATABASE_URL: sourceUrl, STORAGE_BACKEND: 'local', ALLOW_LOCAL_STORAGE: '1',
    CRON_SECRET: 'b'.repeat(48), VERCEL_GIT_COMMIT_SHA: 'test-sha',
    // The cron module graph loads the auth config.
    AUTH_SECRET: process.env.AUTH_SECRET || 'local-only-backup-restore-test-secret',
  });
  delete process.env.VERCEL_ENV;
  delete process.env.VERCEL;
  // lib/storage's local backend writes under <cwd>/.data/files: keep it out of the developer's tree.
  process.chdir(storageDir);

  const source = postgres(sourceUrl, { onnotice: () => {} });
  const admin = postgres(adminUrl, { onnotice: () => {} });
  let target: ReturnType<typeof postgres> | undefined;
  const { sql: appSql } = await import('../lib/db');
  try {
    assert.equal((await source`SELECT current_database() AS name`)[0].name, 'renkflow_test');

    // Two tenants; values CSV must round-trip: quotes, commas, newlines, Turkish letters, NULL vs ''.
    const tenantA = randomUUID();
    const tenantB = randomUUID();
    const tricky = 'Ayşe "Çağ", Öz İnşaat\nŞube 2; ğüşıöç';
    await source`INSERT INTO tenants(id,name,slug) VALUES(${tenantA},'Yedek A',${`backup-a-${tenantA}`}),(${tenantB},'Yedek B',${`backup-b-${tenantB}`})`;
    const customerA = randomUUID();
    await source`INSERT INTO customers(id,tenant_id,full_name,email,phone,address) VALUES
      (${customerA},${tenantA},${tricky},NULL,'',${'  baştaki ve sondaki boşluk  '}),
      (${randomUUID()},${tenantA},'İkinci müşteri','a@example.test',NULL,NULL),
      (${randomUUID()},${tenantB},'B firması müşterisi','b@example.test','0555',NULL)`;
    await source`INSERT INTO production_events(tenant_id,event_type,payload) VALUES
      (${tenantA},'backup.test',${source.json({ note: tricky, n: 1 })}),
      (${tenantB},'backup.test',${source.json({ n: 2 })})`;

    // Retention: a 30-day-old folder is pruned after a complete backup, a 3-day-old one is kept.
    const day = (offset: number) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
    const today = day(0);
    for (const folder of [day(30), day(3)]) {
      mkdirSync(path.join(storageDir, '.data/files/backups', folder), { recursive: true });
      writeFileSync(path.join(storageDir, '.data/files/backups', folder, 'old.csv.gz'), 'x');
      writeFileSync(path.join(storageDir, '.data/files/backups', folder, 'old.csv.gz.metadata'), '{"contentType":"application/gzip"}');
    }

    const { GET } = await import('../app/api/cron/backup/route');
    const call = (secret: string) => GET(new Request('https://renkflow.example/api/cron/backup', { headers: { Authorization: `Bearer ${secret}` } }));
    assert.equal((await call('wrong')).status, 401, 'unauthenticated backup is refused');
    process.env.VERCEL_ENV = 'preview';
    assert.equal((await call('b'.repeat(48))).status, 403, 'previews never back up');
    delete process.env.VERCEL_ENV;

    const response = await call('b'.repeat(48));
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(body.result.complete, true);
    assert.equal(body.result.pruned, 1);
    assert(!existsSync(path.join(storageDir, '.data/files/backups', day(30), 'old.csv.gz')), 'old backup pruned');
    assert(existsSync(path.join(storageDir, '.data/files/backups', day(3), 'old.csv.gz')), 'recent backup kept');
    const again = await (await call('b'.repeat(48))).json();
    assert.equal(again.result.skipped, true, 'a second run on the same day keeps the complete backup');

    const folder = path.join(storageDir, '.data/files/backups', today);
    const manifest = JSON.parse(readFileSync(path.join(folder, 'manifest.json'), 'utf8'));
    assert.equal(manifest.complete, true);
    assert.equal(manifest.commitSha, 'test-sha');
    const tables = await source<{ name: string }[]>`SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND NOT c.relispartition ORDER BY 1`;
    assert.deepEqual(manifest.tables.map((t: { name: string }) => t.name), tables.map((t) => t.name), 'every public table is in the manifest');
    assert(manifest.tables.some((t: { name: string; rows: number }) => t.name === 'schema_migrations' && t.rows > 0), 'schema_migrations is backed up');
    assert(manifest.schemaMigrations.length > 0);
    const customersEntry = manifest.tables.find((t: { name: string }) => t.name === 'customers');
    assert.equal(customersEntry.key, `backups/${today}/customers.csv.gz`);
    assert(gunzipSync(readFileSync(path.join(storageDir, '.data/files', customersEntry.key))).toString('utf8').startsWith('id,tenant_id,full_name'), 'CSV with header');
    assert(manifest.tables.filter((t: { rows: number; key: string | null }) => t.rows === 0).every((t: { key: string | null }) => t.key === null), 'empty tables are not uploaded');

    // Time budget: a run with no budget left stops cleanly and says so in its manifest.
    const { runDatabaseBackup } = await import('../lib/db/backup.server');
    const stopped = await runDatabaseBackup({ now: () => new Date('2000-01-20T01:30:00Z'), softBudgetMs: 0 });
    assert.equal(stopped.skipped, false);
    assert(!stopped.skipped && !stopped.complete && stopped.stoppedReason === 'time budget');
    const partial = JSON.parse(readFileSync(path.join(storageDir, '.data/files/backups/2000-01-20/manifest.json'), 'utf8'));
    assert.equal(partial.complete, false);
    assert.equal(partial.missingTables.length, tables.length);

    // Restore target: an empty database prepared exactly as the runbook says (db:deploy).
    await admin.unsafe(`DROP DATABASE IF EXISTS ${RESTORE_DB} WITH (FORCE)`);
    await admin.unsafe(`CREATE DATABASE ${RESTORE_DB} ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0`);
    const deploy = runScript(['scripts/deploy-database.ts'], { ...process.env, DATABASE_URL_UNPOOLED: targetUrl, ALLOW_LOCAL_DATABASE: '1' }, ROOT);
    assert.equal(deploy.code, 0, deploy.output);

    const restoreEnv = { ...process.env, DATABASE_URL: sourceUrl };
    const restoreScript = path.join(ROOT, 'scripts/restore-backup.ts');
    const refusedProduction = runScript([restoreScript, '--date', today, '--target', sourceUrl, '--yes'], restoreEnv, storageDir);
    assert.notEqual(refusedProduction.code, 0);
    assert.match(refusedProduction.output, /production/);
    const refusedIncomplete = runScript([restoreScript, '--date', '2000-01-20', '--target', targetUrl, '--yes'], restoreEnv, storageDir);
    assert.notEqual(refusedIncomplete.code, 0);
    assert.match(refusedIncomplete.output, /eksik/);

    const restored = runScript([restoreScript, '--date', today, '--target', targetUrl, '--yes'], restoreEnv, storageDir);
    assert.equal(restored.code, 0, restored.output);
    assert.match(restored.output, /satır sayıları manifest ile aynı/);

    // Every table matches the source (the target keeps its own migration ledger).
    target = postgres(targetUrl, { onnotice: () => {} });
    for (const { name } of tables) {
      if (name === 'schema_migrations') continue;
      const ident = `"${name.replace(/"/g, '""')}"`;
      const [a] = await source.unsafe(`SELECT count(*)::int AS n FROM public.${ident}`);
      const [b] = await target.unsafe(`SELECT count(*)::int AS n FROM public.${ident}`);
      assert.equal(b.n, a.n, `${name} row count`);
    }
    const [customer] = await target`SELECT tenant_id,full_name,email,phone,address FROM customers WHERE id=${customerA}`;
    assert.deepEqual({ ...customer }, { tenant_id: tenantA, full_name: tricky, email: null, phone: '', address: '  baştaki ve sondaki boşluk  ' });
    assert.equal((await target`SELECT count(*)::int AS n FROM customers WHERE tenant_id=${tenantB}`)[0].n, 1, 'tenant B rows stay with tenant B');
    const events = await target`SELECT tenant_id,payload FROM production_events WHERE event_type='backup.test' ORDER BY id`;
    assert.deepEqual(events.map((e) => [e.tenant_id, e.payload.n]), [[tenantA, 1], [tenantB, 2]]);
    assert.equal(events[0].payload.note, tricky);
    // Identity sequence follows the restored rows: a new insert gets a fresh id.
    const [{ max }] = await target`SELECT max(id)::bigint AS max FROM production_events`;
    const [inserted] = await target`INSERT INTO production_events(tenant_id,event_type) VALUES(${tenantA},'backup.after') RETURNING id`;
    assert(BigInt(inserted.id) > BigInt(max), 'sequence reset to max(id)');
    // Foreign keys still hold after loading with replication role replica.
    assert.equal((await target`SELECT count(*)::int AS n FROM customers c LEFT JOIN tenants t ON t.id=c.tenant_id WHERE t.id IS NULL`)[0].n, 0);

    console.log(`PASS · cron backup of ${tables.length} tables (auth, preview guard, same-day skip, 14-day retention, time budget), restore into a db:deploy database with matching row counts, CSV edge values, tenant split and sequences; production and incomplete targets refused`);
  } finally {
    await target?.end({ timeout: 5 });
    await source.end({ timeout: 5 });
    await appSql.end({ timeout: 5 }).catch(() => {});
    await admin.unsafe(`DROP DATABASE IF EXISTS ${RESTORE_DB} WITH (FORCE)`).catch(() => {});
    await admin.end({ timeout: 5 });
    rmSync(storageDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
