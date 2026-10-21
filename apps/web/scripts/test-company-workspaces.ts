/** Host-bound real credentials and tenant-isolated knowledge revisions on a disposable PostgreSQL. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import bcrypt from 'bcryptjs';
import postgres from 'postgres';
import { localTestDatabaseURL } from './local-test-database';
async function main() {
  process.env.DATABASE_URL = localTestDatabaseURL();
  process.env.AUTH_SECRET = 'company-test-only-1234567890123456789012345';
  process.env.STORAGE_BACKEND = 'local';
  process.env.ALLOW_LOCAL_STORAGE = '1';
  delete process.env.PRIVATE_ACCESS_EMAIL;
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal(
    (await db`SELECT current_database() AS name`)[0].name,
    'renkflow_test',
  );
  const tenants = [];
  for (const name of ['Atölye A', 'Atölye B']) {
    const [t] =
      await db`INSERT INTO tenants(name,slug) VALUES(${name},${'company-' + randomUUID()}) RETURNING *`;
    tenants.push(t);
  }
  const email = randomUUID() + '@example.invalid',
    password = 'Workspace-Test-123!';
  const [u] =
    await db`INSERT INTO users(name,email,password,email_verified) VALUES('Workspace QA',${email},${await bcrypt.hash(password, 10)},now()) RETURNING id`;
  for (const t of tenants)
    await db`INSERT INTO tenant_members(tenant_id,user_id,role) VALUES(${t.id},${u.id},'owner')`;
  const a = { userId: u.id, tenantId: tenants[0].id, role: 'owner' as const },
    b = { ...a, tenantId: tenants[1].id };
  const { saveCompanyAddress } =
    await import('../lib/features/company/address.server');
  const { companyForHost, assertCompanyHostTenant } =
    await import('../lib/features/company/host.server');
  const address = 'qa-' + randomUUID().slice(0, 8),
    other = 'qb-' + randomUUID().slice(0, 8);
  await saveCompanyAddress(a, { address, version: 1 });
  await saveCompanyAddress(b, { address: other, version: 1 });
  assert.equal(
    (await companyForHost(address + '.renkflow.com'))?.id,
    a.tenantId,
  );
  await assert.rejects(
    () => assertCompanyHostTenant(b.tenantId, address + '.renkflow.com'),
    (e: any) => e.status === 403,
  );
  await assert.rejects(
    () => companyForHost('missing-' + randomUUID() + '.renkflow.com'),
    (e: any) => e.status === 404,
  );
  await assert.rejects(
    () => saveCompanyAddress(b, { address, version: 2 }),
    (e: any) => e.status === 409,
  );
  await assert.rejects(
    () => saveCompanyAddress(a, { address: 'new-' + address, version: 0 }),
    (e: any) => e.status === 409,
  );
  const { authConfig } = await import('../lib/core/auth.config');
  const provider = authConfig.providers.find(
    (p: any) => p.id === 'credentials',
  ) as any;
  const login = (host: string) =>
    provider.options.authorize(
      { email, password },
      new Request('https://' + host + '/api/auth/callback/credentials', {
        headers: {
          host,
          'x-forwarded-host': other + '.renkflow.com',
          'x-tenant-id': b.tenantId,
          'x-forwarded-for': '10.21.1.4',
        },
      }),
    );
  assert.equal((await login(address + '.renkflow.com')).tenantId, a.tenantId);
  assert.equal((await login(other + '.renkflow.com')).tenantId, b.tenantId);
  await db`UPDATE tenant_members SET deactivated_at=now() WHERE tenant_id=${b.tenantId} AND user_id=${u.id}`;
  await assert.rejects(() => login(other + '.renkflow.com'));
  await db`UPDATE tenant_members SET deactivated_at=NULL WHERE tenant_id=${b.tenantId} AND user_id=${u.id}`;
  const k = await import('../lib/features/knowledge/service.server');
  const category = await k.createKnowledgeCategory(a, {
    name: 'Teknik talimatlar',
  });
  const pdf = readFileSync('__tests__/fixtures/foy/pergola-two-systems.pdf');
  const doc = await k.saveKnowledge(a, {
    title: 'Pergola montajı',
    content: 'Bağlantı noktalarını ölçün.',
    categoryId: category.id,
    visibility: 'company',
    version: 0,
    file: {
      name: 'montaj.pdf',
      mime: 'application/pdf',
      base64: pdf.toString('base64'),
    },
  });
  assert.equal(
    (await k.listKnowledge(a, { q: 'Pergola' })).documents.length,
    1,
  );
  assert.equal((await k.listKnowledge(b)).documents.length, 0);
  await assert.rejects(
    () => k.readKnowledge(b, doc.id),
    (e: any) => e.status === 404,
  );
  const before = await k.readKnowledge(a, doc.id);
  assert.ok(before.fileKey);
  assert.equal(before.revision.file_name, 'montaj.pdf');
  const saved = await k.saveKnowledge(a, {
    id: doc.id,
    version: 1,
    title: 'Pergola montajı',
    content: 'Revize teknik talimat',
    visibility: 'office',
    categoryId: category.id,
    note: 'Ölçü kontrolü eklendi',
  });
  assert.equal(saved.version, 2);
  const old = await k.readKnowledge(a, doc.id, 1);
  assert.equal(old.revision.content, 'Bağlantı noktalarını ölçün.');
  assert.equal((await k.readKnowledge(a, doc.id)).fileKey, before.fileKey);
  await assert.rejects(
    () => k.saveKnowledge(a, { id: doc.id, version: 1, title: 'Eski kayıt' }),
    (e: any) => e.status === 409,
  );
  const attempts = await Promise.allSettled([
    k.saveKnowledge(a, {
      id: doc.id,
      version: 2,
      title: 'Concurrent A',
      visibility: 'office',
    }),
    k.saveKnowledge(a, {
      id: doc.id,
      version: 2,
      title: 'Concurrent B',
      visibility: 'office',
    }),
  ]);
  assert.equal(attempts.filter((r) => r.status === 'fulfilled').length, 1);
  await assert.rejects(
    () =>
      db`UPDATE knowledge_revisions SET content='tampered' WHERE document_id=${doc.id}`,
  );
  const [worker] =
    await db`INSERT INTO users(name,email) VALUES('Operator',${randomUUID() + '@example.invalid'}) RETURNING id`;
  await db`INSERT INTO tenant_members(tenant_id,user_id,role) VALUES(${a.tenantId},${worker.id},'worker')`;
  const workerActor = {
    tenantId: a.tenantId,
    userId: worker.id,
    role: 'worker' as const,
  };
  assert.equal((await k.listKnowledge(workerActor)).documents.length, 0);
  await assert.rejects(
    () => k.readKnowledge(workerActor, doc.id, 1),
    (e: any) => e.status === 404,
  );
  await assert.rejects(
    () => k.saveKnowledge(workerActor, { title: 'Unauthorized' }),
    (e: any) => e.status === 403,
  );
  await assert.rejects(
    () =>
      k.saveKnowledge(b, { title: 'Wrong category', categoryId: category.id }),
    (e: any) => e.status === 404,
  );
  await k.archiveKnowledge(a, doc.id, { version: 3, archived: true });
  assert.equal((await k.listKnowledge(a)).documents.length, 0);
  assert.equal(
    (await k.listKnowledge(a, { archived: true })).documents.length,
    1,
  );
  await k.archiveKnowledge(a, doc.id, { version: 3, archived: false });
  if (process.env.RENKFLOW_BROWSER_FIXTURE === '1') {
    mkdirSync('../../.data', { recursive: true });
    writeFileSync(
      '../../.data/workspace-browser-fixture.json',
      JSON.stringify({
        email,
        password,
        tenantId: a.tenantId,
        userId: u.id,
        address,
        other,
        documentId: doc.id,
        categoryId: category.id,
      }),
      { mode: 0o600 },
    );
  }
  console.log(
    'PASS host-scoped multi-membership login, forwarded header spoof rejection, address conflicts, unknown/deactivated company, private PDF storage, search, immutable history, concurrent edits, archive restore and tenant/worker isolation',
  );
  await db.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
