/** Security integration against disposable loopback PostgreSQL only. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,unlinkSync} from 'node:fs';
import postgres from 'postgres';
async function main() {
 process.env.DATABASE_URL='postgres://postgres:renkflow-local-only@127.0.0.1:55432/renkflow_test';process.env.ALLOW_LOCAL_DATABASE='1';process.env.AUTH_SECRET='field-integration-local-only-12345678901234567890';delete process.env.PRIVATE_ACCESS_EMAIL;
 const file='/tmp/mobile-session-'+randomUUID()+'.json';execFileSync('npm',['run','test:field','--','--fixture='+file],{stdio:'pipe'});const f=JSON.parse(readFileSync(file,'utf8'));unlinkSync(file);
 const db=postgres(process.env.DATABASE_URL,{onnotice:()=>{}}),base=process.argv.find(x=>x.startsWith('--server='))?.slice(9);if(base) {const url=new URL(base);assert(['127.0.0.1','localhost'].includes(url.hostname)&&url.port);}
 const {GET,POST}=await import('../app/api/mobile/v1/[...path]/route');const {NextRequest}=await import('next/server');let token='';
 async function call(path:string,body?:unknown,status=200) {const options={method:body===undefined?'GET':'POST',headers:{'content-type':'application/json','x-renkflow-app-version':'1.1.0','x-renkflow-platform':'android',authorization:'Bearer '+token},...(body===undefined?{}:{body:JSON.stringify(body)})};const r=base?await fetch(base+'/api/mobile/v1/'+path,options):await (body===undefined?GET:POST)(new NextRequest('https://renkflow.com/api/mobile/v1/'+path,options),{params:Promise.resolve({path:path.split('/')})});const value=await r.json();assert.equal(r.status,status,value.error);return value.data;}
 const deviceId=randomUUID(),login=()=>call('auth/login',{email:f.email,password:f.password,deviceId});let auth=await login();token=auth.accessToken;assert.equal(auth.expiresIn,900);await call('auth/me');
 const refresh={refreshToken:auth.refreshToken,deviceId,requestId:randomUUID()},rotated=await call('auth/refresh',refresh),replay=await call('auth/refresh',refresh);assert.deepEqual(rotated,replay);assert.notEqual(rotated.refreshToken,auth.refreshToken);
 const [stored]=await db`SELECT token_hash,replay_cipher FROM mobile_refresh_tokens WHERE session_id=${auth.sessionId} AND consumed_at IS NOT NULL`;assert(!JSON.stringify(stored).includes(auth.refreshToken)&&!JSON.stringify(stored).includes(rotated.refreshToken));
 console.log('PASS · short access; rotating refresh; encrypted same-request lost-ack replay; hashes only');
 await call('auth/refresh',{...refresh,requestId:randomUUID()},401);token=rotated.accessToken;await call('auth/me',undefined,401);await call('auth/refresh',{...refresh,refreshToken:rotated.refreshToken,requestId:randomUUID()},401);
 console.log('PASS · consumed token reuse revokes entire device, including already-issued access token');
 auth=await login();token=auth.accessToken;let listed=await call('auth/devices');assert(listed.devices.some((x:any)=>x.id===auth.sessionId&&!x.revoked));assert(!JSON.stringify(listed).includes(auth.refreshToken));
 await db`UPDATE user_sessions SET revoked_at=now() WHERE id=${auth.sessionId}`;await call('auth/me',undefined,401);await call('auth/refresh',{refreshToken:auth.refreshToken,deviceId,requestId:randomUUID()},401);
 console.log('PASS · existing web user_sessions revocation immediately blocks mobile access/refresh');
 auth=await login();token=auth.accessToken;await call('auth/devices/revoke',{id:auth.sessionId});await call('auth/me',undefined,401);
 auth=await login();token=auth.accessToken;await db`DELETE FROM tenant_members WHERE user_id=${auth.user.id} AND tenant_id=${auth.user.tenantId}`;await call('auth/me',undefined,401);await call('auth/refresh',{refreshToken:auth.refreshToken,deviceId,requestId:randomUUID()},401);
 console.log('PASS · device revoke and membership removal; tokens/identity not exposed in device list');
 token=f.token ?? 'invalid';await call('auth/me',undefined,401);await db.end();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
