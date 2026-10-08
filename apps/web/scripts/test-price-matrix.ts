/** Integration test for the price matrix import and lookup, on the isolated local test database only. */
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

async function main() {
  process.env.AUTH_SECRET = 'integration-test-secret-local-only-1234567890';
  process.env.DATABASE_URL = 'postgres://postgres:renkflow-local-only@127.0.0.1:55432/renkflow_test';
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
  await db.unsafe(readFileSync('lib/db/migrations/034_price_matrices.sql', 'utf8'));

  const { importPriceMatrix, checkPrice, priceMatrixOverview, quotePrice } = await import('../lib/features/products/price-matrix.service');
  const { matrixTemplate } = await import('../lib/features/products/price-matrix');
  const { sql } = await import('../lib/db');

  const tenantId = randomUUID(), ownerId = randomUUID(), officeId = randomUUID();
  await db`INSERT INTO tenants (id, name, slug) VALUES (${tenantId}, 'Price matrix test', ${'price-' + tenantId.slice(0, 8)})`;
  for (const [id, role] of [[ownerId, 'owner'], [officeId, 'office']]) {
    await db`INSERT INTO users (id, email, name) VALUES (${id}, ${`${role}-${tenantId}@test.local`}, 'Test')`;
    await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${tenantId}, ${id}, ${role})`;
  }
  const owner = { tenantId, userId: ownerId, role: 'owner' as const };
  const office = { tenantId, userId: officeId, role: 'office' as const };
  const worker = { tenantId, userId: officeId, role: 'worker' as const };

  // No matrix yet: the quote is told so and prices by hand.
  assert.deepEqual(await quotePrice(sql, tenantId, { family: 'pergola', variant: '*', a: 3000, b: 3000, options: {} }), { status: 'no_matrix', message: 'Fiyat matrisi tanımlı değil' });
  const overview = await priceMatrixOverview(office as any);
  assert.equal(overview.canImport, false);
  assert.equal(overview.families.find((f: any) => f.key === 'pergola')!.active, null);
  await assert.rejects(priceMatrixOverview(worker as any), (e: any) => e.status === 403);

  // The firm fills the template (figures made up for the test).
  const filled = matrixTemplate('pergola') + ['pergola;taban;*;1000;4000;1000;4000;;adet;20.000;TRY', 'pergola;opsiyon;*;;;;;motor;adet;3.000;TRY'].join('\r\n') + '\r\n';
  await assert.rejects(importPriceMatrix(office as any, { family: 'pergola', text: filled, dryRun: true }), (e: any) => e.status === 403);
  const bad = await importPriceMatrix(owner as any, { family: 'pergola', text: filled.replace('20.000', ''), dryRun: false });
  assert.equal(bad.ok, false);
  assert.match((bad as any).errors.join(), /birim fiyat boş/);
  const preview: any = await importPriceMatrix(owner as any, { family: 'pergola', text: filled, dryRun: true });
  assert.deepEqual(preview.summary, { family: 'pergola', currency: 'TRY', base: 1, options: 1 });
  assert.equal((await db`SELECT count(*)::int AS n FROM price_matrices WHERE tenant_id = ${tenantId}`)[0].n, 0, 'a preview writes nothing');

  const first: any = await importPriceMatrix(owner as any, { family: 'pergola', fileName: 'fiyat.csv', text: filled, dryRun: false });
  assert.equal(first.ok, true);
  assert.deepEqual(await checkPrice(office as any, { family: 'pergola', a: 3000, b: 2000, options: { motor: true } }), {
    status: 'priced', currency: 'TRY', unitPrice: 23000, matrixId: first.id, unpricedOptions: [],
    lines: [
      { label: 'Ölçü kademesi 1000–4000 × 1000–4000 mm', basis: 'adet', unitPrice: 20000, amount: 20000, row: 7 },
      { label: 'Opsiyon: motor', basis: 'adet', unitPrice: 3000, amount: 3000, row: 8 },
    ],
  });
  assert.equal((await checkPrice(office as any, { family: 'pergola', a: 5000, b: 2000 }) as any).status, 'not_covered');

  // A new import replaces the active matrix; the old one is kept archived.
  const second: any = await importPriceMatrix(owner as any, { family: 'pergola', text: filled.replace('20.000', '21.000'), dryRun: false });
  const rows = await db`SELECT id, status FROM price_matrices WHERE tenant_id = ${tenantId} ORDER BY created_at`;
  assert.deepEqual(rows.map((r: any) => [r.id, r.status]), [[first.id, 'archived'], [second.id, 'active']]);
  assert.equal((await checkPrice(office as any, { family: 'pergola', a: 3000, b: 2000 }) as any).unitPrice, 21000);
  assert.equal((await db`SELECT count(*)::int AS n FROM activity_logs WHERE tenant_id = ${tenantId} AND entity_type = 'price_matrix' AND action = 'imported'`)[0].n, 2);
  console.log('PASS · price matrix: no matrix said so, template filled by the firm, office and worker cannot import, a bad file rejected with the row, a preview writes nothing, import prices a measure with options, a measure outside the matrix not priced, a new import archives the old, imports audited');

  await db.end();
  await sql.end({ timeout: 5 });
}

main().catch((error) => { console.error(error); process.exit(1); });
