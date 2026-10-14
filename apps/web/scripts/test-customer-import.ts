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
    assert.equal(
      (await db`SELECT current_database() AS name`)[0].name,
      'renkflow_test',
    );
    const { importCustomers } =
      await import('../lib/features/customers/import.server');

    const tenantId = randomUUID();
    const userId = randomUUID();
    await db`INSERT INTO tenants (id, name, slug) VALUES (${tenantId}, 'Aktarım Test', ${'imp-' + tenantId.slice(0, 8)})`;
    await db`INSERT INTO users (id, email, name) VALUES (${userId}, ${`own-${userId}@test.local`}, 'Sahip')`;
    await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${tenantId}, ${userId}, 'owner')`;
    const actor = { tenantId, userId };
    const commit = async (input: Record<string, unknown>) => {
      const preview = await importCustomers(db, actor, {
        ...input,
        dryRun: true,
      });
      return importCustomers(db, actor, {
        ...input,
        dryRun: false,
        previewHash: preview.previewHash,
      });
    };
    const [byTax] =
      await db`INSERT INTO customers (tenant_id, full_name, company_name, tax_number) VALUES (${tenantId}, 'Işık İnşaat', 'Işık İnşaat A.Ş.', '9876543210') RETURNING id`;
    const [byEmail] =
      await db`INSERT INTO customers (tenant_id, full_name, email) VALUES (${tenantId}, 'Ayşe Yılmaz', 'ayse@ornek.com') RETURNING id`;
    const [byPhone] =
      await db`INSERT INTO customers (tenant_id, full_name, phone) VALUES (${tenantId}, 'Ali Kaya', '0555 000 00 01') RETURNING id`;
    const [byName] =
      await db`INSERT INTO customers (tenant_id, full_name) VALUES (${tenantId}, 'Mehmet Demir') RETURNING id`;
    const count = async () =>
      (
        await db`SELECT count(*)::int AS n FROM customers WHERE tenant_id = ${tenantId}`
      )[0].n;

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
    assert.deepEqual(
      dry.rows.map((r: any) => [r.line, r.outcome]),
      [
        [2, 'exists'],
        [3, 'exists'],
        [4, 'exists'],
        [5, 'name_match'],
        [6, 'new'],
        [7, 'error'],
        [8, 'error'],
      ],
    );
    assert.equal(dry.rows[0].matchedId, byTax.id);
    assert.equal(dry.rows[1].matchedId, byEmail.id);
    assert.equal(dry.rows[2].matchedId, byPhone.id);
    assert.equal(dry.rows[3].matchedId, byName.id);
    assert.equal(await count(), 4, 'dry run writes nothing');

    // With "fill empty fields" the tax-number match gets its city and district, nothing overwritten.
    const filled = await importCustomers(db, actor, {
      text: file,
      dryRun: true,
      fillEmpty: true,
    });
    assert.deepEqual(filled.rows[0], {
      line: 2,
      name: 'IŞIK İNŞAAT A.Ş.',
      outcome: 'fill',
      matchedId: byTax.id,
      filled: ['city', 'district'],
    });

    // Real run: one new card (Zeynep), the city filled on Işık, name-only match left alone.
    const real = await commit({ text: file, fillEmpty: true });
    assert.deepEqual(real.summary, {
      new: 1,
      exists: 2,
      filled: 1,
      nameMatches: 1,
      errors: 2,
    });
    assert.equal(await count(), 5);
    const [isik] =
      await db`SELECT company_name, city, district FROM customers WHERE id = ${byTax.id}`;
    assert.deepEqual(
      [isik.company_name, isik.city, isik.district],
      ['Işık İnşaat A.Ş.', 'İstanbul', 'Kadıköy'],
    );
    const [zeynep] =
      await db`SELECT full_name, phone, email, city, district FROM customers WHERE tenant_id = ${tenantId} AND full_name = 'Zeynep Ak'`;
    assert.deepEqual(
      [zeynep.email, zeynep.city, zeynep.district],
      ['zeynep@ornek.com', 'Bursa', 'Nilüfer'],
    );

    // Importing the same file again creates nothing.
    const again = await commit({ text: file });
    assert.equal(again.summary.new, 0);
    assert.equal(await count(), 5);

    // Name-only matches come in only when asked for.
    const named = await commit({ text: file, includeNameMatches: true });
    assert.equal(named.summary.new, 1);
    assert.equal(await count(), 6);

    // Two imports at the same time: each new person once.
    const parallel =
      'Ad Soyad;E-posta\nCan Er;can@ornek.com\nEce Su;ece@ornek.com';
    const samePreview = await importCustomers(db, actor, { text: parallel });
    const concurrent = await Promise.allSettled(
      [0, 1].map(() =>
        importCustomers(db, actor, {
          text: parallel,
          dryRun: false,
          previewHash: samePreview.previewHash,
        }),
      ),
    );
    assert.equal(concurrent.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(
      concurrent.filter((r) => r.status === 'rejected').length,
      1,
      'the stale concurrent preview requires review',
    );
    assert.equal(
      (
        await db`SELECT count(*)::int AS n FROM customers WHERE tenant_id = ${tenantId} AND email IN ('can@ornek.com', 'ece@ornek.com')`
      )[0].n,
      2,
    );

    // A strong identifier must never select a card when another identifier points elsewhere.
    const conflicting = `Ad Soyad;E-posta;VKN\nYanlış Birleşim;ayse@ornek.com;9876543210`;
    const conflict = await importCustomers(db, actor, {
      text: conflicting,
      fillEmpty: true,
    });
    assert.equal(conflict.rows[0].outcome, 'error');
    assert.match(conflict.rows[0].errors![0], /birden fazla/);
    const beforeConflict = await count();
    await commit({ text: conflicting, fillEmpty: true });
    assert.equal(await count(), beforeConflict);

    // A card with conflicting information is left alone, even when just one identifier matches.
    await db`UPDATE customers SET email = 'isik@ornek.com' WHERE id = ${byTax.id}`;
    const contradicted = await importCustomers(db, actor, {
      text: 'Firma;VKN;E-posta\nIşık;9876543210;farkli@ornek.com',
    });
    assert.equal(contradicted.rows[0].outcome, 'error');

    // Identical names inside a file are simulated during preview as well as commit.
    const sameNames = 'Ad Soyad\nİpek Gül\nİpek Gül';
    const simulated = await importCustomers(db, actor, { text: sameNames });
    assert.deepEqual(
      simulated.rows.map((r) => r.outcome),
      ['new', 'name_match'],
    );
    assert.deepEqual(
      (await commit({ text: sameNames })).summary,
      simulated.summary,
    );

    // Missing confirmation and edits made after the preview cannot write.
    const staleFile = 'Ad Soyad;E-posta\nIşık Önizleme;isik@ornek.com';
    const stale = await importCustomers(db, actor, { text: staleFile });
    await db`UPDATE customers SET notes = 'Arada değiştirildi' WHERE id = ${byTax.id}`;
    const beforeStale = await count();
    await assert.rejects(
      importCustomers(db, actor, {
        text: staleFile,
        dryRun: false,
        previewHash: stale.previewHash,
      }),
      /Önizlemeyi yenileyip/,
    );
    await assert.rejects(
      importCustomers(db, actor, { text: staleFile, dryRun: false }),
      /Önizlemeyi yenileyip/,
    );
    assert.equal(await count(), beforeStale);

    // An unrelated edit need not restart review; only candidates are read and fingerprinted.
    const unrelatedFile =
      'Ad Soyad;E-posta\nBağımsız Önizleme;unrelated-preview@test.local';
    const beforeUnrelated = await importCustomers(db, actor, {
      text: unrelatedFile,
    });
    await db`UPDATE customers SET notes = 'Alakasız güncelleme' WHERE id = ${byTax.id}`;
    const afterUnrelated = await importCustomers(db, actor, {
      text: unrelatedFile,
    });
    assert.equal(beforeUnrelated.previewHash, afterUnrelated.previewHash);

    // Another firm's matching identity is neither leaked nor filled.
    const [otherTenant] =
      await db`INSERT INTO tenants (name, slug) VALUES ('Diğer Firma', ${'other-' + randomUUID()}) RETURNING id`;
    const [foreignCard] =
      await db`INSERT INTO customers (tenant_id, full_name, email) VALUES (${otherTenant.id}, 'Özel Müşteri', 'izolasyon@test.local') RETURNING id`;
    const isolated = await commit({
      text: 'Ad Soyad;E-posta;Not\nYerel Müşteri;izolasyon@test.local;yalnız bu firma',
    });
    assert.equal(isolated.summary.new, 1);
    assert.equal(
      (await db`SELECT notes FROM customers WHERE id = ${foreignCard.id}`)[0]
        .notes,
      null,
    );

    // Archived identities are never duplicated or implicitly reactivated.
    await db`UPDATE customers SET is_active = false WHERE id = ${byPhone.id}`;
    const archived = await importCustomers(db, actor, {
      text: 'Ad Soyad;Telefon\nAli Kaya;05550000001',
    });
    assert.equal(archived.rows[0].outcome, 'error');
    assert.match(archived.rows[0].errors![0], /arşivli/);

    const actions =
      await db`SELECT action, metadata FROM activity_logs WHERE tenant_id = ${tenantId} AND action = 'customers_imported' ORDER BY created_at`;
    assert(actions.length >= 3, 'each import is recorded');

    console.log(
      'PASS · customer import: dry run writes nothing, tax/e-mail/phone matches never duplicate, name-only matches need consent, empty fields filled without overwriting, re-import is a no-op, parallel imports create each person once',
    );
  } finally {
    await db.end({ timeout: 5 });
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
