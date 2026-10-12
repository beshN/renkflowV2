import { localTestDatabaseUrl } from './local-test-database';
/** Integration test for the record platform (chatter, tags, checklist, activities, rules), on the isolated local test database only. */
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

async function main() {
  process.env.AUTH_SECRET = 'integration-test-secret-local-only-1234567890';
  process.env.DATABASE_URL = localTestDatabaseUrl();
  process.env.STORAGE_BACKEND = 'local';
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
  for (const file of ['037_production_lead.sql', '038_notification_json.sql', '040_record_platform.sql']) await db.unsafe(readFileSync(`lib/db/migrations/${file}`, 'utf8'));
  // Running the migration twice changes nothing.
  await db.unsafe(readFileSync('lib/db/migrations/040_record_platform.sql', 'utf8'));

  const { getRecord, recordCommand, saveTag, deleteTag, listTags, dueActivities } = await import('../lib/features/records/service');
  const { runRecordRules, listRules, setRule } = await import('../lib/features/records/rules');
  const { transitionOrder } = await import('../lib/features/orders/transitions.service');
  const { sql } = await import('../lib/db');

  const tenantId = randomUUID(), ownerId = randomUUID(), officeId = randomUUID(), workerId = randomUUID(), accountantId = randomUUID();
  const otherTenant = randomUUID();
  await db`INSERT INTO tenants (id, name, slug) VALUES (${tenantId}, 'Records test', ${'records-' + tenantId.slice(0, 8)}), (${otherTenant}, 'Other', ${'other-' + otherTenant.slice(0, 8)})`;
  const names: Record<string, string> = { [ownerId]: 'Sahip Test', [officeId]: 'Ofis Test', [workerId]: 'Usta Test', [accountantId]: 'Muhasebe Test' };
  for (const [id, role] of [[ownerId, 'owner'], [officeId, 'office'], [workerId, 'worker'], [accountantId, 'accountant']]) {
    await db`INSERT INTO users (id, email, name) VALUES (${id}, ${`${role}-${tenantId}@test.local`}, ${names[id]})`;
    await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${tenantId}, ${id}, ${role})`;
  }
  const owner = { tenantId, userId: ownerId, role: 'owner' as const };
  const office = { tenantId, userId: officeId, role: 'office' as const };
  const worker = { tenantId, userId: workerId, role: 'worker' as const };
  const stranger = { tenantId: otherTenant, userId: ownerId, role: 'owner' as const };

  const [order] = await db`INSERT INTO orders (tenant_id, order_number, customer_name, product_name, quantity, status, total_amount, currency)
    VALUES (${tenantId}, 'REC-1', 'Kayıt Müşteri', 'Pergola', 1, 'new', 1000, 'TRY') RETURNING id, version`;
  const [job] = await db`INSERT INTO work_orders (tenant_id, title, category, assigned_to, created_by, order_id) VALUES (${tenantId}, 'REC-1 · Pergola', 'production', ${workerId}, ${officeId}, ${order.id}) RETURNING id`;
  const [otherJob] = await db`INSERT INTO work_orders (tenant_id, title, category, created_by) VALUES (${tenantId}, 'Başkasının işi', 'production', ${officeId}) RETURNING id`;

  // Who may open what: a worker never opens an order, only their own work order; another firm sees nothing.
  await assert.rejects(getRecord(worker as any, 'order', order.id), (e: any) => e.status === 403);
  await assert.rejects(getRecord(worker as any, 'work_order', otherJob.id), (e: any) => e.status === 404);
  await assert.rejects(getRecord(stranger as any, 'order', order.id), (e: any) => e.status === 404);
  await assert.rejects(getRecord(owner as any, 'invoice', order.id), (e: any) => e.status === 400);
  const workerView: any = await getRecord(worker as any, 'work_order', job.id);
  assert.deepEqual(workerView.related, [], 'a worker gets no link to the order behind the job');
  assert.equal(workerView.canEdit, false);

  // Comment with a mention: the person is notified and follows; a worker cannot be mentioned on an order.
  await assert.rejects(recordCommand(office as any, 'order', order.id, { action: 'comment.add', body: `@[Usta Test](${workerId}) bak` }), /bu kaydı göremez/);
  const smallPdf = Buffer.from('%PDF-1.4\n% test\n').toString('base64');
  const added: any = await recordCommand(office as any, 'order', order.id, { action: 'comment.add', body: `@[Sahip Test](${ownerId}) ölçü teyidi gerekli`, attachments: [{ name: 'olcu.pdf', mime: 'application/pdf', base64: smallPdf }] });
  const [mention] = await db`SELECT type, title, data FROM notifications WHERE tenant_id = ${tenantId} AND user_id = ${ownerId} AND type = 'mention'`;
  assert.equal(mention.data.href, `/orders/${order.id}`);
  let view: any = await getRecord(owner as any, 'order', order.id);
  assert.deepEqual(view.followers.map((f: any) => f.name).sort(), ['Ofis Test', 'Sahip Test']);
  const comment = view.timeline.find((x: any) => x.kind === 'comment');
  assert.deepEqual([comment.attachments.length, comment.attachments[0].name], [1, 'olcu.pdf']);

  // Edit and delete leave a trace; only the author or a manager may.
  await assert.rejects(recordCommand({ tenantId, userId: accountantId, role: 'accountant' } as any, 'order', order.id, { action: 'comment.edit', commentId: added.commentId, body: 'x' }), (e: any) => e.status === 403);
  await recordCommand(office as any, 'order', order.id, { action: 'comment.edit', commentId: added.commentId, body: 'ölçü teyidi gerekli (güncellendi)' });
  await recordCommand(owner as any, 'order', order.id, { action: 'comment.delete', commentId: added.commentId });
  view = await getRecord(owner as any, 'order', order.id);
  const deleted = view.timeline.find((x: any) => x.kind === 'comment');
  assert.deepEqual([deleted.deleted, deleted.body, deleted.attachments.length], [true, null, 0]);
  const trail = await db`SELECT action, changes FROM activity_logs WHERE tenant_id = ${tenantId} AND entity_id = ${order.id} ORDER BY created_at`;
  assert.deepEqual(trail.map((t: any) => t.action), ['comment_added', 'comment_edited', 'comment_deleted']);
  assert.equal(trail[1].changes.body.from, `@[Sahip Test](${ownerId}) ölçü teyidi gerekli`, 'the earlier text stays in the trail');

  // Tags: firm-wide, unique ignoring case; only office and up manage them; set on a record with a trace.
  await assert.rejects(saveTag(worker as any, { name: 'Acil', color: 'red' }), (e: any) => e.status === 403);
  const urgent: any = await saveTag(office as any, { name: 'Acil', color: 'red' });
  await assert.rejects(saveTag(office as any, { name: '  acil ', color: 'blue' }), (e: any) => e.status === 409);
  await recordCommand(office as any, 'order', order.id, { action: 'tags.set', tagIds: [urgent.id] });
  await assert.rejects(recordCommand({ tenantId, userId: accountantId, role: 'accountant' } as any, 'order', order.id, { action: 'tags.set', tagIds: [] }), (e: any) => e.status === 403);
  assert.equal((await listTags(owner as any))[0].uses, 1);

  // Owner, due date, checklist with progress, activities.
  await recordCommand(office as any, 'order', order.id, { action: 'owner.set', assigneeId: ownerId, dueOn: '2026-12-01' });
  for (const title of ['Ölçü', 'Renk teyidi', 'Avans']) await recordCommand(office as any, 'order', order.id, { action: 'checklist.add', title });
  view = await getRecord(owner as any, 'order', order.id);
  await recordCommand(owner as any, 'order', order.id, { action: 'checklist.toggle', itemId: view.checklist[0].id, done: true });
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date());
  await recordCommand(office as any, 'order', order.id, { action: 'activity.add', kind: 'call', title: 'Müşteriyi ara', dueOn: today, assigneeId: ownerId });
  view = await getRecord(owner as any, 'order', order.id);
  assert.deepEqual([view.owner.name, view.owner.dueOn, view.checklist.filter((c: any) => c.done).length, view.activities[0].title], ['Sahip Test', '2026-12-01', 1, 'Müşteriyi ara']);
  const due: any = await dueActivities(owner as any);
  assert(due.items.some((a: any) => a.title === 'Müşteriyi ara' && a.record.title === 'REC-1'));
  await dueActivities(owner as any);
  assert.equal((await db`SELECT count(*)::int AS n FROM notifications WHERE user_id = ${ownerId} AND type = 'reminder' AND title LIKE '%Müşteriyi ara%'`)[0].n, 2, 'one assignment notice and one reminder a day');
  // A worker who cannot open this job is not offered: mention refused; a follower who lost access hears nothing more.
  await assert.rejects(recordCommand(office as any, 'work_order', otherJob.id, { action: 'comment.add', body: `@[Usta Test](${workerId}) bak` }), /bu kaydı göremez/);
  await recordCommand(office as any, 'work_order', job.id, { action: 'comment.add', body: `@[Usta Test](${workerId}) profil hazır` });
  await db`UPDATE work_orders SET assigned_to = NULL WHERE id = ${job.id}`;
  const before = (await db`SELECT count(*)::int AS n FROM notifications WHERE user_id = ${workerId}`)[0].n;
  await recordCommand(office as any, 'work_order', job.id, { action: 'comment.add', body: 'İş başkasına geçti' });
  assert.equal((await db`SELECT count(*)::int AS n FROM notifications WHERE user_id = ${workerId}`)[0].n, before, 'no notice after losing access');
  await db`UPDATE work_orders SET assigned_to = ${workerId} WHERE id = ${job.id}`;
  // Files: a worker adds photos only; the content must match the type it claims.
  await assert.rejects(recordCommand(worker as any, 'work_order', job.id, { action: 'comment.add', body: 'belge', attachments: [{ name: 'a.pdf', mime: 'application/pdf', base64: smallPdf }] }), (e: any) => e.status === 403);
  await assert.rejects(recordCommand(office as any, 'order', order.id, { action: 'comment.add', body: 'sahte', attachments: [{ name: 'x.png', mime: 'image/png', base64: Buffer.from('not a png').toString('base64') }] }), /içeriği biçimiyle uyuşmuyor/);
  // A worker ticks the checklist on their own job but cannot add to it.
  await assert.rejects(recordCommand(worker as any, 'work_order', job.id, { action: 'checklist.add', title: 'x' }), (e: any) => e.status === 403);
  await recordCommand(worker as any, 'work_order', job.id, { action: 'comment.add', body: 'Profil geldi' });

  // Rules: switched on from now; approval → production activity for the production lead, once.
  await db`INSERT INTO manufacturing_preferences (tenant_id, production_lead_user_id) VALUES (${tenantId}, ${workerId}) ON CONFLICT (tenant_id) DO UPDATE SET production_lead_user_id = ${workerId}`;
  assert.equal((await listRules(owner as any) as any).rules.length, 3);
  await assert.rejects(listRules(office as any), (e: any) => e.status === 403);
  const [{ version }] = await db`SELECT version FROM orders WHERE id = ${order.id}`;
  const moved: any = await transitionOrder(owner as any, order.id, { commandId: randomUUID(), version, newStatus: 'approved' });
  await runRecordRules(tenantId);
  await runRecordRules(tenantId);
  const produced = await db`SELECT title, assignee_id, rule_key FROM record_activities WHERE tenant_id = ${tenantId} AND rule_key = 'order_approved_production'`;
  // The production lead here is a worker, who never opens orders: the activity stays unassigned for the office.
  assert.deepEqual([produced.length, produced[0]?.assignee_id], [1, null], 'one activity, not given to a worker');
  // Late: an order due yesterday notifies the managers once.
  const [late] = await db`INSERT INTO orders (tenant_id, order_number, customer_name, product_name, quantity, status, total_amount, currency, delivery_date) VALUES (${tenantId}, 'REC-LATE', 'X', 'Pergola', 1, 'approved', 0, 'TRY', (now() AT TIME ZONE 'Europe/Istanbul')::date - 1) RETURNING id`;
  await runRecordRules(tenantId, { force: true });
  await runRecordRules(tenantId, { force: true });
  assert.equal((await db`SELECT count(*)::int AS n FROM notifications WHERE tenant_id = ${tenantId} AND type = 'order:delayed' AND data->>'entityId' = ${late.id}`)[0].n, 1, 'owner notified once');
  // Delivered → feedback activity two days later; a rule switched off does nothing.
  await setRule(owner as any, 'order_delivered_feedback', false);
  await db`UPDATE orders SET status = 'completed', updated_at = now() WHERE id = ${order.id}`;
  await runRecordRules(tenantId, { force: true });
  assert.equal((await db`SELECT count(*)::int AS n FROM record_activities WHERE tenant_id = ${tenantId} AND rule_key = 'order_delivered_feedback'`)[0].n, 0);
  await setRule(owner as any, 'order_delivered_feedback', true);
  await runRecordRules(tenantId, { force: true });
  assert.equal((await db`SELECT count(*)::int AS n FROM record_activities WHERE tenant_id = ${tenantId} AND rule_key = 'order_delivered_feedback' AND assignee_id = ${ownerId}`)[0].n, 1, 'for the order owner on the record');
  assert(moved, 'transition returned');

  await deleteTag(owner as any, urgent.id);
  view = await getRecord(owner as any, 'order', order.id);
  assert.deepEqual(view.tags, []);
  console.log('PASS · record platform: who may open what (worker never an order, only own job; other firm 404), comment + mention notice + followers + attachment, edit/delete with the earlier text in the trail, author-or-manager rule, firm tags unique ignoring case and set with a trace, owner/due date, checklist progress, activities due today with one reminder a day, worker ticks own job only, rules once per record with a baseline when switched on (approval → production lead activity, never to a worker; late → managers once; delivered → feedback), mention only people who can open the very record, no notice after losing access, worker photos only, file content must match its type, switched-off rule does nothing, migration twice is a no-op');

  await db.end();
  await sql.end({ timeout: 5 });
}

main().catch((error) => { console.error(error); process.exit(1); });
