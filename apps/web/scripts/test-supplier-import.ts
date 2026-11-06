/** Supplier import on the isolated throwaway PostgreSQL only. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { localTestDatabaseURL } from './local-test-database';
async function main() {
  process.env.DATABASE_URL = localTestDatabaseURL();
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  try {
    assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
    const { importSuppliers } = await import('../lib/features/suppliers/import.server');
    const a = randomUUID(), b = randomUUID(), userId = randomUUID();
    await db`INSERT INTO tenants (id,name,slug) VALUES (${a},'Import A',${a}),(${b},'Import B',${b})`;
    await db`INSERT INTO users (id,email,name) VALUES (${userId},${userId + '@test.local'},'Import')`;
    const [other] = await db`INSERT INTO suppliers (tenant_id,name,tax_number,email,phone) VALUES (${b},'Firma','1234567890','firma@test.local','05551112233') RETURNING id`;
    const [existing] = await db`INSERT INTO suppliers (tenant_id,name,email,notes,payment_terms) VALUES (${a},'Mevcut','mevcut@test.local','Dolu',0) RETURNING id`;
    const actor = { tenantId: a, userId };
    const text = 'Ad;VKN;E-posta;Telefon;Not;Adres;Vade\nFirma;1234567890;firma@test.local;05551112233;;;30\nMevcut;;mevcut@test.local;;Yeni;Adres;20\nFirma;1234567890;firma@test.local;05551112233;;;30';
    const count = async () => (await db`SELECT count(*)::int AS n FROM suppliers WHERE tenant_id=${a}`)[0].n;
    const dry = await importSuppliers(db, actor, { text, fillEmpty: true });
    assert.equal(await count(), 1);
    assert.deepEqual(dry.rows.map(r => r.outcome), ['new','fill','exists']);
    assert(!dry.rows.some(r => r.matchedId === other.id));
    const real = await importSuppliers(db, actor, { text, dryRun: false, fillEmpty: true });
    assert.deepEqual(real.summary, dry.summary);
    assert.equal(await count(), 2);
    const [filled] = await db`SELECT notes,address,payment_terms FROM suppliers WHERE tenant_id=${a} AND id=${existing.id}`;
    assert.deepEqual([filled.notes,filled.address,filled.payment_terms], ['Dolu','Adres',0]);
    const again = await importSuppliers(db, actor, { text, dryRun: false, fillEmpty: true });
    assert.equal(again.summary.new, 0);
    assert.equal(await count(), 2);
    assert.equal((await db`SELECT count(*)::int AS n FROM suppliers WHERE tenant_id=${b}`)[0].n, 1);
    assert.equal((await db`SELECT count(*)::int AS n FROM production_events WHERE tenant_id=${a} AND event_type='procurement.supplier.save'`)[0].n, 2);
    console.log('PASS · supplier import: A/B isolation, dry run, real write, fillEmpty, idempotent repeat, activity events');
  } finally { await db.end({ timeout: 5 }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
