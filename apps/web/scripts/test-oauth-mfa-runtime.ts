/** Actual Next.js route/cookie integration. Only Google's HTTP transport is simulated. */
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { localTestDatabaseURL } from './local-test-database';

async function main() {
  process.env.DATABASE_URL = localTestDatabaseURL();
  process.env.AUTH_SECRET = 'oauth-runtime-local-secret-12345678901234567890';
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
  const [tenant] = await db`INSERT INTO tenants(name,slug) VALUES('OAuth MFA runtime',${'oauth-runtime-' + randomUUID()}) RETURNING id`;
  const email = randomUUID()+'@example.invalid';
  const [user] = await db`INSERT INTO users(name,email,email_verified) VALUES('OAuth MFA test',${email},now()) RETURNING id`;
  await db`INSERT INTO tenant_members(user_id,tenant_id,role) VALUES(${user.id},${tenant.id},'owner')`;
  const { sql } = await import('../lib/db');
  const mfa = await import('../lib/features/auth/mfa.server');
  const { base32Decode, totpAt } = await import('../lib/features/auth/totp');
  const setup = await mfa.startMfaSetup(sql, { userId: user.id, email });
  const recovery = await mfa.confirmMfaSetup(sql, { userId: user.id, tenantId: tenant.id, code: totpAt(base32Decode(setup.secret),Math.floor(Date.now()/30000)) });
  const directory = mkdtempSync(path.join(tmpdir(),'renkflow-oauth-mfa-'));
  const preloader = path.join(directory,'google.cjs');
  // A signed local ID token exercises Auth.js/openid-client verification, not a fake signIn callback.
  writeFileSync(preloader, `
const {generateKeyPairSync,sign}=require('node:crypto');
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'local-key',alg:'RS256',use:'sig'};
const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
const original=global.fetch;
global.fetch=async(input,options)=>{
 const url=String(input);
 if(url.startsWith('http://localhost:')||url.startsWith('http://127.0.0.1:'))return original(input,options);
 if(url.includes('/.well-known/openid-configuration'))return Response.json({issuer:'https://accounts.google.com',authorization_endpoint:'https://accounts.google.com/o/oauth2/v2/auth',token_endpoint:'https://oauth2.googleapis.com/token',userinfo_endpoint:'https://openidconnect.googleapis.com/v1/userinfo',jwks_uri:'https://www.googleapis.com/oauth2/v3/certs',response_types_supported:['code'],subject_types_supported:['public'],id_token_signing_alg_values_supported:['RS256'],code_challenge_methods_supported:['S256']});
 if(url==='https://www.googleapis.com/oauth2/v3/certs')return Response.json({keys:[jwk]});
 if(url==='https://oauth2.googleapis.com/token'){
   const now=Math.floor(Date.now()/1000),data=enc({alg:'RS256',kid:'local-key',typ:'JWT'})+'.'+enc({iss:'https://accounts.google.com',aud:'local-client',sub:'local-google-subject',email:${JSON.stringify(email)},email_verified:true,name:'OAuth MFA test',iat:now,exp:now+300});
   return Response.json({access_token:'local-access',token_type:'Bearer',expires_in:300,id_token:data+'.'+sign('RSA-SHA256',Buffer.from(data),privateKey).toString('base64url')});
 }
 if(url==='https://openidconnect.googleapis.com/v1/userinfo')return Response.json({sub:'local-google-subject',email:${JSON.stringify(email)},email_verified:true,name:'OAuth MFA test'});
 throw new Error('Unexpected outbound request in local OAuth fixture: '+url);
};
`, { mode: 0o600 });
  const port = await new Promise<number>(resolve => { const server=createServer();server.listen(0,'127.0.0.1',()=>{const address=server.address();server.close(()=>resolve((address as any).port));}); });
  const origin = `http://localhost:${port}`;
  let server: ChildProcess | undefined, output = '';
  const jar = new Map<string,string>();
  async function request(route: string, init: RequestInit = {}) {
    const response = await fetch(origin+route, { ...init, redirect:'manual', headers: { ...Object.fromEntries(new Headers(init.headers)), Cookie: Array.from(jar,([key,value])=>`${key}=${value}`).join('; '), Origin:origin } });
    for(const header of response.headers.getSetCookie()) { const pair=header.split(';')[0],equal=pair.indexOf('=');if(equal<0)continue;const key=pair.slice(0,equal),value=pair.slice(equal+1);if(/max-age=0/i.test(header))jar.delete(key);else jar.set(key,value); }
    return response;
  }
  const hasSession = () => Array.from(jar.keys()).some(key=>key.includes('authjs.session-token'));
  try {
    server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{env:{...process.env,DATABASE_URL:process.env.DATABASE_URL,DATABASE_URL_UNPOOLED:process.env.DATABASE_URL,AUTH_SECRET:process.env.AUTH_SECRET,NEXTAUTH_SECRET:process.env.AUTH_SECRET,AUTH_URL:origin,NEXTAUTH_URL:origin,AUTH_TRUST_HOST:'true',ALLOW_LOCAL_DATABASE:'1',ALLOW_INSECURE_HTTP:'1',PRIVATE_ACCESS_EMAIL:'',GOOGLE_CLIENT_ID:'local-client',GOOGLE_CLIENT_SECRET:'local-secret',NODE_OPTIONS:`--require=${preloader}`},stdio:['ignore','pipe','pipe']});
    server.stdout?.on('data',b=>output+=String(b));server.stderr?.on('data',b=>output+=String(b));
    let ready=false;
    for(let attempt=0;attempt<80;attempt++){try{if((await fetch(origin+'/api/health')).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,250));}
    assert(ready,'local Next.js runtime did not start');
    const csrf=(await(await request('/api/auth/csrf')).json()).csrfToken;
    const initial=await request('/api/auth/signin/google',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','X-Auth-Return-Redirect':'1'},body:new URLSearchParams({csrfToken:csrf,callbackUrl:origin+'/dashboard'}).toString()});
    const authorization=new URL((await initial.json()).url);
    const state=authorization.searchParams.get('state');assert(state);assert(!hasSession());
    const callback=await request('/api/auth/callback/google?'+new URLSearchParams({state,code:'local-code'}));
    const location=callback.headers.get('location');
    assert(location && new URL(location).pathname==='/auth/sso-verify','verified OAuth identity must first enter MFA');
    assert(!hasSession(),'Google must not create a member session before the account OTP');
    const fragment=new URLSearchParams(new URL(location).hash.slice(1));
    assert.equal(new URL(location).search,'');
    assert(jar.has('rf-sso-browser-local'),'the real Next.js response must include the HttpOnly MFA browser proof');
    const finish=async(otp?:string)=>{
      const response=await request('/api/auth/callback/credentials',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','X-Auth-Return-Redirect':'1'},body:new URLSearchParams({email,ticket:fragment.get('ticket')!,csrfToken:csrf,callbackUrl:origin+'/dashboard',...(otp?{otp}:{})}).toString()});
      return new URL((await response.json()).url);
    };
    assert.equal((await finish()).searchParams.get('code'),'otp_required');assert(!hasSession());
    assert.equal((await finish(recovery[0])).pathname,'/dashboard');assert(hasSession());
    const session=await(await request('/api/auth/session')).json();assert.equal(session.user.tenantId,tenant.id);
    const before=Number((await db`SELECT count(*) AS n FROM user_sessions WHERE user_id=${user.id}`)[0].n);
    assert.equal((await finish(recovery[1])).searchParams.get('code'),'invalid_credentials');
    assert.equal(Number((await db`SELECT count(*) AS n FROM user_sessions WHERE user_id=${user.id}`)[0].n),before,'ticket replay must not create another session');
    console.log('PASS real Next.js Google OAuth -> browser proof -> OTP challenge -> exactly one member session; replay refused');
  } catch(error) { console.error(output.slice(-3500));throw error; }
  finally { server?.kill('SIGTERM');if(server)await new Promise(resolve=>server!.once('exit',resolve));rmSync(directory,{recursive:true,force:true});await db`DELETE FROM tenants WHERE id=${tenant.id}`;await db`DELETE FROM users WHERE id=${user.id}`;await db.end({timeout:5}); }
}
main().then(()=>process.exit(0)).catch(error=>{console.error(error);process.exit(1);});
