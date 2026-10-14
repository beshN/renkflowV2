/**
 * Bank statement import on the isolated local test database only: a parsed file is imported,
 * re-importing it adds nothing (with and without a bank account), and a re-import keeps matches.
 * The server action's session and cache hooks are replaced by test stand-ins.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import Module from 'node:module';
import path from 'node:path';
import postgres from 'postgres';

import { localTestDatabaseURL } from './local-test-database';

const actor: { tenantId: string; userId: string } = { tenantId: '', userId: '' };
const stubs: Record<string, unknown> = {
  [path.resolve(__dirname, '../lib/features/auth/serverAuth.ts')]: {
    getServerUserContext: async () => ({ userId: actor.userId, tenantId: actor.tenantId, role: 'owner', name: 'Test' }),
    requirePermission: () => {},
  },
  'next/cache': { revalidatePath: () => {}, revalidateTag: () => {} },
};
const resolve = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function (request: string, parent: unknown, ...rest: unknown[]) {
  if (request === 'next/cache') return 'next/cache';
  return resolve.call(this, request, parent, ...rest);
};
const load = (Module as any)._load;
(Module as any)._load = function (request: string, parent: unknown, ...rest: unknown[]) {
  if (request === 'next/cache') return stubs['next/cache'];
  const file = (() => { try { return (Module as any)._resolveFilename(request, parent); } catch { return null; } })();
  if (file && stubs[file]) return stubs[file];
  return load.call(this, request, parent, ...rest);
};

async function main() {
  process.env.AUTH_SECRET = 'bank-integration-local-only-123456789012345678';
  process.env.DATABASE_URL = localTestDatabaseURL();
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  try {
    assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
    const { importBankStatementLines } = await import('../app/actions/accounting.actions');
    const { parseBankStatement } = await import('../lib/features/accounting/bank-statement');

    actor.tenantId = randomUUID();
    actor.userId = randomUUID();
    await db`INSERT INTO tenants (id, name, slug) VALUES (${actor.tenantId}, 'Banka Test', ${'bnk-' + actor.tenantId.slice(0, 8)})`;
    await db`INSERT INTO users (id, email, name) VALUES (${actor.userId}, ${`own-${actor.userId}@test.local`}, 'Sahip')`;
    await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${actor.tenantId}, ${actor.userId}, 'owner')`;

    const file = ['Tarih;Açıklama;Tutar;Dekont No', '01.10.2026;FAST GELEN IŞIK;12.000,00;D-1', '05.10.2026;EFT GELEN;1.250,00;', '05.10.2026;EFT GELEN;1.250,00;'].join('\n');
    const lines = parseBankStatement(file).lines.map((l) => ({ ...l, reference: l.reference ?? undefined }));
    const count = async (account: string | null) => (await db`SELECT count(*)::int AS n FROM bank_statement_lines WHERE tenant_id = ${actor.tenantId} AND account_id IS NOT DISTINCT FROM ${account}`)[0].n;

    // Without a bank account: first import adds 3 (two equal transfers stay two), the second adds nothing.
    assert.deepEqual(await importBankStatementLines({ lines }), { success: true, importedCount: 3, skippedCount: 0 });
    assert.deepEqual(await importBankStatementLines({ lines }), { success: true, importedCount: 0, skippedCount: 3 });
    assert.equal(await count(null), 3);

    // With a bank account: a re-import keeps a line that was matched in between.
    const [bank] = await db`INSERT INTO accounts (tenant_id, code, name, type, is_bank_account) VALUES (${actor.tenantId}, '102.01', 'Banka', 'asset', true) RETURNING id`;
    assert.deepEqual(await importBankStatementLines({ accountId: bank.id, lines }), { success: true, importedCount: 3, skippedCount: 0 });
    await db`UPDATE bank_statement_lines SET reconciliation_status = 'matched', matched_at = now() WHERE tenant_id = ${actor.tenantId} AND account_id = ${bank.id} AND reference = 'D-1'`;
    assert.deepEqual(await importBankStatementLines({ accountId: bank.id, lines }), { success: true, importedCount: 0, skippedCount: 3 });
    const [kept] = await db`SELECT reconciliation_status FROM bank_statement_lines WHERE tenant_id = ${actor.tenantId} AND account_id = ${bank.id} AND reference = 'D-1'`;
    assert.equal(kept.reconciliation_status, 'matched', 're-import keeps the match');
    assert.equal(await count(bank.id), 3);

    console.log('PASS · bank statements: parsed file imported, equal transfers kept apart, re-import adds nothing with or without an account and keeps matches');
  } finally {
    await db.end({ timeout: 5 });
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
