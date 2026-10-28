import { assertCompanyHostTenant, companyForHost } from '@/lib/features/company/host.server';
import 'server-only';
import {createHash,randomBytes,randomUUID,createCipheriv,createDecipheriv} from 'node:crypto';
import jwt from 'jsonwebtoken';
import {NextRequest} from 'next/server';
import {sql} from '@/lib/db';
import {resolveAuthSecret} from '@/lib/shared/config/runtime-env';
import {getClientIp} from '@/lib/security/rate-limit';
import {consumeLoginAttempt,clearLoginAttempts,verifyPassword} from '@/lib/features/auth/login-guard';
import {isPrivateAccessAllowed} from '@/lib/features/auth/private-access';
import {WorkOrderApiError} from '@/lib/features/work-orders/security';
import {currentMobileAccess} from './access';
import {validateMobileDTO} from './contract';
import {recordAudit,recordAuditAfterCommit} from '@/lib/audit/audit-log';
import {isMfaEnabled} from '@/lib/features/auth/mfa.server';
import {MFA_SETUP_REQUIRED_CODE,MFA_SETUP_REQUIRED_LOGIN_MESSAGE} from '@/lib/features/auth/mfa-policy';
import {mfaSetupPending} from '@/lib/security/member-access.server';
const ACCESS_SECONDS=900;
const secret=()=>resolveAuthSecret({context:'mobile.sessions',allowMissing:false,allowDevelopmentFallback:process.env.NODE_ENV!=='production',developmentFallback:'development-only-fallback-secret'})!;
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
function access(user:any,sid:string) {return jwt.sign({sub:user.id,tenantId:user.tenantId,role:user.role,email:user.email,name:user.name,sid,type:'mobile'},secret(),{algorithm:'HS256',audience:'renkflow-mobile',expiresIn:ACCESS_SECONDS});}
function encrypt(value:unknown) {
 const key=createHash('sha256').update('mobile-refresh-replay:'+secret()).digest(),iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv);
 const bytes=Buffer.concat([c.update(JSON.stringify(value),'utf8'),c.final()]);return Buffer.concat([iv,c.getAuthTag(),bytes]).toString('base64');
}
function decrypt(cipher:string) {const bytes=Buffer.from(cipher,'base64'),d=createDecipheriv('aes-256-gcm',createHash('sha256').update('mobile-refresh-replay:'+secret()).digest(),bytes.subarray(0,12));d.setAuthTag(bytes.subarray(12,28));return JSON.parse(Buffer.concat([d.update(bytes.subarray(28)),d.final()]).toString('utf8'));}
async function schema() {const [r]=await sql`SELECT to_regclass('public.mobile_sessions') IS NOT NULL AS present`;if(!r?.present) throw new WorkOrderApiError('Mobil oturum altyapısı henüz etkin değil.',503);}
/** Fresh DB checks: session revocation, member deactivation and global cutoff are never cached. */
export async function requireMobileSession(request:NextRequest) {
 const token=request.headers.get('authorization')?.replace(/^Bearer /,'');if(!token) throw new WorkOrderApiError('Oturum açın.',401);
 let p:jwt.JwtPayload;try {p=jwt.verify(token,secret(),{algorithms:['HS256'],audience:'renkflow-mobile'}) as jwt.JwtPayload;} catch {throw new WorkOrderApiError('Oturumunuz sona erdi.',401);}
 if(p.type!=='mobile'||typeof p.sid!=='string'||!p.sub||!p.tenantId) throw new WorkOrderApiError('Mobil oturum geçersiz.',401);
 await assertCompanyHostTenant(String(p.tenantId),(request.headers.get('host') || new URL(request.url).host));
 await schema();const [r]=await sql`SELECT s.id FROM mobile_sessions s JOIN user_sessions u ON u.id=s.id WHERE s.id=${p.sid} AND s.user_id=${p.sub} AND s.tenant_id=${p.tenantId} AND u.revoked_at IS NULL AND s.expires_at>now()`;
 if(!r) throw new WorkOrderApiError('Bu cihazın oturumu iptal edildi.',401);
 return p;
}
export async function mobileLogin(request:NextRequest,raw:unknown,platform:string) {
 const company=await companyForHost((request.headers.get('host') || new URL(request.url).host));
 const input=validateMobileDTO('LoginInput',raw) as {email:string;password:string;deviceId?:string};
 const email=input.email.trim().toLowerCase(),attempt=await consumeLoginAttempt(getClientIp(request.headers),email);
 if(!attempt.allowed) throw new WorkOrderApiError('Çok fazla giriş denemesi. Biraz bekleyin.',429);
 const [r]=await sql`SELECT u.id,u.email,u.name,u.password,u.email_verified,m.tenant_id,m.role FROM users u LEFT JOIN LATERAL(SELECT * FROM tenant_members WHERE user_id=u.id AND (${company?.id ?? null}::uuid IS NULL OR tenant_id=${company?.id ?? null}::uuid) AND (to_jsonb(tenant_members)->>'deactivated_at') IS NULL ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,created_at LIMIT 1) m ON true WHERE u.email=${email}`;
 const valid=await verifyPassword(input.password,r?.password);
 // Failed attempts on a member account are recorded without awaiting (same timing as unknown accounts).
 if(!r||!valid||!isPrivateAccessAllowed(email)) {if(r?.tenant_id) void recordAuditAfterCommit({tenantId:r.tenant_id,actorId:r.id,entityType:'user',entityId:r.id,action:'login_failed',metadata:{method:'mobile',platform}});throw new WorkOrderApiError('E-posta veya şifre hatalı.',401);}
 if(!r.email_verified) throw new WorkOrderApiError('Önce e-posta adresinizi doğrulayın.',401);
 if(!r.tenant_id||!['owner','admin','office','worker'].includes(r.role)) throw new WorkOrderApiError('Bu hesap saha uygulamasına erişemiyor.',403);
 // The field app cannot ask for a second-step code yet; letting such accounts in would bypass it.
 if(await isMfaEnabled(sql,r.id)) throw new WorkOrderApiError('İki adımlı doğrulama açık hesaplar saha uygulamasına henüz giriş yapamaz. Web üzerinden giriş yapın.',403);
 // The firm requires two-step sign-in of owners and admins: no phone session until it is set up.
 if(await mfaSetupPending(r.id,r.tenant_id,r.role)) throw new WorkOrderApiError(MFA_SETUP_REQUIRED_LOGIN_MESSAGE,403,MFA_SETUP_REQUIRED_CODE);
 const user={id:r.id,email:r.email,name:r.name||'Kullanıcı',role:r.role,tenantId:r.tenant_id},sid=randomUUID(),token=access(user,sid);
 const permissions=await currentMobileAccess({userId:r.id,tenantId:r.tenant_id,role:r.role},jwt.sign({sub:r.id,iat:Math.floor(Date.now()/1000)},secret()));
 if(!permissions.production.view&&!permissions.inventory.view&&!permissions.installations.view) throw new WorkOrderApiError('Saha yetkiniz yok.',403);
 await schema();const refreshToken=randomBytes(48).toString('base64url'),deviceId=(input.deviceId??randomUUID()).toLowerCase();
 await sql.begin(async(tx:any)=>{
  // Signing in again on this installation closes its old sessions; its scoped outbox remains local.
  await tx`UPDATE user_sessions SET revoked_at=now() WHERE id IN(SELECT id FROM mobile_sessions WHERE tenant_id=${user.tenantId} AND user_id=${user.id} AND device_id=${deviceId}) AND revoked_at IS NULL`;
  await tx`INSERT INTO user_sessions(id,user_id,tenant_id,user_agent) VALUES(${sid},${user.id},${user.tenantId},${'RenkFlow '+platform})`;
  await tx`INSERT INTO mobile_sessions(id,tenant_id,user_id,device_id,platform,expires_at) VALUES(${sid},${user.tenantId},${user.id},${deviceId},${platform},now()+interval '30 days')`;
  await tx`INSERT INTO mobile_refresh_tokens(token_hash,session_id) VALUES(${hash(refreshToken)},${sid})`;
  await recordAudit(tx,{tenantId:user.tenantId,actorId:user.id,entityType:'user',entityId:user.id,action:'login_succeeded',metadata:{method:'mobile',platform,deviceId}});
 });await clearLoginAttempts(email);
 return {user,accessToken:token,expiresIn:ACCESS_SECONDS,refreshToken,sessionId:sid,deviceId};
}
export async function mobileRefresh(raw:unknown) {
 const parsed=validateMobileDTO('RefreshInput',raw) as {refreshToken:string;requestId:string;deviceId:string};
 const input={...parsed,deviceId:parsed.deviceId.toLowerCase(),requestId:parsed.requestId.toLowerCase()};await schema();
 // Return an invalid marker and commit revocation BEFORE throwing (a thrown transaction rolls it back).
 const result=await sql.begin(async(tx:any)=>{
  const [r]=await tx`SELECT t.*,s.device_id,s.user_id,s.tenant_id,s.expires_at,s.created_at AS signed_at,u.revoked_at FROM mobile_refresh_tokens t JOIN mobile_sessions s ON s.id=t.session_id JOIN user_sessions u ON u.id=s.id WHERE t.token_hash=${hash(input.refreshToken)} FOR UPDATE OF t,u`;
  if(!r||r.device_id!==input.deviceId||r.revoked_at||new Date(r.expires_at)<=new Date()) return null;
  const [identity]=await tx`SELECT u.id,u.email,u.name,m.role,to_jsonb(m)->>'deactivated_at' AS deactivated,to_jsonb(u)->>'sessions_valid_after' AS cutoff FROM users u JOIN tenant_members m ON m.user_id=u.id WHERE u.id=${r.user_id} AND m.tenant_id=${r.tenant_id}`;
  if(!identity||identity.deactivated||identity.cutoff&&new Date(identity.cutoff)>new Date(r.signed_at)||!isPrivateAccessAllowed(identity.email)) {await tx`UPDATE user_sessions SET revoked_at=now() WHERE id=${r.session_id}`;return null;}
  // A firm that now requires two-step sign-in of owners/admins: no new tokens until it is set up (the token is not consumed).
  if(await mfaSetupPending(identity.id,r.tenant_id,identity.role)) return {mfaSetupRequired:true} as const;
  if(r.consumed_at) {
   if(r.request_id===input.requestId&&r.replay_cipher&&new Date(r.replay_until)>new Date()) return decrypt(r.replay_cipher);
   await tx`UPDATE user_sessions SET revoked_at=now() WHERE id=${r.session_id}`;return null;
  }
  const user={id:identity.id,email:identity.email,name:identity.name||'Kullanıcı',role:identity.role,tenantId:r.tenant_id},next=randomBytes(48).toString('base64url');
  const value={user,accessToken:access(user,r.session_id),expiresIn:ACCESS_SECONDS,refreshToken:next,sessionId:r.session_id,deviceId:r.device_id};
  await tx`INSERT INTO mobile_refresh_tokens(token_hash,session_id) VALUES(${hash(next)},${r.session_id})`;
  await tx`UPDATE mobile_refresh_tokens SET consumed_at=now(),request_id=${input.requestId},replay_cipher=${encrypt(value)},replay_until=now()+interval '5 minutes' WHERE token_hash=${hash(input.refreshToken)}`;
  await tx`UPDATE user_sessions SET last_seen_at=now() WHERE id=${r.session_id}`;return value;
 });if(!result) throw new WorkOrderApiError('Cihaz oturumu sona erdi. Yeniden giriş yapın.',401);
 if('mfaSetupRequired' in result) throw new WorkOrderApiError(MFA_SETUP_REQUIRED_LOGIN_MESSAGE,403,MFA_SETUP_REQUIRED_CODE);
 return result;
}
export async function mobileDevices(userId:string,tenantId:string) {await schema();const rows=await sql`SELECT s.id,s.device_id,s.platform,s.created_at,u.last_seen_at,u.revoked_at FROM mobile_sessions s JOIN user_sessions u ON u.id=s.id WHERE s.user_id=${userId} AND s.tenant_id=${tenantId} ORDER BY s.created_at DESC LIMIT 100`;return {devices:rows.map((r:any)=>({id:r.id,deviceId:r.device_id,platform:r.platform,createdAt:new Date(r.created_at).toISOString(),lastSeenAt:new Date(r.last_seen_at).toISOString(),revoked:!!r.revoked_at}))};}
export async function revokeMobileDevice(userId:string,tenantId:string,id:string) {await schema();await sql.begin(async(tx:any)=>{await tx`UPDATE user_sessions SET revoked_at=now(),revoked_by=${userId} WHERE user_id=${userId} AND tenant_id=${tenantId} AND id=${id} AND id IN(SELECT id FROM mobile_sessions WHERE tenant_id=${tenantId} AND user_id=${userId})`;await tx`UPDATE mobile_push_devices SET enabled=false,provider_token=NULL WHERE tenant_id=${tenantId} AND user_id=${userId} AND device_id IN(SELECT device_id FROM mobile_sessions WHERE id=${id} AND user_id=${userId} AND tenant_id=${tenantId})`;});return {accepted:true};}
