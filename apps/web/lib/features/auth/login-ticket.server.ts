import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { parseCompanyHost } from '@/lib/features/company/host';

type Db = any;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const SECRET = /^[a-f0-9]{64}$/;
export const loginTicketCookieName = (secure: boolean) => secure ? '__Host-rf-sso-browser' : 'rf-sso-browser-local';
export const ssoFlowCookieName = (secure: boolean) => secure ? '__Host-rf-sso-flow' : 'rf-sso-flow-local';
export function matchesSsoFlow(state: string, cookie: string | undefined) {
  return /^state_[a-f0-9]{32}$/.test(state) && cookie === state;
}

function requestHost(request: Request) {
  const host = (request.headers.get('host') || new URL(request.url).host).toLowerCase();
  if (parseCompanyHost(host, process.env.NODE_ENV !== 'production' || process.env.ALLOW_INSECURE_HTTP === '1').kind === 'invalid') return null;
  return host;
}

export async function issueLoginTicket(db: Db, input: { userId: string; tenantId: string; host: string }) {
  await db`DELETE FROM auth_login_tickets WHERE tenant_id=${input.tenantId} AND expires_at<now()-interval '1 day'`;
  const ticket = randomBytes(32).toString('hex'), browser = randomBytes(32).toString('hex');
  const [row] = await db`INSERT INTO auth_login_tickets(token_hash,browser_hash,user_id,tenant_id,host,expires_at)
    SELECT ${hash(ticket)},${hash(browser)},m.user_id,m.tenant_id,${input.host.toLowerCase()},now()+interval '5 minutes'
    FROM tenant_members m WHERE m.user_id=${input.userId} AND m.tenant_id=${input.tenantId}
      AND (to_jsonb(m)->>'deactivated_at') IS NULL RETURNING token_hash`;
  if (!row) throw new Error('Active SSO membership required');
  return { ticket, browser };
}

export async function findLoginTicket(db: Db, input: { ticket: unknown; email: string; request: Request; companyId?: string }) {
  if (typeof input.ticket !== 'string' || !SECRET.test(input.ticket)) return null;
  const host = requestHost(input.request);
  if (!host) return null;
  const name = loginTicketCookieName(new URL(input.request.url).protocol === 'https:');
  const cookies = (input.request.headers.get('cookie') || '').split(';').map(value => value.trim()).filter(value => value.startsWith(name + '='));
  if (cookies.length !== 1) return null;
  const browser = cookies[0].slice(name.length + 1);
  if (!SECRET.test(browser)) return null;
  const tokenHash = hash(input.ticket), browserHash = hash(browser);
  const [user] = await db`SELECT u.*,m.tenant_id,m.role,t.name AS tenant_name,t.brand_color,t.logo_url,t.industry,t.template_key
    FROM auth_login_tickets k JOIN users u ON u.id=k.user_id
    JOIN tenant_members m ON m.user_id=k.user_id AND m.tenant_id=k.tenant_id
    JOIN tenants t ON t.id=k.tenant_id
    WHERE k.token_hash=${tokenHash} AND k.browser_hash=${browserHash} AND k.host=${host}
      AND k.used_at IS NULL AND k.expires_at>now() AND u.email=${input.email}
      AND (u.sessions_valid_after IS NULL OR k.created_at>=u.sessions_valid_after)
      AND (${input.companyId ?? null}::uuid IS NULL OR k.tenant_id=${input.companyId ?? null}::uuid)
      AND (to_jsonb(m)->>'deactivated_at') IS NULL`;
  return user ? { user, tokenHash, browserHash, host } : null;
}

/** Called after MFA succeeds. Concurrent redemptions must yield exactly one login. */
export async function consumeLoginTicket(db: Db, ticket: NonNullable<Awaited<ReturnType<typeof findLoginTicket>>>) {
  const [used] = await db`UPDATE auth_login_tickets k SET used_at=now()
    WHERE k.token_hash=${ticket.tokenHash} AND k.browser_hash=${ticket.browserHash} AND k.host=${ticket.host}
      AND k.used_at IS NULL AND k.expires_at>now()
      AND EXISTS(SELECT 1 FROM tenant_members m JOIN users u ON u.id=m.user_id WHERE m.user_id=k.user_id AND m.tenant_id=k.tenant_id AND (to_jsonb(m)->>'deactivated_at') IS NULL AND (u.sessions_valid_after IS NULL OR k.created_at>=u.sessions_valid_after))
    RETURNING k.token_hash`;
  return Boolean(used);
}
