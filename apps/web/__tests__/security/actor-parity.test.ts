/**
 * @jest-environment node
 *
 * One actor for every kind of sign-in: the same narrowed member reaches the API through a browser
 * session, a password API token or a phone session token, and gets the same module decisions, the
 * same hidden fields and the same two-step rule, in the proxy and in the shared route helpers.
 */
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

process.env.AUTH_SECRET = 'actor-parity-test-secret-0123456789abcdef';
process.env.NEXTAUTH_SECRET = process.env.AUTH_SECRET;

type Member = { role: string; accessRole: string | null; mfa: boolean };
const members = new Map<string, Member>();
const policy = new Map<string, boolean>();
let failPolicyRead = false;

jest.mock('server-only', () => ({}));
jest.mock('@/lib/features/company/host.server', () => ({
  companyForHost: jest.fn(async () => null),
  assertCompanyHostTenant: jest.fn(async () => undefined),
  CompanyHostError: class extends Error {},
}));
jest.mock('@/lib/features/auth/mfa.server', () => ({ isMfaEnabled: jest.fn(async () => false) }));
jest.mock('next-auth/jwt', () => ({ getToken: jest.fn(async () => null) }));
jest.mock('@/auth', () => ({ auth: jest.fn(async () => null) }));
jest.mock('next/headers', () => ({ headers: jest.fn() }));
jest.mock('@/lib/db', () => {
  const sql = jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join('?').replace(/\s+/g, ' ');
    if (text.includes('information_schema.columns') && text.includes('access_role')) return [{ ok: true }];
    if (text.includes('FROM tenant_members m') && text.includes('access_roles')) {
      const [tenantId, userId] = values as string[];
      const m = members.get(`${tenantId}:${userId}`);
      return m ? [{ role: m.role, access_role: m.accessRole, deactivated_at: null, custom_id: null }] : [];
    }
    if (text.includes('sessions_valid_after')) return [{ valid_after: null, sessions_valid_after: null }];
    if (text.includes("require_mfa_for_admins' AS policy")) {
      if (failPolicyRead) throw new Error('connection reset');
      return [{ policy: policy.get(String(values[0])) ? 'true' : null, mfa_table: true }];
    }
    if (text.includes('FROM user_mfa')) {
      const userId = String(values[0]);
      return [...members.entries()].some(([k, m]) => k.endsWith(':' + userId) && m.mfa) ? [{ ok: 1 }] : [];
    }
    return [];
  });
  return { sql, getSql: () => sql };
});

import { getToken } from 'next-auth/jwt';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { proxy } from '@/proxy';
import { APIAccessError, getAPIUser } from '@/lib/shared/api/auth-helpers';
import { requestHiddenFields } from '@/lib/security/field-redaction.server';

const tenantId = '11111111-1111-4111-8111-111111111111';
let seq = 0;
function member(role: string, accessRole: string | null, mfa = false) {
  const userId = `22222222-2222-4222-8222-${String(++seq).padStart(12, '0')}`;
  members.set(`${tenantId}:${userId}`, { role, accessRole, mfa });
  return userId;
}
const apiToken = (userId: string) => jwt.sign({ sub: userId, tenantId, email: `${userId}@test.invalid`, name: 'x', role: 'office' }, process.env.AUTH_SECRET!, { expiresIn: 600 });
const phoneToken = (userId: string) =>
  jwt.sign({ sub: userId, tenantId, email: `${userId}@test.invalid`, name: 'x', role: 'office', sid: '33333333-3333-4333-8333-333333333333', type: 'mobile' }, process.env.AUTH_SECRET!, { audience: 'renkflow-mobile', expiresIn: 600 });

function signedInWithCookie(userId: string | null) {
  jest.mocked(getToken).mockResolvedValue(userId ? ({ id: userId, sub: userId, tenantId, email: `${userId}@test.invalid` } as never) : null);
  jest.mocked(auth).mockResolvedValue((userId ? { user: { id: userId, tenantId, email: `${userId}@test.invalid`, name: 'x' } } : null) as never);
}
const request = (path: string, init: { bearer?: string; method?: string } = {}) =>
  new NextRequest('https://renkflow.com' + path, { method: init.method ?? 'GET', headers: init.bearer ? { authorization: `Bearer ${init.bearer}` } : {} });

