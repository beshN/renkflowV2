/** Real PostgreSQL + private local files; only the external model response is stubbed. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { localTestDatabaseURL } from './local-test-database';
async function main() {
  process.env.DATABASE_URL = localTestDatabaseURL();
  process.env.AUTH_SECRET = 'local-office-test-secret-not-for-production';
  process.env.OFFICE_PROVIDER = 'opencode';
  process.env.OPENCODE_API_KEY = 'local-test-not-a-key';
  process.env.STORAGE_BACKEND = 'local';
  process.env.ALLOW_LOCAL_STORAGE = '1';
  const db = postgres(process.env.DATABASE_URL, { max: 2 });
  const { runOfficeTask } = await import('../lib/features/office/runner.server');
  const { decide } = await import('../lib/features/office/routing');
  const { actOnOfficeTask, listOfficeTasks, readOfficeFile } = await import('../lib/features/office/service.server');
  const { deleteFile } = await import('../lib/storage');
  const [tenant] = await db`INSERT INTO tenants(name,slug) VALUES('Office test',${'office-' + randomUUID()}) RETURNING id`;
  const [user] = await db`INSERT INTO users(name,email) VALUES('Office owner',${randomUUID() + '@test.invalid'}) RETURNING id`;
  await db`INSERT INTO tenant_members(tenant_id,user_id,role) VALUES(${tenant.id},${user.id},'owner')`;
  await db`INSERT INTO ai_settings(tenant_id,mode,kvkk_ack_at,user_daily_calls) VALUES(${tenant.id},'assist',now(),100)`;
  const actor = { tenantId: tenant.id, userId: user.id, role: 'owner' as const };
  const originalFetch = global.fetch;
  let deliveries = 0, reviews = 0;
  global.fetch = async (_url, options) => {
    const request = JSON.parse(String(options?.body));
    const tool = request.tools[0].function.name;
    let value;
    if (tool === 'teslim_et') {
      deliveries++;
      value = { question: '', summary: 'Tablo hazır.', files: [{ name: 'gider.csv', format: 'csv', content: `Kalem,Tutar\nKira,20000\nMaaş,9000\nİnternet,600\nToplam,${deliveries === 1 ? 29000 : 29600}` }] };
    } else {
      reviews++;
      value = reviews === 1 ? { approve: false, score: 5, note: 'Toplam 29600 olmalı.', issues: ['Toplam yanlış.'] } : { approve: true, score: 9, note: 'Toplam doğru.', issues: [] };
    }
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'tool_calls', message: { tool_calls: [{ function: { name: tool, arguments: JSON.stringify(value) } }] } }], usage: { prompt_tokens: 10, completion_tokens: 10 } }), { status: 200 });
  };
  try {
    const decision = decide({ category: 'spreadsheet', title: 'Gider', brief: '', revisions: 0 });
    const [task] = await db`INSERT INTO office_tasks(tenant_id,number,category,title,brief,agent_id,decision,created_by) VALUES(${tenant.id},1,'spreadsheet','Gider','Toplamı hesapla','murat',${db.json(decision as any)},${user.id}) RETURNING id`;
    await Promise.all([runOfficeTask(tenant.id, task.id), runOfficeTask(tenant.id, task.id)]);
    const [row] = await db`SELECT * FROM office_tasks WHERE tenant_id=${tenant.id} AND id=${task.id}`;
    assert.equal(row.status, 'review', 'timestamp lease must allow the owning runner to deliver');
    assert.equal(row.revisions, 1);
    assert.equal(deliveries, 2, 'duplicate dispatch must not run a second worker');
    assert.equal(reviews, 2);
    assert.equal(row.decision.review.status, 'approved');
    assert.equal(row.decision.reviewHistory.length, 2);
    const listed = await listOfficeTasks(actor);
    assert.equal(listed.tasks[0].files.length, 2, 'both revision files stay available');
    const file = listed.tasks[0].files.find(f => f.revision === 1)!;
    const downloaded = await readOfficeFile(actor, file.id);
    assert.match(await new Response(downloaded.body).text(), /29600/);
    await assert.rejects(readOfficeFile({ ...actor, tenantId: randomUUID() }, file.id));
    await actOnOfficeTask(actor, task.id, { action: 'approve' });
    assert.equal((await db`SELECT status FROM office_tasks WHERE tenant_id=${tenant.id} AND id=${task.id}`)[0].status, 'approved');
    // The records the office reads: the task giver's own firm, as that member, and nothing for a stranger.
    const { companyProfile, lookUpRecords, taskActor } = await import('../lib/features/office/data.server');
    await db`INSERT INTO customers(tenant_id,full_name,company_name) VALUES(${tenant.id},'Ayşe Demir','Demir Yapı')`;
    const reader = await taskActor(tenant.id, user.id);
    assert.equal(reader?.role, 'owner');
    const customers = await lookUpRecords(reader, 'customers', 'Demir') as Array<{ company_name: string }>;
    assert.deepEqual(customers.map(c => c.company_name), ['Demir Yapı']);
    for (const kind of ['orders', 'materials', 'jobs', 'quotations', 'suppliers', 'shipments', 'recipes', 'warehouses', 'purchases']) await lookUpRecords(reader, kind, '');
    assert.equal(await taskActor(tenant.id, randomUUID()), null);
    assert.match(JSON.stringify(await lookUpRecords(null, 'customers', '')), /erişimi yok/);
    assert.equal((await companyProfile(tenant.id))?.name, 'Office test');
    console.log('PASS: claim concurrency, review, automatic correction, real files, tenant isolation, human approval, record lookups');
  } finally {
    global.fetch = originalFetch;
    const files = await db`SELECT storage_key FROM office_files WHERE tenant_id=${tenant.id}`;
    for (const file of files) await deleteFile(file.storage_key);
    await db`DELETE FROM tenants WHERE id=${tenant.id}`;
    await db`DELETE FROM users WHERE id=${user.id}`;
    await db.end();
  }
}
main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
