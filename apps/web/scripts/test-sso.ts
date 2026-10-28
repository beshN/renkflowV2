/**
 * Enterprise SSO on the real path, on the isolated local test database only: a fake OIDC identity
 * provider on 127.0.0.1 (discovery, JWKS, token, userinfo) → /api/auth/sso/callback → ticket →
 * credentials authorize → session firm. Covers e-mail trust, (provider, subject) binding, firm-bound
 * tickets and the second factor.
 */
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, randomBytes, randomUUID, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer, type IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import postgres from 'postgres';

import { localTestDatabaseURL } from './local-test-database';

type Claims = Record<string, unknown> & { sub: string };

const b64url = (value: Buffer | string) => Buffer.from(value).toString('base64url');

/** A minimal OIDC provider: codes are registered by the test (standing in for the user's browser). */
async function startFakeIdp(clientId: string, clientSecret: string) {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
  const codes = new Map<string, { claims: Claims; challenge: string }>();
  const tokens = new Map<string, Claims>();
  let issuer = '';
  const body = (req: IncomingMessage) =>
    new Promise<string>((resolve) => {
      let data = '';
      req.on('data', (chunk) => (data += chunk));
      req.on('end', () => resolve(data));
    });
  const server = createServer(async (req, res) => {
    const json = (status: number, value: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(value));
    };
    const url = new URL(req.url ?? '/', issuer);
    if (url.pathname === '/.well-known/openid-configuration') {
      return json(200, {
        issuer,
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/token`,
        userinfo_endpoint: `${issuer}/userinfo`,
        jwks_uri: `${issuer}/jwks`,
        response_types_supported: ['code'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        token_endpoint_auth_methods_supported: ['client_secret_post'],
        code_challenge_methods_supported: ['S256'],
      });
    }
    if (url.pathname === '/jwks') return json(200, { keys: [jwk] });
    if (url.pathname === '/token' && req.method === 'POST') {
      const form = new URLSearchParams(await body(req));
      if (form.get('client_id') !== clientId || form.get('client_secret') !== clientSecret) return json(401, { error: 'invalid_client' });
      const grant = codes.get(form.get('code') ?? '');
      codes.delete(form.get('code') ?? '');
      const verifier = form.get('code_verifier') ?? '';
      if (!grant || createHash('sha256').update(verifier).digest('base64url') !== grant.challenge) return json(400, { error: 'invalid_grant' });
      const now = Math.floor(Date.now() / 1000);
      const header = b64url(JSON.stringify({ alg: 'RS256', kid: 'k1', typ: 'JWT' }));
      const payload = b64url(JSON.stringify({ iss: issuer, aud: clientId, sub: grant.claims.sub, iat: now, exp: now + 300 }));
      const signature = sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), privateKey).toString('base64url');
      const accessToken = randomBytes(16).toString('hex');
      tokens.set(accessToken, grant.claims);
      return json(200, { access_token: accessToken, token_type: 'Bearer', expires_in: 300, id_token: `${header}.${payload}.${signature}` });
    }
    if (url.pathname === '/userinfo') {
      const claims = tokens.get(String(req.headers.authorization ?? '').replace(/^Bearer /, ''));
      return claims ? json(200, claims) : json(401, { error: 'invalid_token' });
    }
    json(404, { error: 'not_found' });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  issuer = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    issuer,
    /** What the IdP does after the user signs in there: a code for these claims, bound to the PKCE challenge. */
    authorize(authorizationUrl: string, claims: Claims) {
      const challenge = new URL(authorizationUrl).searchParams.get('code_challenge');
      assert.ok(challenge, 'PKCE challenge sent');
      const code = randomBytes(12).toString('hex');
      codes.set(code, { claims, challenge });
      return code;
    },
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function main() {
  process.env.AUTH_SECRET = 'sso-integration-local-only-12345678901234567890';
  process.env.DATABASE_URL = localTestDatabaseURL();
  delete process.env.PRIVATE_ACCESS_EMAIL;
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');

  // The SSO tables come from files the local test database does not load (0005 bootstrap, 004 never
  // applied); create them as those files do, then rerun 080 so its provider column and foreign key apply.
  await db.unsafe(`
    CREATE TABLE IF NOT EXISTS sso_providers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name text NOT NULL, type text NOT NULL, metadata text, client_id text, client_secret text, authorization_url text,
      token_url text, user_info_url text, issuer_url text, enabled boolean NOT NULL DEFAULT true,
      allow_signup boolean NOT NULL DEFAULT false, domain_restrictions text[],
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS sso_states (
      state text PRIMARY KEY, provider_id uuid NOT NULL REFERENCES sso_providers(id) ON DELETE CASCADE,
      callback_url text NOT NULL, code_verifier text, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL);
  `);
  await db.unsafe(readFileSync(path.join(__dirname, '../lib/db/migrations/080_sso_identities.sql'), 'utf8'));
  await db.unsafe(readFileSync(path.join(__dirname, '../lib/db/migrations/080_sso_identities.sql'), 'utf8'));
  const [fk] = await db`SELECT count(*)::int AS n FROM pg_constraint WHERE conname = 'sso_identities_provider_fk'`;
  assert.equal(fk.n, 1, '080 is idempotent and adds the provider foreign key once sso_providers exists');

  const clientId = 'renkflow-test-client';
  const clientSecret = randomBytes(16).toString('hex');
  const idp = await startFakeIdp(clientId, clientSecret);

  const { sql } = await import('../lib/db');
  const { initiateOIDCLogin } = await import('../lib/features/auth/sso');
  const { GET: callback } = await import('../app/api/auth/sso/callback/route');
  const { NextRequest } = await import('next/server');
  const { authConfig } = await import('../lib/core/auth.config');
  const mfa = await import('../lib/features/auth/mfa.server');
  const { base32Decode, totpAt } = await import('../lib/features/auth/totp');
  const { SSO_ERRORS } = await import('../lib/features/auth/sso-policy');
  const credentials = authConfig.providers.find((p: any) => p.id === 'credentials') as any;
  const authorize = credentials.options.authorize as (c: Record<string, string>, r: Request) => Promise<any>;
  const signIn = (fields: Record<string, string>) =>
    authorize(fields, new Request('https://renkflow.com/api/auth/callback/credentials', { headers: { 'x-forwarded-for': `10.7.${Math.floor(Math.random() * 250)}.1` } }));
  async function code(promise: Promise<unknown>): Promise<string> {
    try {
      await promise;
      return 'ok';
    } catch (error) {
      return String((error as { code?: string }).code);
    }
  }

  const tenant = async (name: string) => (await db`INSERT INTO tenants(name, slug) VALUES (${name}, ${'sso-' + randomUUID()}) RETURNING id`)[0].id as string;
  const user = async (email: string) => (await db`INSERT INTO users(name, email, email_verified) VALUES ('Üye', ${email}, now()) RETURNING id`)[0].id as string;
  const provider = async (tenantId: string, options: { allowSignup?: boolean; domains?: string[]; trust?: boolean } = {}) =>
    (await db`
      INSERT INTO sso_providers (tenant_id, name, type, client_id, client_secret, issuer_url, allow_signup, domain_restrictions, trust_idp_email)
      VALUES (${tenantId}, 'Fake IdP', 'oidc', ${clientId}, ${clientSecret}, ${idp.issuer}, ${options.allowSignup ?? false}, ${options.domains ?? null}, ${options.trust ?? false})
      RETURNING id`)[0].id as string;

  /** Browser round trip: RenkFlow → IdP (signs in as `claims`) → callback. */
  async function ssoLogin(providerId: string, claims: Claims) {
    const redirectUri = 'https://renkflow.com/api/auth/sso/callback';
    const { url, state } = await initiateOIDCLogin(providerId, redirectUri);
    const idpCode = idp.authorize(url, claims);
    const res = await callback(new NextRequest(`${redirectUri}?code=${idpCode}&state=${state}`));
    if (res.status === 307 || res.status === 302) {
      const location = new URL(res.headers.get('location') ?? '');
      assert.equal(location.pathname, '/auth/sso-verify');
      return { status: res.status, email: location.searchParams.get('email') ?? '', ticket: location.searchParams.get('ticket') ?? '' };
    }
    return { status: res.status, error: ((await res.json()) as { error: string }).error };
  }
  const identities = async (providerId: string) => db`SELECT subject, user_id FROM sso_identities WHERE provider_id = ${providerId} ORDER BY subject`;

  const firmA = await tenant('SSO firması A');
  const firmB = await tenant('Başka firma B');
  const firmC = await tenant('Kapalı kayıt C');
  const pa = await provider(firmA, { allowSignup: true });
  const pc = await provider(firmC, { allowSignup: false });
  const pd = await provider(firmA, { allowSignup: true, domains: ['corp.example.invalid'] });

  // Victim: owner in B only.
  const victimEmail = `kurban-${randomUUID()}@example.invalid`;
  const victim = await user(victimEmail);
  await db`INSERT INTO tenant_members(tenant_id, user_id, role) VALUES (${firmB}, ${victim}, 'owner')`;

  // 1. email_verified: false is refused; nothing is linked, no membership, no ticket.
  const unverified = await ssoLogin(pa, { sub: 'attacker-1', email: victimEmail, email_verified: false });
  assert.equal(unverified.status, 403);
  assert.equal(unverified.error, SSO_ERRORS.unverifiedEmail);
  assert.equal((await db`SELECT 1 FROM tenant_members WHERE user_id = ${victim} AND tenant_id = ${firmA}`).length, 0);
  assert.equal((await identities(pa)).length, 0);
  assert.equal((await db`SELECT verification_token FROM users WHERE id = ${victim}`)[0].verification_token, null);

  // 2. No claim, provider not trusted and no allowed domain: refused.
  const unproven = await ssoLogin(pa, { sub: 'attacker-2', email: victimEmail });
  assert.equal(unproven.status, 403);
  assert.equal(unproven.error, SSO_ERRORS.unprovenEmail);

  // 3. Another firm's IdP without sign-up cannot reach the victim's account (not a member of C).
  const otherIdp = await ssoLogin(pc, { sub: 'attacker-3', email: victimEmail, email_verified: true });
  assert.equal(otherIdp.status, 403);
  assert.equal(otherIdp.error, SSO_ERRORS.notMember);

  // 4. A new person: account created in A, identity recorded, the session opens in A.
  const newEmail = `yeni-${randomUUID()}@example.invalid`;
  const created = await ssoLogin(pa, { sub: 'new-1', email: newEmail.toUpperCase(), email_verified: true, name: 'Yeni Kişi' });
  assert.equal(created.status, 307);
  assert.equal(created.email, newEmail);
  const signedIn = await signIn({ email: created.email!, ticket: created.ticket! });
  assert.equal(signedIn.tenantId, firmA);
  const token = await authConfig.callbacks!.jwt!({ token: {}, user: signedIn } as any);
  assert.equal((token as any)?.tenantId, firmA, 'the session is in the provider firm');
  assert.equal(await code(signIn({ email: created.email!, ticket: created.ticket! })), 'invalid_credentials', 'a ticket works once');
  const newUserId = (await db`SELECT id FROM users WHERE email = ${newEmail}`)[0].id;
  assert.deepEqual((await identities(pa)).map((r) => [r.subject, r.user_id]), [['new-1', newUserId]]);

  // 5. A person in two firms (owner in B, worker in A) signs in with A's IdP: the session is A,
  //    never B by role priority.
  const multiEmail = `iki-firma-${randomUUID()}@example.invalid`;
  const multi = await user(multiEmail);
  await db`INSERT INTO tenant_members(tenant_id, user_id, role, created_at) VALUES (${firmB}, ${multi}, 'owner', now() - interval '1 day'), (${firmA}, ${multi}, 'worker', now())`;
  const linked = await ssoLogin(pa, { sub: 'multi-1', email: multiEmail, email_verified: true });
  assert.equal(linked.status, 307);
  const multiSession = await signIn({ email: linked.email!, ticket: linked.ticket! });
  assert.equal(multiSession.tenantId, firmA);
  assert.equal(multiSession.role, 'worker');

  // 6. A different subject claiming that (now linked) e-mail on the same provider is refused.
  const taken = await ssoLogin(pa, { sub: 'multi-2', email: multiEmail, email_verified: true });
  assert.equal(taken.status, 403);
  assert.equal(taken.error, SSO_ERRORS.subjectTaken);

  // 7. The known subject keeps its account even when the IdP sends another address now.
  const renamed = await ssoLogin(pa, { sub: 'multi-1', email: `baska-${randomUUID()}@example.invalid`, email_verified: true });
  assert.equal(renamed.status, 307);
  assert.equal(renamed.email, multiEmail, 'bound by subject, not e-mail');
  assert.notEqual((await db`SELECT last_login_at FROM sso_identities WHERE provider_id = ${pa} AND subject = 'multi-1'`)[0].last_login_at, null);

  // 8. A ticket counts only while the person is an active member of the provider firm.
  await db`UPDATE tenant_members SET deactivated_at = now() WHERE tenant_id = ${firmA} AND user_id = ${multi}`;
  assert.equal(await code(signIn({ email: renamed.email!, ticket: renamed.ticket! })), 'tenant_not_found', 'never falls back to firm B');
  const deactivated = await ssoLogin(pa, { sub: 'multi-1', email: multiEmail, email_verified: true });
  assert.equal(deactivated.status, 403);
  assert.equal(deactivated.error, SSO_ERRORS.deactivated);
  await db`UPDATE tenant_members SET deactivated_at = NULL WHERE tenant_id = ${firmA} AND user_id = ${multi}`;

  // 9. A ticket row from before tickets carried the firm, or one edited to another firm, is refused.
  const again = await ssoLogin(pa, { sub: 'multi-1', email: multiEmail, email_verified: true });
  const [{ verification_token: stored }] = await db`SELECT verification_token FROM users WHERE id = ${multi}`;
  await db`UPDATE users SET verification_token = ${stored.replace(firmA, firmB)} WHERE id = ${multi}`;
  assert.equal(await code(signIn({ email: again.email!, ticket: again.ticket! })), 'invalid_credentials');
  await db`UPDATE users SET verification_token = ${stored.split(':').slice(0, 3).join(':')} WHERE id = ${multi}`;
  assert.equal(await code(signIn({ email: again.email!, ticket: again.ticket! })), 'invalid_credentials');

  // 10. With two-step sign-in on, the ticket still needs the code (and stays valid until it comes).
  const setup = await mfa.startMfaSetup(sql, { userId: multi, email: multiEmail });
  const key = base32Decode(setup.secret);
  const step = Math.floor(Date.now() / 1000 / 30);
  await mfa.confirmMfaSetup(sql, { userId: multi, tenantId: firmA, code: totpAt(key, step) });
  const mfaLogin = await ssoLogin(pa, { sub: 'multi-1', email: multiEmail, email_verified: true });
  assert.equal(await code(signIn({ email: mfaLogin.email!, ticket: mfaLogin.ticket! })), 'otp_required');
  const withCode = await signIn({ email: mfaLogin.email!, ticket: mfaLogin.ticket!, otp: totpAt(key, step + 1) });
  assert.equal(withCode.tenantId, firmA);

  // 11. No claim, but the address is in the provider's allowed domain: accepted. Other domains: refused.
  const domainEmail = `alan-${randomUUID()}@corp.example.invalid`;
  const byDomain = await ssoLogin(pd, { sub: 'domain-1', email: domainEmail });
  assert.equal(byDomain.status, 307);
  assert.equal((await signIn({ email: byDomain.email!, ticket: byDomain.ticket! })).tenantId, firmA);
  const outside = await ssoLogin(pd, { sub: 'domain-2', email: `x-${randomUUID()}@example.invalid`, email_verified: true });
  assert.equal(outside.status, 403);
  assert.equal(outside.error, SSO_ERRORS.domainNotAllowed);

  // 12. A provider marked as verifying e-mails accepts a login without the claim.
  const trusted = await provider(firmA, { allowSignup: true, trust: true });
  const trustedLogin = await ssoLogin(trusted, { sub: 'trusted-1', email: `guven-${randomUUID()}@example.invalid` });
  assert.equal(trustedLogin.status, 307);

  // The victim's account was never touched.
  assert.deepEqual((await db`SELECT tenant_id FROM tenant_members WHERE user_id = ${victim}`).map((r) => r.tenant_id), [firmB]);
  assert.equal((await db`SELECT count(*)::int AS n FROM sso_identities WHERE user_id = ${victim}`)[0].n, 0);

  console.log('PASS · SSO: fake IdP → callback → ticket → session firm; email_verified=false and unproven e-mails refused, allowed domain / trusted IdP accepted, other firm IdP refused, (provider, subject) binding with re-used e-mail refused, ticket bound to the provider firm (no role-priority fallback, tampered/legacy tickets refused), deactivated member refused, second factor still required');
  await idp.close();
  await db.end({ timeout: 5 });
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
