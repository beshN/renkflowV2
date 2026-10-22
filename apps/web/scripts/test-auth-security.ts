/** Real Auth.js protocol + real PostgreSQL negative tests; no external IdP or production writes. */
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import postgres from 'postgres';
import { localTestDatabaseURL } from './local-test-database';

async function main() {
  process.env.DATABASE_URL = localTestDatabaseURL();
  process.env.AUTH_SECRET = 'auth-security-local-only-123456789012345678901';
  process.env.AUTH_URL = 'https://renkflow.com';
  process.env.AUTH_TRUST_HOST = 'true';
  delete process.env.PRIVATE_ACCESS_EMAIL;
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
  const [tenant] = await db`INSERT INTO tenants(name,slug) VALUES('Auth security',${'auth-' + randomUUID()}) RETURNING id`;
  const [other] = await db`INSERT INTO tenants(name,slug) VALUES('Other auth firm',${'other-' + randomUUID()}) RETURNING id`;
  const email = randomUUID() + '@example.invalid', verificationToken = randomBytes(32).toString('hex');
  const [user] = await db`INSERT INTO users(name,email,email_verified,verification_token) VALUES('Auth test',${email},now(),${verificationToken}) RETURNING id`;
  await db`INSERT INTO tenant_members(user_id,tenant_id,role) VALUES(${user.id},${tenant.id},'owner'),(${user.id},${other.id},'owner')`;
  const address = 'qa-auth-' + randomUUID().slice(0, 8), host = address + '.renkflow.com';
  await db`UPDATE company_addresses SET address=${address} WHERE tenant_id=${tenant.id}`;
  const { sql } = await import('../lib/db');
  const tickets = await import('../lib/features/auth/login-ticket.server');
  const { authConfig } = await import('../lib/core/auth.config');
  const credentials = authConfig.providers.find((p: any) => p.id === 'credentials') as any;
  const req = (browser?: string, requestHost = 'renkflow.com') => new Request(`https://${requestHost}/api/auth/callback/credentials`, { headers: { host: requestHost, ...(browser ? { cookie: `${tickets.loginTicketCookieName(true)}=${browser}` } : {}), 'x-forwarded-for': '10.44.0.1' } });
  const authorize = (ticket: string, request = req()) => credentials.options.authorize({ email, ticket }, request);
  await assert.rejects(authorize(verificationToken), (e: any) => e.code === 'invalid_credentials');
  assert.equal((await db`SELECT verification_token FROM users WHERE id=${user.id}`)[0].verification_token, verificationToken);
  const fresh = () => tickets.issueLoginTicket(sql, { userId: user.id, tenantId: tenant.id, host: 'renkflow.com' });
  const t = await fresh();
  assert.equal(await tickets.findLoginTicket(sql, { email, ticket: t.ticket, request: req() }), null, 'a copied URL without the initiating browser cannot log in');
  assert.equal(await tickets.findLoginTicket(sql, { email, ticket: t.ticket, request: req(randomBytes(32).toString('hex')) }), null);
  assert.equal(await tickets.findLoginTicket(sql, { email, ticket: t.ticket, request: req(t.browser, host) }), null, 'ticket is exact-host bound');
  assert.equal(await tickets.findLoginTicket(sql, { email, ticket: t.ticket, request: req(t.browser), companyId: other.id }), null, 'ticket cannot select another membership');
  const identity = await tickets.findLoginTicket(sql, { email, ticket: t.ticket, request: req(t.browser) });
  assert(identity);
  const claims = await Promise.all(Array.from({ length: 12 }, () => tickets.consumeLoginTicket(sql, identity)));
  assert.equal(claims.filter(Boolean).length, 1, 'only one concurrent redemption succeeds');
  const reset = await fresh();
  await db`UPDATE users SET sessions_valid_after=clock_timestamp() WHERE id=${user.id}`;
  assert.equal(await tickets.findLoginTicket(sql, { email, ticket: reset.ticket, request: req(reset.browser) }), null, 'sign out everywhere or password reset also invalidates pending tickets');
  await db`UPDATE users SET sessions_valid_after=NULL WHERE id=${user.id}`;
  await assert.rejects(authorize(t.ticket, req(t.browser)), (e: any) => e.code === 'invalid_credentials');
  const expired = await fresh();
  await db`UPDATE auth_login_tickets SET created_at=now()-interval '10 minutes',expires_at=now()-interval '1 second' WHERE user_id=${user.id} AND used_at IS NULL`;
  assert.equal(await tickets.findLoginTicket(sql, { email, ticket: expired.ticket, request: req(expired.browser) }), null);
  const revoked = await fresh();
  await db`UPDATE tenant_members SET deactivated_at=now() WHERE tenant_id=${tenant.id} AND user_id=${user.id}`;
  assert.equal(await tickets.findLoginTicket(sql, { email, ticket: revoked.ticket, request: req(revoked.browser) }), null);
  await db`UPDATE tenant_members SET deactivated_at=NULL WHERE tenant_id=${tenant.id} AND user_id=${user.id}`;
  const valid = await fresh();
  assert.equal((await authorize(valid.ticket, req(valid.browser))).tenantId, tenant.id);
  assert.equal((await db`SELECT verification_token FROM users WHERE id=${user.id}`)[0].verification_token, verificationToken, 'SSO does not overwrite email verification');
  assert(tickets.matchesSsoFlow('state_' + 'a'.repeat(32), 'state_' + 'a'.repeat(32)));
  assert(!tickets.matchesSsoFlow('state_' + 'a'.repeat(32), undefined));

  const mfa = await import('../lib/features/auth/mfa.server');
  const setup = await mfa.startMfaSetup(sql, { userId: user.id, email });
  const { base32Decode, totpAt } = await import('../lib/features/auth/totp');
  const recovery = await mfa.confirmMfaSetup(sql, { userId: user.id, tenantId: tenant.id, code: totpAt(base32Decode(setup.secret), Math.floor(Date.now()/30000)) });
  const secondFactor = await fresh();
  await assert.rejects(authorize(secondFactor.ticket, req(secondFactor.browser)), (e: any) => e.code === 'otp_required');
  assert(await tickets.findLoginTicket(sql, { email, ticket: secondFactor.ticket, request: req(secondFactor.browser) }), 'MFA challenge does not spend the ticket');
  assert.equal((await credentials.options.authorize({ email, ticket: secondFactor.ticket, otp: recovery[0] }, req(secondFactor.browser))).tenantId, tenant.id);

  const { findOrCreateSSOUser } = await import('../lib/features/auth/sso');
  const provider = { id: randomUUID(), tenantId: tenant.id, type: 'oidc' as const, name: 'Local IdP', enabled: true, allowSignup: true, domainRestrictions: ['example.invalid'] };
  await assert.rejects(findOrCreateSSOUser({ email }, provider), /verified global sign-in/, 'a firm-controlled IdP cannot claim a global identity in another firm');
  await assert.rejects(findOrCreateSSOUser({ email: 'someone@outside.invalid' }, provider), /Domain not allowed/);
  await assert.rejects(findOrCreateSSOUser({ email: randomUUID()+'@example.invalid', attributes: { email_verified: false } }, provider), /could not be verified/);
  const provisioned = await findOrCreateSSOUser({ email: randomUUID()+'@example.invalid', groups: ['Owner','admin','Admin','manager'] }, provider);
  assert.equal(provisioned.role, 'member', 'unmapped group names must not grant owner/admin access');
  await db`DELETE FROM tenant_members WHERE user_id=${provisioned.id}`;
  await db`DELETE FROM users WHERE id=${provisioned.id}`;

  // Exercise Auth.js itself: fixed AUTH_URL, central registered callback, encrypted state relay,
  // host-only PKCE/state/session cookies, and rejection when browser proof is absent/tampered.
  const { Auth, customFetch } = await import('@auth/core');
  const { NextRequest } = await import('next/server');
  const { companyAuthHandler } = await import('../lib/features/company/auth-handler.server');
  const { companyAuthRedirect, COMPANY_AUTH_PROXY_URL } = await import('../lib/features/company/host');
  let exchanged = 0;
  const protocolErrors: string[] = [];
  const config: any = { secret: process.env.AUTH_SECRET, trustHost: true, basePath: '/api/auth', session: { strategy: 'jwt' },
    providers: [{ id: 'google', name: 'Test OIDC transport', type: 'oauth', clientId: 'local-client', clientSecret: 'local-secret', checks: ['pkce','state'], redirectProxyUrl: COMPANY_AUTH_PROXY_URL,
      authorization: 'https://idp.example.invalid/authorize', token: 'https://idp.example.invalid/token', userinfo: 'https://idp.example.invalid/userinfo',
      profile: (p: any) => ({ id: p.sub, email: p.email, name: 'Protocol test' }),
      [customFetch]: async (url: string, init: RequestInit) => {
        if (String(url).endsWith('/token')) { exchanged++; const body = new URLSearchParams(String(init.body)); assert.equal(body.get('redirect_uri'), COMPANY_AUTH_PROXY_URL + '/callback/google'); assert(body.get('code_verifier')); return Response.json({ access_token: 'local-access', token_type: 'Bearer' }); }
        if (String(url).endsWith('/userinfo')) return Response.json({ sub: user.id, email });
        throw new Error('Unexpected external request: ' + url);
      } }],
    callbacks: { redirect: ({ url, baseUrl }: any) => companyAuthRedirect(url, baseUrl, new URL(baseUrl).host, true), jwt: ({ token }: any) => ({ ...token, tenantId: tenant.id }) },
    logger: { error(e: any) { protocolErrors.push(`${e.name}: ${e.message}; ${e.cause?.err?.message || ''}`); }, warn() {}, debug() {} },
  };
  // Auth.js provider factories put customFetch in `options` (symbols aren't deep-merged).
  config.providers[0].options = { [customFetch]: config.providers[0][customFetch] };
  const originalFetch = global.fetch;
  global.fetch = config.providers[0][customFetch];
  const shared = (r: any) => Auth(r, config);
  const call = (url: string, init?: RequestInit) => companyAuthHandler(new NextRequest(url, { ...init, headers: { ...Object.fromEntries(new Headers(init?.headers)), host: new URL(url).host } }), config, shared);
  const jar = (response: Response) => response.headers.getSetCookie().map(v => v.split(';')[0]).join('; ');
  const csrf = await call(`https://${host}/api/auth/csrf`), csrfToken = (await csrf.json()).csrfToken;
  const signin = await call(`https://${host}/api/auth/signin/google`, { method: 'POST', headers: { cookie: jar(csrf), 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrfToken, callbackUrl: `https://${host}/dashboard` }).toString() });
  const authUrl = new URL(signin.headers.get('location')!);
  assert.equal(authUrl.searchParams.get('redirect_uri'), COMPANY_AUTH_PROXY_URL + '/callback/google');
  assert(authUrl.searchParams.get('code_challenge'));
  const state = authUrl.searchParams.get('state')!;
  const central = await call(COMPANY_AUTH_PROXY_URL + '/callback/google?' + new URLSearchParams({ code: 'local-code', state }));
  const callback = central.headers.get('location')!;
  assert.equal(new URL(callback).host, host, 'central callback returns to the initiating company, even with fixed AUTH_URL');
  assert.equal(exchanged, 0, 'central proxy does not redeem a company code');
  const missing = await call(callback);
  assert(!missing.headers.getSetCookie().some(v => v.includes('authjs.session-token=')));
  const tampered = await call(callback.replace(encodeURIComponent(state), encodeURIComponent(state.slice(0, -8) + 'tampered')), { headers: { cookie: jar(signin) } });
  assert(!tampered.headers.getSetCookie().some(v => v.includes('authjs.session-token=')));
  const complete = await call(callback, { headers: { cookie: jar(signin) } });
  assert.equal(exchanged, 1, JSON.stringify(protocolErrors));
  assert.equal(complete.headers.get('location'), `https://${host}/dashboard`);
  const sessions = complete.headers.getSetCookie().filter(v => v.includes('authjs.session-token='));
  assert(sessions.length);
  assert(sessions.every(v => !/;\s*Domain=/i.test(v) && /;\s*HttpOnly/i.test(v) && /;\s*Secure/i.test(v)));
  assert.equal((await call('https://unknown-' + randomUUID() + '.renkflow.com/api/auth/providers')).status, 404);
  global.fetch = originalFetch;
  console.log('PASS auth security: purpose-separated expiring browser/host/company-bound tickets, one concurrent redemption, revoked membership, real Auth.js central OAuth relay, PKCE/state and host-only cookies');
  await db`DELETE FROM tenants WHERE id IN(${tenant.id},${other.id})`;
  await db`DELETE FROM users WHERE id=${user.id}`;
  await db.end({ timeout: 5 });
}
main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
