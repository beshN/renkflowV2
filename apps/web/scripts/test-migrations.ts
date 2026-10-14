/** Migration ledger and release idempotency, on the isolated local test database only. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import postgres from 'postgres';

import { localTestDatabaseURL } from './local-test-database';
import { DEPLOY_BOOTSTRAP_MIGRATIONS, ensureBackendSchema, expectedLedgerEntries } from './ensure-backend-schema';

async function main() {
  const url = localTestDatabaseURL();
  const db = postgres(url, { onnotice: () => {} });
  try {
    assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');

    // Releasing twice must succeed and must not duplicate ledger rows.
    await ensureBackendSchema(db, { logPrefix: '[test-migrations]' });
    await ensureBackendSchema(db, { logPrefix: '[test-migrations]' });

    const rows = await db<{ filename: string; checksum: string; apply_count: number }[]>`
      SELECT filename, checksum, apply_count FROM public.schema_migrations`;
    const recorded = new Map(rows.map((row) => [row.filename, row]));
    // ensureBackendSchema records everything except the bootstrap files only db:deploy applies.
    const backend = expectedLedgerEntries().filter((entry) => !DEPLOY_BOOTSTRAP_MIGRATIONS.includes(entry));
    for (const entry of backend) {
      const row = recorded.get(entry);
      assert(row, `ledger is missing ${entry}`);
      assert.match(row.checksum, /^[0-9a-f]{64}$/);
      assert(row.apply_count >= 2, `${entry} was not re-applied`);
    }
    assert(recorded.has('mobile/004_sessions.sql'), 'mobile migrations are part of the release');
    assert.equal((await db`SELECT to_regclass('public.mobile_sessions') AS name`)[0].name, 'mobile_sessions');

    // db:status is read-only and reports the bootstrap files this harness did not record.
    let output = '';
    try {
      output = execFileSync(process.execPath, ['--import', 'tsx', 'scripts/db-status.ts'], {
        env: { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: '' },
        encoding: 'utf8',
      });
    } catch (error) {
      output = String((error as { stdout?: string }).stdout ?? '');
    }
    assert.match(output, /migration files recorded in the ledger/);
    assert.match(output, /not applied {3}002_add_tenant_templates\.sql/);
    assert.doesNotMatch(output, /changed since/);

    // An edited file is reported.
    await db`UPDATE public.schema_migrations SET checksum = repeat('0', 64) WHERE filename = '046_fleet.sql'`;
    try {
      execFileSync(process.execPath, ['--import', 'tsx', 'scripts/db-status.ts'], {
        env: { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: '' },
        encoding: 'utf8',
      });
      assert.fail('db:status must exit non-zero when a file changed');
    } catch (error) {
      assert.match(String((error as { stdout?: string }).stdout ?? ''), /changed since .* 046_fleet\.sql/);
    }
    await ensureBackendSchema(db, { logPrefix: '[test-migrations]' });

    console.log('PASS · ledger records every release file with its checksum, re-release is idempotent, mobile tables are released, db:status reports unapplied and edited files');
  } finally {
    await db.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
