/** Supplier CSV: preview, identities, empty-field fills, versions, concurrent writes and role/firm isolation. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { localTestDatabaseURL } from './local-test-database';

async function main() {
  process.env.AUTH_SECRET = 'supplier-import-local-only-123456789012345678';
  process.env.DATABASE_URL = localTestDatabaseURL();
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {}, max: 4 });
  try {
    assert.equal(
      (await db`SELECT current_database() AS name`)[0].name,
      'renkflow_test',
    );
    const { importSuppliers } =
      await import('../lib/features/suppliers/import.server');
    const tenantId = randomUUID(),
      userId = randomUUID();
    await db`INSERT INTO tenants (id, name, slug) VALUES (${tenantId}, 'Tedarikçi Aktarım', ${'simp-' + tenantId})`;
    await db`INSERT INTO users (id, email, name) VALUES (${userId}, ${userId + '@test.local'}, 'Aktarım Sahibi')`;
    await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${tenantId}, ${userId}, 'owner')`;
    const actor = { tenantId, userId, role: 'owner' as const };
    const count = async () =>
      Number(
        (
          await db`SELECT count(*) FROM suppliers WHERE tenant_id = ${tenantId}`
        )[0].count,
      );
    const commit = async (text: string, fillEmpty = false) => {
      const preview = await importSuppliers(db, actor, { text, fillEmpty });
      return importSuppliers(db, actor, {
        text,
        fillEmpty,
        dryRun: false,
        previewHash: preview.previewHash,
      });
    };
    const [existing] =
      await db`INSERT INTO suppliers (tenant_id, name, tax_number, email, contact_name)
      VALUES (${tenantId}, 'Profil A', '1234567890', 'a@ornek.com', '') RETURNING id, version`;
    const text =
      'Firma;Yetkili;VKN;Telefon;E-posta;Adres\nProfil A;Ali Kaya;1234567890;05551112233;a@ornek.com;Sanayi 1\nYeni Cam;Ece Su;;05551114455;cam@ornek.com;OSB 2\nYeni Cam;Başka Yetkili;;;;';
    const preview = await importSuppliers(db, actor, { text, fillEmpty: true });
    assert.deepEqual(
      preview.rows.map((row) => row.outcome),
      ['fill', 'new', 'name_match'],
    );
    assert.equal(await count(), 1);
    const written = await commit(text, true);
    assert.deepEqual(
      written.summary,
      preview.summary,
      'preview simulates additions inside the same file',
    );
    const [filled] =
      await db`SELECT * FROM suppliers WHERE id = ${existing.id}`;
    assert.deepEqual(
      [
        filled.name,
        filled.contact_name,
        filled.phone,
        filled.address,
        filled.email,
        filled.version,
      ],
      [
        'Profil A',
        'Ali Kaya',
        '05551112233',
        'Sanayi 1',
        'a@ornek.com',
        Number(existing.version) + 1,
      ],
    );
    assert.equal(await count(), 2);
    assert.equal((await commit(text, true)).summary.new, 0);
    assert.equal(await count(), 2);

    // The importer rejects mismatched identifiers, archived cards and unsupported duplicate names.
    const conflicting = await importSuppliers(db, actor, {
      text: 'Firma;VKN;E-posta\nYanlış;1234567890;cam@ornek.com',
      fillEmpty: true,
    });
    assert.equal(conflicting.rows[0].outcome, 'error');
    await assert.rejects(
      importSuppliers(db, actor, { text, includeNameMatches: true }),
      /benzersiz/,
    );
    await db`UPDATE suppliers SET is_active = false WHERE id = ${existing.id}`;
    assert.equal(
      (await importSuppliers(db, actor, { text })).rows[0].outcome,
      'error',
    );
    await assert.rejects(
      importSuppliers(db, { ...actor, role: 'accountant' }, { text }),
      /yetkisi/,
    );
    await assert.rejects(
      importSuppliers(db, { ...actor, role: 'worker' }, { text }),
      /yetkisi/,
    );

    // A successful concurrent import invalidates the other confirmation; neither duplicates rows.
    const parallel = 'Firma;E-posta\nBoya B;boya@ornek.com';
    const same = await importSuppliers(db, actor, { text: parallel });
    const settled = await Promise.allSettled(
      [0, 1].map(() =>
        importSuppliers(db, actor, {
          text: parallel,
          dryRun: false,
          previewHash: same.previewHash,
        }),
      ),
    );
    assert.equal(
      settled.filter((result) => result.status === 'fulfilled').length,
      1,
    );
    assert.equal(
      settled.filter((result) => result.status === 'rejected').length,
      1,
    );
    assert.equal(await count(), 3);

    const [other] =
      await db`INSERT INTO tenants (name, slug) VALUES ('Başka Tedarik', ${'simp-other-' + randomUUID()}) RETURNING id`;
    const [foreign] =
      await db`INSERT INTO suppliers (tenant_id, name, email) VALUES (${other.id}, 'Yabancı Kart', 'izole@ornek.com') RETURNING id`;
    assert.equal(
      (await commit('Firma;E-posta;Not\nYerel Kart;izole@ornek.com;yerel not'))
        .summary.new,
      1,
    );
    assert.equal(
      (await db`SELECT notes FROM suppliers WHERE id = ${foreign.id}`)[0].notes,
      null,
    );
    assert(
      (
        await db`SELECT 1 FROM activity_logs WHERE tenant_id = ${tenantId} AND action = 'suppliers_imported'`
      ).length > 0,
    );
    console.log(
      'PASS · supplier import: preview/commit agree, identity conflicts refused, existing values preserved, version incremented, repeats and concurrent writes never duplicate, archived cards and unauthorized roles refused, firms isolated and audit written',
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
