/** Real route/service/database checks; hard-wired to the isolated local test DB. */
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';

async function main() {
  process.env.AUTH_SECRET = 'field-integration-local-only-12345678901234567890';
  process.env.DATABASE_URL = 'postgres://postgres:renkflow-local-only@127.0.0.1:55432/renkflow_test';
  process.env.STORAGE_BACKEND = 'local';
  delete process.env.PRIVATE_ACCESS_EMAIL;
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
  const { NextRequest } = await import('next/server');
  const { GET, POST } = await import('../app/api/v1/field/[...path]/route');
  const { POST: login } = await import('../app/api/v1/auth/login/route');
  const { createWorkOrder, CreateWorkOrderInputSchema } = await import('../lib/features/work-orders/service');
  const [tenant] = await db`INSERT INTO tenants(name,slug) VALUES('Native field integration',${'field-' + randomUUID()}) RETURNING id`;
  const password = 'Local-test-only-Strong-948!';
  const hash = await bcrypt.hash(password, 10);
  const [owner] = await db`INSERT INTO users(name,email,password,email_verified) VALUES('Field owner',${randomUUID() + '@example.invalid'},${hash},now()) RETURNING id,email`;
  const [worker] = await db`INSERT INTO users(name,email,password,email_verified) VALUES('Field operator',${randomUUID() + '@example.invalid'},${hash},now()) RETURNING id,email`;
  await db`INSERT INTO tenant_members(tenant_id,user_id,role) VALUES(${tenant.id},${owner.id},'owner'),(${tenant.id},${worker.id},'worker')`;
  const ownerActor = { tenantId: tenant.id, userId: owner.id, role: 'owner' as const };
  const loginResponse = await login(new NextRequest('https://renkflow.com/api/v1/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: worker.email, password }) }));
  assert.equal(loginResponse.status, 200);
  const token = (await loginResponse.json()).data.accessToken;
  assert.equal(typeof token, 'string');
  async function call(path: string[], body?: unknown, expected = 200, query = '') {
    const request = new NextRequest('https://renkflow.com/api/v1/field/' + path.join('/') + query, {
      method: body === undefined ? 'GET' : 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const response = await (body === undefined ? GET : POST)(request, { params: Promise.resolve({ path }) });
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
  await db`DELETE FROM tenant_members WHERE tenant_id=${tenant.id} AND user_id=${worker.id}`;
  await call(['snapshot'], undefined, 401);
  console.log('PASS · real barcode resolution, scoped photo persistence and immediate membership revocation');
  await db.end();
}
main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
