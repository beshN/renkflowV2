import { localTestDatabaseURL } from "./local-test-database";
import mobileSpec from '../../../contracts/mobile/openapi.json';
/** Real route/service/database checks; hard-wired to the isolated local test DB. */
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

async function main() {
  process.env.AUTH_SECRET = 'field-integration-local-only-12345678901234567890';
  process.env.DATABASE_URL = localTestDatabaseURL();
  process.env.STORAGE_BACKEND = 'local';
  delete process.env.PRIVATE_ACCESS_EMAIL;
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
  const { NextRequest } = await import('next/server');
  const { GET, POST } = await import('../app/api/mobile/v1/[...path]/route');
  async function send(request: InstanceType<typeof NextRequest>, path: string[]) {
    const base = process.argv.find(value => value.startsWith('--server='))?.slice(9);
    if (!base) return (request.method === 'POST' ? POST : GET)(request, { params: Promise.resolve({ path }) });
    const url = new URL(base);
    assert(['127.0.0.1', 'localhost'].includes(url.hostname) && url.port, 'HTTP integration is restricted to an explicit local server');
    return fetch(url.origin + request.nextUrl.pathname + request.nextUrl.search, {
      method: request.method, headers: request.headers,
      ...(request.method === 'POST' ? { body: await request.text() } : {}), redirect: 'manual',
    });
  }
  const login = (request: InstanceType<typeof NextRequest>) => send(request, ['auth', 'login']);
  const { createWorkOrder, CreateWorkOrderInputSchema } = await import('../lib/features/work-orders/service');
  const [tenant] = await db`INSERT INTO tenants(name,slug) VALUES('Native field integration',${'field-' + randomUUID()}) RETURNING id`;
  const password = 'Local-test-only-Strong-948!';
  const hash = await bcrypt.hash(password, 10);
  const [owner] = await db`INSERT INTO users(name,email,password,email_verified) VALUES('Field owner',${randomUUID() + '@example.invalid'},${hash},now()) RETURNING id,email`;
  const [worker] = await db`INSERT INTO users(name,email,password,email_verified) VALUES('Field operator',${randomUUID() + '@example.invalid'},${hash},now()) RETURNING id,email`;
  await db`INSERT INTO tenant_members(tenant_id,user_id,role) VALUES(${tenant.id},${owner.id},'owner'),(${tenant.id},${worker.id},'worker')`;
  const ownerActor = { tenantId: tenant.id, userId: owner.id, role: 'owner' as const };
  const loginResponse = await login(new NextRequest('https://renkflow.com/api/mobile/v1/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-renkflow-app-version': mobileSpec.info.version, 'x-renkflow-platform': 'android' }, body: JSON.stringify({ email: worker.email, password }) }));
  assert.equal(loginResponse.status, 200);
  const token = (await loginResponse.json()).data.accessToken;
  assert.equal(typeof token, 'string');
  async function call(path: string[], body?: unknown, expected = 200, query = '') {
    const request = new NextRequest('https://renkflow.com/api/mobile/v1/' + path.join('/') + query, {
      method: body === undefined ? 'GET' : 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', 'x-renkflow-app-version': mobileSpec.info.version, 'x-renkflow-platform': 'android' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const response = await send(request, path);
    const result = await response.json();
    assert.equal(response.status, expected, result.error);
    return result.data;
  }
  const job = await createWorkOrder(ownerActor, CreateWorkOrderInputSchema.parse({ title: 'Saha bakım kontrolü', assignedToUserId: worker.id, checklist: [{ title: 'Emniyet kontrolü', required: true }] }));
  const other = await createWorkOrder(ownerActor, CreateWorkOrderInputSchema.parse({ title: 'Başka operatörün işi', assignedToUserId: owner.id }));
  const details = await call(['work-orders', job.id]);
  await call(['work-orders', other.id], undefined, 404);
  await call(['work-orders', job.id, 'checklist', details.checklist[0].id], { completed: true });
  await call(['work-orders', job.id, 'comments'], { body: 'Sahadan gerçek API test notu' });
  await call(['work-orders', job.id, 'transition'], { status: 'in_progress' });
  await call(['work-orders', job.id, 'transition'], { status: 'done' }, 403);
  const updated = await call(['work-orders', job.id]);
  assert.equal(updated.checklist[0].completed, true); assert.equal(updated.comments.length, 1); assert.equal(updated.status, 'in_progress');
  console.log('PASS · real password sign-in, assignment isolation, checklist, note and worker terminal restriction');

  const [order] = await db`INSERT INTO orders(tenant_id,order_number,customer_name,total_amount,status) VALUES(${tenant.id},${'FIELD-' + randomUUID()},'Never sent to field clients',999,'in_production') RETURNING id`;
  const [item] = await db`INSERT INTO inventory_items(tenant_id,sku,name,item_type,stock_uom) VALUES(${tenant.id},'FIELD-FINISHED','Test finished item','finished_good','adet') RETURNING id`;
  const [recipe] = await db`INSERT INTO production_recipes(tenant_id,code,name,version,finished_item_id,rules,operations,limits) VALUES(${tenant.id},'FIELD','Test route',1,${item.id},'[]','[]','{}') RETURNING id`;
  const productionJob = await createWorkOrder(ownerActor, CreateWorkOrderInputSchema.parse({ title: 'Native üretim işi', assignedToUserId: owner.id }));
  await db`UPDATE work_orders SET order_id=${order.id},recipe_id=${recipe.id},planned_qty=5,produced_qty=0,reservation_status='transferred',configuration='{}',bom_snapshot='{"cuts":[]}' WHERE id=${productionJob.id}`;
  await db`INSERT INTO work_centers(tenant_id,code,name,parallel_capacity) VALUES(${tenant.id},'FIELD','Test center',2)`;
  const [op] = await db`INSERT INTO production_operations(tenant_id,work_order_id,position,name,work_center_code,planned_minutes,status,assigned_to,planned_qty,quality_checks) VALUES(${tenant.id},${productionJob.id},0,'Ölçüm ve montaj','FIELD',10,'ready',${worker.id},5,'[{"id":"visual","name":"Görsel kontrol","kind":"pass_fail","unit":""}]') RETURNING id`;
  await db`INSERT INTO production_operations(tenant_id,work_order_id,position,name,work_center_code,planned_minutes,status,assigned_to,planned_qty) VALUES(${tenant.id},${productionJob.id},1,'Paketleme','FIELD',10,'waiting',${worker.id},5)`;
  const fixture = process.argv.find(value => value.startsWith('--fixture='))?.slice(10);
  if (fixture) {
    assert(fixture.startsWith('/tmp/') || fixture.startsWith('/workspace/tooling/'), 'Fixture must stay outside the repository');
    const code = 'RF-J-' + randomBytes(6).toString('hex').toUpperCase();
    await db`INSERT INTO factory_labels(tenant_id,kind,record_id,code,created_by) VALUES(${tenant.id},'job',${productionJob.id},${code},${owner.id})`;
    const image = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#112d32' } }).jpeg().toBuffer();
    const largeImage=await sharp(randomBytes(1024*1024*3),{raw:{width:1024,height:1024,channels:3}}).jpeg({quality:90}).toBuffer();
    await writeFile(fixture, JSON.stringify({ jpegLarge:largeImage.toString('base64'), email: worker.email, password, jobId: job.id, productionJobId: productionJob.id, operationId: op.id, code, jpeg: image.toString('base64') }), { mode: 0o600 });
    await db.end(); return;
  }
  const references = await call(['references']);
  assert.equal(references.capabilities.remotePush, false);
  assert.equal(references.capabilities.crashReporting, false);
  const snapshot = await call(['snapshot']);
  assert(snapshot.workOrders.some((j: any) => j.id === productionJob.id));
  assert(!JSON.stringify(snapshot).includes('Never sent to field clients'));
  assert(!JSON.stringify(snapshot).includes('bom_snapshot'));
  const command = (action: string, version: number, extra: object = {}) => ({ commandId: randomUUID(), action: 'operation', data: { operationId: op.id, version, action, ...extra } });
  const start = command('start', 1);
  await call(['commands'], start); await call(['commands'], start);
  assert.equal((await db`SELECT version FROM production_operations WHERE id=${op.id}`)[0].version, 2);
  await call(['commands'], command('pause', 1), 409);
  const rejected = await call(['commands'], command('complete', 2, { quantity: 1, qualityResults: [{ checkId: 'visual', passed: false }] }));
  assert.equal(rejected.qualityRejected, true);
  await call(['commands'], command('start', 3));
  const partial = command('complete', 4, { quantity: 2, qualityResults: [{ checkId: 'visual', passed: true }] });
  await call(['commands'], partial); await call(['commands'], partial);
  assert.equal(Number((await db`SELECT completed_qty FROM production_operations WHERE id=${op.id}`)[0].completed_qty), 2);
  const result = await call(['snapshot']);
  assert.equal(result.operations.find((o: any) => o.id === op.id).status, 'paused');
  console.log('PASS · real assigned production union, start/replay, stale-version refusal, quality block and idempotent partial completion');

  const code = 'RF-J-' + randomBytes(6).toString('hex').toUpperCase();
  await db`INSERT INTO factory_labels(tenant_id,kind,record_id,code,created_by) VALUES(${tenant.id},'job',${productionJob.id},${code},${owner.id})`;
  const scan = await call(['scan'], undefined, 200, '?code=' + encodeURIComponent(code));
  assert.equal(scan.workOrderId, productionJob.id);
  const image = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#112d32' } }).jpeg().toBuffer();
  const photo = await call(['files'], { name: 'field-test.jpg', mime: 'image/jpeg', base64: image.toString('base64'), workOrderId: productionJob.id });
  assert(photo.url.startsWith('/api/v1/production/files/' + tenant.id));
  await call(['files'], { name: 'denied.jpg', mime: 'image/jpeg', base64: image.toString('base64'), workOrderId: other.id }, 404);
  const forbiddenKeys = new Set(['price','cost','profit','totalAmount','customerName','customerEmail','customerPhone','customerAddress','recipeId','recipe_id','bom_snapshot','bomSnapshot','configuration']);
  function assertTechnical(value: unknown) {
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) { assert(!forbiddenKeys.has(key), 'Forbidden DTO key: ' + key); assertTechnical(item); }
  }
  for (const role of ['owner','admin','office','worker','accountant','member']) {
    await db`UPDATE tenant_members SET role=${role} WHERE tenant_id=${tenant.id} AND user_id=${worker.id}`;
    const allowed = ['owner','admin','office','worker'].includes(role);
    const view = await call(['snapshot'], undefined, allowed ? 200 : 403);
    if (allowed) { assertTechnical(view); assertTechnical(await call(['work-orders', productionJob.id])); assert(!JSON.stringify(view).includes('Never sent to field clients')); }
  }
  await db`UPDATE tenant_members SET role='worker' WHERE tenant_id=${tenant.id} AND user_id=${worker.id}`;
  console.log('PASS · real HTTP DTO isolation for six base roles, including denied roles');
  const prefs = await call(['notifications','preferences']); assert.equal(prefs.assignment,true);
  await call(['notifications','preferences'], { assignment:false, mention:true, delay:false });
  assert.equal((await call(['notifications','preferences'])).assignment,false);
  await db`INSERT INTO notifications(id,user_id,tenant_id,type,title,message,data) VALUES(${randomUUID()},${worker.id},${tenant.id},'work_order:assigned','PRIVATE price 999','PRIVATE customer phone','{"customerPhone":"PRIVATE"}')`;
  const notifications = await call(['notifications']); assert.equal(notifications.provider,'disconnected'); assert(!JSON.stringify(notifications).includes('PRIVATE')); assertTechnical(notifications);
  const [tables] = await db`SELECT to_regclass('public.installations') IS NOT NULL AS installations,to_regclass('public.access_roles') IS NOT NULL AS roles`;
  const installations = await call(['installations']);
  if (tables.installations) {
    const [installation] = await db`INSERT INTO installations(tenant_id,installation_number,order_id,crew,address,signed_name) VALUES(${tenant.id},${'MNT-'+randomUUID()},${order.id},ARRAY[${worker.id}::uuid],'PRIVATE site address','PRIVATE customer') RETURNING id`;
    const list = await call(['installations']); assert(list.installations.some((i:any)=>i.id===installation.id)); assert(!JSON.stringify(list).includes('PRIVATE')); assertTechnical(list);
  } else assert.equal(installations.available,false);
  if (tables.roles) {
    await db`UPDATE tenant_members SET role='office',access_role='warehouse' WHERE tenant_id=${tenant.id} AND user_id=${worker.id}`;
    assert.equal((await call(['snapshot'])).permissions.transition,false);
    await call(['commands'], command('start',1),403); await call(['installations'],undefined,403);
    const [custom] = await db`INSERT INTO access_roles(tenant_id,name,name_key,base_role,permissions) VALUES(${tenant.id},'Local mobile read only',${randomUUID()},'worker','{"production":["view"],"inventory":["view","edit"]}') RETURNING id`;
    await db`UPDATE tenant_members SET role='worker',access_role=${custom.id} WHERE tenant_id=${tenant.id} AND user_id=${worker.id}`;
    assert.equal((await call(['snapshot'])).permissions.comment,false); await call(['commands'],command('start',1),403);
    await db`UPDATE tenant_members SET access_role='owner' WHERE tenant_id=${tenant.id} AND user_id=${worker.id}`;
    await call(['snapshot'],undefined,403);
    await db`UPDATE tenant_members SET access_role='operator',deactivated_at=now() WHERE tenant_id=${tenant.id} AND user_id=${worker.id}`;
    await call(['snapshot'],undefined,401);
    await db`UPDATE tenant_members SET deactivated_at=NULL WHERE tenant_id=${tenant.id} AND user_id=${worker.id}`;
    await db`UPDATE users SET sessions_valid_after=now()+interval '2 seconds' WHERE id=${worker.id}`;
    await call(['snapshot'],undefined,401);
    await db`UPDATE users SET sessions_valid_after=NULL WHERE id=${worker.id}`;
    console.log('PASS · new-schema warehouse/custom-role denial, deactivation and session cutoff');
  }
  console.log('PASS · technical installation/notification projections and shared preference persistence');
  await db`DELETE FROM tenant_members WHERE tenant_id=${tenant.id} AND user_id=${worker.id}`;
  await call(['snapshot'], undefined, 401);
  console.log('PASS · real barcode resolution, scoped photo persistence and immediate membership revocation');
  await db.end();
}
main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
