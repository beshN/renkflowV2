/**
 * Customer list import on the isolated local test database only: dry run writes nothing, matches by
 * tax number / e-mail / phone never create a second card, name-only matches wait for consent, empty
 * fields can be filled, re-import is a no-op and two imports at once create each person once.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';

import { localTestDatabaseURL } from './local-test-database';

async function main() {
  process.env.AUTH_SECRET = 'import-integration-local-only-123456789012345678';
  process.env.DATABASE_URL = localTestDatabaseURL();
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {}, max: 4 });
  try {
    assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
    const { importCustomers } = await import('../lib/features/customers/import.server');

    const tenantId = randomUUID();
    const userId = randomUUID();
    await db`INSERT INTO tenants (id, name, slug) VALUES (${tenantId}, 'Aktarım Test', ${'imp-' + tenantId.slice(0, 8)})`;
    await db`INSERT INTO users (id, email, name) VALUES (${userId}, ${`own-${userId}@test.local`}, 'Sahip')`;
    await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${tenantId}, ${userId}, 'owner')`;
    const actor = { tenantId, userId };
    const [byTax] = await db`INSERT INTO customers (tenant_id, full_name, company_name, tax_number) VALUES (${tenantId}, 'Işık İnşaat', 'Işık İnşaat A.Ş.', '9876543210') RETURNING id`;
    const [byEmail] = await db`INSERT INTO customers (tenant_id, full_name, email) VALUES (${tenantId}, 'Ayşe Yılmaz', 'ayse@ornek.com') RETURNING id`;
    const [byPhone] = await db`INSERT INTO customers (tenant_id, full_name, phone) VALUES (${tenantId}, 'Ali Kaya', '0555 000 00 01') RETURNING id`;
    const [byName] = await db`INSERT INTO customers (tenant_id, full_name) VALUES (${tenantId}, 'Mehmet Demir') RETURNING id`;
    const count = async () => (await db`SELECT count(*)::int AS n FROM customers WHERE tenant_id = ${tenantId}`)[0].n;

    const file = [
      'Ad Soyad;Firma;Telefon;E-posta;VKN/TCKN;İl;İlçe',
      ';IŞIK İNŞAAT A.Ş.;;;9876543210;İstanbul;Kadıköy',
      'Ayşe Y.;;;AYSE@ornek.com;;;',
      'Ali Kaya;;+90 (555) 000 00 01;;;;',
      'mehmet  DEMİR;;;;;;',
      'Zeynep Ak;;0532 123 45 67;zeynep@ornek.com;;Bursa;Nilüfer',
      'Hatalı;;;yanlis@;;;',
      'Zeynep Kopya;;;ZEYNEP@ornek.com;;;',
    ].join('\n');

    // Dry run: outcomes, nothing written.
    const dry = await importCustomers(db, actor, { text: file });
    assert.deepEqual(dry.rows.map((r: any) => [r.line, r.outcome]), [[2, 'exists'], [3, 'exists'], [4, 'exists'], [5, 'name_match'], [6, 'new'], [7, 'error'], [8, 'error']]);
    assert.equal(dry.rows[0].matchedId, byTax.id);
    assert.equal(dry.rows[1].matchedId, byEmail.id);
    assert.equal(dry.rows[2].matchedId, byPhone.id);
    assert.equal(dry.rows[3].matchedId, byName.id);
    assert.equal(await count(), 4, 'dry run writes nothing');

    // With "fill empty fields" the tax-number match gets its city and district, nothing overwritten.
    const filled = await importCustomers(db, actor, { text: file, dryRun: true, fillEmpty: true });
    assert.deepEqual(filled.rows[0], { line: 2, name: 'IŞIK İNŞAAT A.Ş.', outcome: 'fill', matchedId: byTax.id, filled: ['city', 'district'] });

    // Real run: one new card (Zeynep), the city filled on Işık, name-only match left alone.
    const real = await importCustomers(db, actor, { text: file, dryRun: false, fillEmpty: true });
    assert.deepEqual(real.summary, { new: 1, exists: 2, filled: 1, nameMatches: 1, errors: 2 });
    assert.equal(await count(), 5);
    const [isik] = await db`SELECT company_name, city, district FROM customers WHERE id = ${byTax.id}`;
    assert.deepEqual([isik.company_name, isik.city, isik.district], ['Işık İnşaat A.Ş.', 'İstanbul', 'Kadıköy']);
    const [zeynep] = await db`SELECT full_name, phone, email, city, district FROM customers WHERE tenant_id = ${tenantId} AND full_name = 'Zeynep Ak'`;
    assert.deepEqual([zeynep.email, zeynep.city, zeynep.district], ['zeynep@ornek.com', 'Bursa', 'Nilüfer']);

    // Importing the same file again creates nothing.
    const again = await importCustomers(db, actor, { text: file, dryRun: false });
    assert.equal(again.summary.new, 0);
    assert.equal(await count(), 5);

    // Name-only matches come in only when asked for.
    const named = await importCustomers(db, actor, { text: file, dryRun: false, includeNameMatches: true });
    assert.equal(named.summary.new, 1);
    assert.equal(await count(), 6);

    // Two imports at the same time: each new person once.
    const parallel = 'Ad Soyad;E-posta\nCan Er;can@ornek.com\nEce Su;ece@ornek.com';
    await Promise.all([importCustomers(db, actor, { text: parallel, dryRun: false }), importCustomers(db, actor, { text: parallel, dryRun: false })]);
    assert.equal((await db`SELECT count(*)::int AS n FROM customers WHERE tenant_id = ${tenantId} AND email IN ('can@ornek.com', 'ece@ornek.com')`)[0].n, 2);

    const actions = (await db`SELECT action, metadata FROM activity_logs WHERE tenant_id = ${tenantId} AND action = 'customers_imported' ORDER BY created_at`);
    assert(actions.length >= 3, 'each import is recorded');

    console.log('PASS · customer import: dry run writes nothing, tax/e-mail/phone matches never duplicate, name-only matches need consent, empty fields filled without overwriting, re-import is a no-op, parallel imports create each person once');
  } finally {
    await db.end({ timeout: 5 });
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