/** What the proxy forwards to the route: refused (status) or the hidden-field header it set. */
async function throughProxy(req: NextRequest) {
  const res = await proxy(req);
  if (res.headers.get('x-middleware-next') !== '1') return { status: res.status, location: res.headers.get('location'), body: res.status >= 400 ? await res.json() : null, hidden: null };
  return { status: 200, location: null, body: null, hidden: res.headers.get('x-middleware-request-x-rf-hidden-fields') ?? '' };
}

/** Field groups requestHiddenFields reports for a request with these headers. */
async function hiddenFor(h: Record<string, string>) {
  jest.mocked(headers).mockResolvedValue(new Headers(h) as never);
  return requestHiddenFields();
}

beforeEach(() => {
  signedInWithCookie(null);
  failPolicyRead = false;
  policy.clear();
});

describe('a narrowed member (planning preset: no quotations, prices hidden)', () => {
  it('gets the same actor from a browser session, an API token and a phone session', async () => {
    const userId = member('office', 'planning');
    const viaBearer = await getAPIUser(request('/api/v1/orders', { bearer: apiToken(userId) }));
    const viaPhone = await getAPIUser(request('/api/v1/orders', { bearer: phoneToken(userId) }));
    signedInWithCookie(userId);
    const viaCookie = await getAPIUser(request('/api/v1/orders'));
    for (const user of [viaBearer, viaPhone]) {
      expect(user?.role).toBe(viaCookie?.role);
      expect(user?.narrowed).toEqual(viaCookie?.narrowed);
      expect(user?.hidden).toEqual(viaCookie?.hidden);
    }
    expect(viaCookie?.narrowed?.permissions.quotations).toBeUndefined();
    expect(viaCookie?.hidden).toEqual(expect.arrayContaining(['price', 'profit']));
    expect([viaBearer?.via, viaPhone?.via, viaCookie?.via]).toEqual(['api_token', 'mobile', 'session']);
  });

  it('is refused a module outside the role by the route helper on every path', async () => {
    const userId = member('office', 'planning');
    await expect(getAPIUser(request('/api/v1/quotations', { bearer: apiToken(userId) }))).rejects.toMatchObject({ status: 403 });
    await expect(getAPIUser(request('/api/v1/quotations', { bearer: phoneToken(userId) }))).rejects.toBeInstanceOf(APIAccessError);
    signedInWithCookie(userId);
    await expect(getAPIUser(request('/api/v1/quotations'))).rejects.toMatchObject({ status: 403 });
  });

  it('is gated and gets the same hidden-field header in the proxy, cookie or bearer', async () => {
    const userId = member('office', 'planning');
    const bearer = await throughProxy(request('/api/v1/orders', { bearer: apiToken(userId) }));
    const refusedBearer = await throughProxy(request('/api/v1/quotations', { bearer: apiToken(userId) }));
    signedInWithCookie(userId);
    const cookie = await throughProxy(request('/api/v1/orders'));
    const refusedCookie = await throughProxy(request('/api/v1/quotations'));
    expect(bearer.hidden).toBe(cookie.hidden);
    expect(cookie.hidden).toContain('price');
    expect([refusedBearer.status, refusedCookie.status]).toEqual([403, 403]);
  });

  it('cannot shed a narrowed credential by sending a second, wider one', async () => {
    const planner = member('office', 'planning');
    const officeMember = member('office', null);
    signedInWithCookie(officeMember);
    const both = await throughProxy(request('/api/v1/orders', { bearer: apiToken(planner) }));
    expect(both.hidden).toContain('price');
    expect((await throughProxy(request('/api/v1/quotations', { bearer: apiToken(planner) }))).status).toBe(403);
    expect(await hiddenFor({ authorization: `Bearer ${apiToken(planner)}` })).toEqual(expect.arrayContaining(['price']));
  });

  it('has the same fields redacted with or without the proxy header', async () => {
    const userId = member('office', 'planning');
    const viaBearer = await hiddenFor({ authorization: `Bearer ${apiToken(userId)}` });
    const viaPhone = await hiddenFor({ authorization: `Bearer ${phoneToken(userId)}` });
    signedInWithCookie(userId);
    const viaCookie = await hiddenFor({});
    expect(viaBearer).toEqual(viaCookie);
    expect(viaPhone).toEqual(viaCookie);
    expect(viaCookie).toEqual(expect.arrayContaining(['price', 'profit']));
  });

  it('falls back to the proxy header only when no actor can be resolved', async () => {
    expect(await hiddenFor({ 'x-rf-hidden-fields': 'cost,bogus' })).toEqual(['cost']);
    expect(await hiddenFor({})).toEqual([]);
    // A forged header can only add hiding, never remove the actor's.
    const userId = member('office', 'warehouse');
    expect(await hiddenFor({ authorization: `Bearer ${apiToken(userId)}`, 'x-rf-hidden-fields': '' })).toEqual(['price', 'cost', 'profit', 'customer_contact']);
  });

  it('keeps today\'s behaviour for a member on the base role\'s own preset', async () => {
    const userId = member('office', null);
    const user = await getAPIUser(request('/api/v1/quotations', { bearer: apiToken(userId) }));
    expect(user?.narrowed).toBeUndefined();
    expect(user?.hidden).toEqual([]);
    expect(await hiddenFor({ authorization: `Bearer ${apiToken(userId)}` })).toEqual([]);
  });
});

