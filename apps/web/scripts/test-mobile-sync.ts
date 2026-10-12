import { localTestDatabaseUrl } from './local-test-database';
import mobileSpec from '../../../contracts/mobile/openapi.json';
/** Real transactions in db:local. No mocked services and no remote endpoints. */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, unlinkSync } from 'node:fs';
import postgres from 'postgres';
async function main() {
  process.env.AUTH_SECRET='field-integration-local-only-12345678901234567890';
  process.env.DATABASE_URL=localTestDatabaseUrl();
  process.env.STORAGE_BACKEND='local'; delete process.env.PRIVATE_ACCESS_EMAIL;
  const file='/tmp/mobile-sync-'+randomUUID()+'.json';
  execFileSync('npm',['run','test:field','--','--fixture='+file],{stdio:'pipe'});
  const fixture=JSON.parse(readFileSync(file,'utf8'));unlinkSync(file);
  const db=postgres(process.env.DATABASE_URL,{onnotice:()=>{}});
  const {NextRequest}=await import('next/server'); const {GET,POST}=await import('../app/api/mobile/v1/[...path]/route');
  let token='';
  async function call(path:string,body?:unknown,expected=200) {
    const headers={'content-type':'application/json','x-renkflow-app-version':mobileSpec.info.version,'x-renkflow-platform':'ios',authorization:'Bearer '+token};
    const req=new NextRequest('https://renkflow.com/api/mobile/v1/'+path,{method:body===undefined?'GET':'POST',headers,...(body===undefined?{}:{body:JSON.stringify(body)})});
    const base=process.argv.find(s=>s.startsWith('--server='))?.slice(9);
    if(base) {const origin=new URL(base);assert(['127.0.0.1','localhost'].includes(origin.hostname)&&origin.port);}
    const response=base?await fetch(base+'/api/mobile/v1/'+path,{method:req.method,headers,...(body===undefined?{}:{body:JSON.stringify(body)})}):await(body===undefined?GET:POST)(req,{params:Promise.resolve({path:path.split('/')})});
    const result=await response.json();assert.equal(response.status,expected,result.error);return result;
  }
  const login=await call('auth/login',{email:fixture.email,password:fixture.password});token=login.data.accessToken;
  const user=login.data.user;
  const note={idempotencyKey:randomUUID(),kind:'comment',workOrderId:fixture.jobId,data:{body:'Disconnected durable note'}};
  await Promise.all(Array.from({length:8},()=>call('sync',note)));
  assert.equal(Number((await db`SELECT count(*) AS n FROM work_order_comments WHERE work_order_id=${fixture.jobId} AND body='Disconnected durable note'`)[0].n),1);
  const mismatch=await call('sync',{...note,data:{body:'Changed replay'}},409);assert.equal(mismatch.canRetry,false);
  const detail=(await call('work-orders/'+fixture.jobId)).data;
  const check={idempotencyKey:randomUUID(),kind:'checklist',workOrderId:fixture.jobId,data:{itemId:detail.checklist[0].id,completed:false,expectedCompleted:true}};
  await call('sync',check);await call('sync',check);
  assert.equal((await call('work-orders/'+fixture.jobId)).data.checklist[0].completed,false);
  const conflict=await call('sync',{...check,idempotencyKey:randomUUID()},409);assert.equal(conflict.canRetry,true);
  const transition={idempotencyKey:randomUUID(),kind:'transition',workOrderId:fixture.jobId,data:{status:'blocked',expectedUpdatedAt:detail.updatedAt,blockedReasonCategory:'material',blockedReasonDetail:'Waiting for profile'}};
  await call('sync',transition);await call('sync',transition);
  await call('sync',{...transition,idempotencyKey:randomUUID()},409);
  console.log('PASS · concurrent note exactly once, payload collision refusal, checklist replay and explicit revision conflicts');
  const start={idempotencyKey:randomUUID(),kind:'operation',data:{operationId:fixture.operationId,version:1,action:'start',qualityResults:[],photos:[]}};
  await Promise.all([call('sync',start),call('sync',start)]);
  // Simulate loss after production commit but before the mobile acknowledgement was durably stored.
  await db`UPDATE mobile_receipts SET response=NULL WHERE tenant_id=${user.tenantId} AND user_id=${user.id} AND command_id=${start.idempotencyKey}`;
  await call('sync',start);
  assert.equal((await db`SELECT version FROM production_operations WHERE id=${fixture.operationId}`)[0].version,2);
  const complete={idempotencyKey:randomUUID(),kind:'operation',data:{operationId:fixture.operationId,version:2,action:'complete',quantity:2,qualityResults:[{checkId:'visual',passed:true}],photos:[]}};
  await call('sync',complete);await call('sync',complete);
  assert.equal(Number((await db`SELECT completed_qty FROM production_operations WHERE id=${fixture.operationId}`)[0].completed_qty),2);
  console.log('PASS · production reconnect/double-send/lost-ack recovery applies one quantity');
  const bytes=Buffer.from(fixture.jpeg,'base64'),uploadId=randomUUID();
  const hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
  const init={action:'init',uploadId,workOrderId:fixture.productionJobId,name:'resumable.jpg',totalBytes:bytes.length,sha256:hash(bytes)};
  assert.equal((await call('uploads',init)).data.receivedBytes,0);
  const part=bytes.subarray(0,Math.floor(bytes.length/2));
  const chunk={action:'chunk',uploadId,offset:0,base64:part.toString('base64'),sha256:hash(part)};
  await call('uploads',chunk);await call('uploads',chunk);
  assert.equal((await call('uploads/'+uploadId)).data.receivedBytes,part.length);
  await call('uploads',{action:'finish',uploadId},409);
  const rest=bytes.subarray(part.length);
  await call('uploads',{action:'chunk',uploadId,offset:part.length,base64:rest.toString('base64'),sha256:'0'.repeat(64)},400);
  await call('uploads',{action:'chunk',uploadId,offset:part.length,base64:rest.toString('base64'),sha256:hash(rest)});
  const [one,two]=await Promise.all([call('uploads',{action:'finish',uploadId}),call('uploads',{action:'finish',uploadId})]);
  assert.equal(one.data.url,two.data.url);assert.equal(one.data.completed,true);
  assert.equal(Number((await db`SELECT count(*) AS n FROM production_files WHERE tenant_id=${user.tenantId} AND file_path=${'uploads/'+user.tenantId+'/'+user.id+'/mobile-'+uploadId}`)[0].n),1);
  console.log('PASS · interrupted photo resumes at acknowledged offset; corrupted chunk refused; concurrent finalize creates one file');
  await db`UPDATE work_orders SET assigned_to=NULL WHERE id=${fixture.jobId}`;
  await call('sync',{...note,idempotencyKey:randomUUID()},404);
  await db`UPDATE work_orders SET assigned_to=${user.id},status='cancelled' WHERE id=${fixture.jobId}`;
  const closed=await call('sync',{...note,idempotencyKey:randomUUID()},409);assert.equal(closed.canRetry,false);
  await db`DELETE FROM tenant_members WHERE tenant_id=${user.tenantId} AND user_id=${user.id}`;
  await call('sync',note,401);
  console.log('PASS · reassignment, closed work and revoked membership cannot force a queued write');
  await db.end();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
