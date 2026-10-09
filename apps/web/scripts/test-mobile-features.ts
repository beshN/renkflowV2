/** Technical field writes against disposable db:local, never production. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,unlinkSync} from 'node:fs';
import postgres from 'postgres';
async function main() {
  process.env.DATABASE_URL='postgres://postgres:renkflow-local-only@127.0.0.1:55432/renkflow_test';
  process.env.ALLOW_LOCAL_DATABASE='1';process.env.AUTH_SECRET='field-integration-local-only-12345678901234567890';delete process.env.PRIVATE_ACCESS_EMAIL;
  const file='/tmp/mobile-features-'+randomUUID()+'.json';
  execFileSync('npm',['run','test:field','--','--fixture='+file],{stdio:'pipe'});
  const f=JSON.parse(readFileSync(file,'utf8'));unlinkSync(file);
  const db=postgres(process.env.DATABASE_URL,{onnotice:()=>{}});
  const {POST,GET}=await import('../app/api/mobile/v1/[...path]/route');const {NextRequest}=await import('next/server');let token='';
  async function call(path:string,body?:unknown,status=200) {
    const headers={'content-type':'application/json','x-renkflow-app-version':'1.1.0','x-renkflow-platform':'android',authorization:'Bearer '+token};
    const response=await (body===undefined?GET:POST)(new NextRequest('https://renkflow.com/api/mobile/v1/'+path,{method:body===undefined?'GET':'POST',headers,...(body===undefined?{}:{body:JSON.stringify(body)})}),{params:Promise.resolve({path:path.split('/')})});
    const result=await response.json();assert.equal(response.status,status,result.error);return result;
  }
  const login=await call('auth/login',{email:f.email,password:f.password});token=login.data.accessToken;const tenant=login.data.user.tenantId;
  const [available]=await db`SELECT to_regclass('production_reason_codes') IS NOT NULL AS codes`;
  if(available.codes) {
    await db`INSERT INTO production_reason_codes(tenant_id,kind,code,label) VALUES(${tenant},'scrap','mobile_cut','Kesim hatası'),(${tenant},'delay','mobile_material','Malzeme bekleniyor') ON CONFLICT DO NOTHING`;
    const scrap={idempotencyKey:randomUUID(),kind:'scrap',workOrderId:f.productionJobId,data:{reasonCode:'mobile_cut',quantity:2,operationId:f.operationId,photos:[]}};
    await Promise.all([call('sync',scrap),call('sync',scrap)]);
    assert.equal(Number((await db`SELECT count(*) AS n FROM production_scrap_events WHERE tenant_id=${tenant} AND work_order_id=${f.productionJobId}`)[0].n),1);
    await db`UPDATE production_reason_codes SET active=false WHERE tenant_id=${tenant} AND kind='scrap' AND code='mobile_cut'`;
    await call('sync',{...scrap,idempotencyKey:randomUUID()},400);
    const delay={idempotencyKey:randomUUID(),kind:'delay',workOrderId:f.productionJobId,data:{reasonCode:'mobile_material',note:'Awaiting profiles'}};
    await call('sync',delay);await call('sync',delay);const conflict=await call('sync',{...delay,idempotencyKey:randomUUID()},409);assert.equal(conflict.canRetry,false);
    assert.equal(Number((await db`SELECT count(*) AS n FROM production_delays WHERE tenant_id=${tenant} AND work_order_id=${f.productionJobId}`)[0].n),1);
    console.log('PASS · scrap exactly once; inactive reason refused; one open delay; acknowledgement replay');
  } else {
    await call('sync',{idempotencyKey:randomUUID(),kind:'scrap',workOrderId:f.productionJobId,data:{reasonCode:'mobile_cut',quantity:1}},503);
    console.log('PASS · absent depth module fails closed');
  }
  const [chain]=await db`SELECT to_regclass('public.installations') IS NOT NULL AS present`;
  if(chain.present) {
    const [job]=await db`SELECT order_id FROM work_orders WHERE id=${f.productionJobId}`;
    const [i]=await db`INSERT INTO installations(tenant_id,installation_number,order_id,crew,address,signed_name) VALUES(${tenant},${'MNT-'+randomUUID()},${job.order_id},ARRAY[${login.data.user.id}::uuid],'PRIVATE address','PRIVATE signoff') RETURNING id`;
    const [check]=await db`INSERT INTO record_checklist_items(tenant_id,entity_type,entity_id,title) VALUES(${tenant},'installation',${i.id},'Anchoring inspected') RETURNING id`;
    const details=(await call('installations/'+i.id)).data;assert(!JSON.stringify(details).includes('PRIVATE'));assert.equal(details.checklist.length,1);
    const command=(data:unknown)=>({idempotencyKey:randomUUID(),kind:'installation',installationId:i.id,data});
    const start=command({action:'start',expectedVersion:1});await Promise.all([call('sync',start),call('sync',start)]);
    assert.equal((await call('installations/'+i.id)).data.version,2);
    const stale=await call('sync',command({action:'issue',expectedVersion:1,kind:'damage',text:'Surface scratch'}),409);assert.equal(stale.canRetry,false);
    await call('sync',command({action:'checklist',expectedVersion:2,itemId:check.id,completed:true}));
    const issue=command({action:'issue',expectedVersion:3,kind:'missing',text:'Cover missing'});await call('sync',issue);await call('sync',issue);
    const current=(await call('installations/'+i.id)).data;assert.equal(current.issues.length,1);assert.equal(current.checklist[0].completed,true);assert.equal(current.version,4);
    await db`UPDATE installations SET crew='{}' WHERE id=${i.id}`;await call('installations/'+i.id,undefined,404);await call('sync',command({action:'complete',expectedVersion:4}),404);
    console.log('PASS · installation crew scope, strict DTO, version conflict, durable checklist and one issue');
  }
  const op=(data:unknown)=>({idempotencyKey:randomUUID(),kind:'operation',data});
  await call('sync',op({operationId:f.operationId,version:1,action:'start'}));
  await call('sync',op({operationId:f.operationId,version:2,action:'complete',quantity:2,qualityResults:[{checkId:'visual',passed:true}],photos:[]}));
  const rework=op({operationId:f.operationId,version:3,action:'rework',quantity:1,reason:'Measurement correction',reasonCode:'measurement',targetOperationId:f.operationId});
  await call('sync',rework);await call('sync',rework);
  const [result]=await db`SELECT completed_qty,status FROM production_operations WHERE id=${f.operationId}`;
  assert.equal(Number(result.completed_qty),1);assert.equal(result.status,'ready');
  assert.equal(Number((await db`SELECT count(*) AS n FROM production_rework WHERE tenant_id=${tenant} AND work_order_id=${f.productionJobId}`)[0].n),1);
  console.log('PASS · rework uses web domain checks and applies quantity once');
  await db`UPDATE work_orders SET status='cancelled' WHERE id=${f.productionJobId}`;
  const forbidden=await call('sync',{idempotencyKey:randomUUID(),kind:'scrap',workOrderId:f.productionJobId,data:{reasonCode:'mobile_cut',quantity:1}},409);assert.equal(forbidden.canRetry,false);
  console.log('PASS · cancelled work cannot force a field record');await db.end();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