describe('the firm requires two-step sign-in of owners and admins', () => {
  it('refuses everything but the set-up endpoints to an owner without it, on every path', async () => {
    const userId = member('owner', null);
    policy.set(tenantId, true);
    for (const bearer of [apiToken(userId), phoneToken(userId)]) {
      await expect(getAPIUser(request('/api/v1/orders', { bearer }))).rejects.toMatchObject({ status: 403, code: 'mfa_setup_required' });
      const blocked = await throughProxy(request('/api/v1/orders', { bearer }));
      expect(blocked).toMatchObject({ status: 403, body: { code: 'mfa_setup_required' } });
      expect((await getAPIUser(request('/api/v1/auth/me', { bearer })))?.id).toBe(userId);
    }
    expect((await throughProxy(request('/api/v1/orders', { bearer: apiToken(userId), method: 'POST' }))).body.code).toBe('mfa_setup_required');
    signedInWithCookie(userId);
    expect((await throughProxy(request('/api/v1/finance/summary'))).body).toMatchObject({ code: 'mfa_setup_required' });
    for (const open of ['/api/v1/me/gate', '/api/v1/me/mfa', '/api/v1/me/consent', '/api/auth/signout', '/account'])
      expect([open, (await throughProxy(request(open))).status]).toEqual([open, 200]);
    // Pages are sent to the account page instead.
    const page = await throughProxy(request('/dashboard'));
    expect(page.status).toBe(302);
    expect(page.location).toMatch(/\/account\?mfa=required$/);
  });

  it('does not touch other roles, owners who have it, or firms without the rule', async () => {
    policy.set(tenantId, true);
    const office = member('office', null);
    const ownerWithMfa = member('owner', null, true);
    expect((await getAPIUser(request('/api/v1/orders', { bearer: apiToken(office) })))?.role).toBe('office');
    expect((await getAPIUser(request('/api/v1/orders', { bearer: apiToken(ownerWithMfa) })))?.role).toBe('owner');
    policy.clear();
    const owner = member('owner', null);
    expect((await getAPIUser(request('/api/v1/orders', { bearer: apiToken(owner) })))?.role).toBe('owner');
  });

  it('fails closed for owners and admins only when the rule cannot be read', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      failPolicyRead = true;
      const admin = member('admin', null);
      const office = member('office', null);
      await expect(getAPIUser(request('/api/v1/orders', { bearer: apiToken(admin) }))).rejects.toMatchObject({ code: 'mfa_setup_required' });
      expect((await getAPIUser(request('/api/v1/orders', { bearer: apiToken(office) })))?.role).toBe('office');
    } finally {
      error.mockRestore();
    }
  });
});
