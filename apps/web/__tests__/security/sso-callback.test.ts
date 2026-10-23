/** @jest-environment node */
jest.mock('server-only', () => ({}));
jest.mock('@/lib/db', () => ({ sql: jest.fn() }));
jest.mock('@/lib/auth/sso', () => ({ handleOIDCCallback: jest.fn(), handleSAMLCallback: jest.fn() }));
jest.mock('@/lib/features/company/host.server', () => ({ assertCompanyHostTenant: jest.fn() }));
jest.mock('@/lib/features/auth/login-ticket.server', () => ({
  ...jest.requireActual('@/lib/features/auth/login-ticket.server'), issueLoginTicket: jest.fn(),
}));
import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { handleSAMLCallback } from '@/lib/auth/sso';
import { issueLoginTicket, ssoFlowCookieName } from '@/lib/features/auth/login-ticket.server';
import { POST } from '@/app/api/auth/sso/callback/route';

const state = 'state_' + 'a'.repeat(32);
function request(cookie?: string) {
  const form = new FormData();
  form.set('RelayState', state);
  form.set('SAMLResponse', 'signed-test-response');
  return new NextRequest('https://renkflow.com/api/auth/sso/callback', { method: 'POST', headers: { host: 'renkflow.com', ...(cookie ? { cookie } : {}) }, body: form });
}
beforeEach(() => {
  (sql as unknown as jest.Mock).mockResolvedValue([{ provider_id: 'provider', tenant_id: 'firm', type: 'saml' }]);
  (handleSAMLCallback as jest.Mock).mockResolvedValue({ user: { id: 'user', email: 'user@example.invalid' } });
  (issueLoginTicket as jest.Mock).mockResolvedValue({ ticket: 'b'.repeat(64), browser: 'c'.repeat(64) });
});
it('rejects copied SSO callbacks from a different browser before any provider or database work', async () => {
  expect((await POST(request())).status).toBe(400);
  expect((await POST(request(ssoFlowCookieName(true) + '=state_' + 'd'.repeat(32)))).status).toBe(400);
  expect(sql).not.toHaveBeenCalled();
  expect(handleSAMLCallback).not.toHaveBeenCalled();
});
it('reads a SAML POST body once, issues a private browser-bound ticket and redirects with no token in the query', async () => {
  const response = await POST(request(ssoFlowCookieName(true) + '=' + state));
  expect(response.status).toBe(303);
  expect(handleSAMLCallback).toHaveBeenCalledWith('signed-test-response', state);
  const location = new URL(response.headers.get('location')!);
  expect(location.search).toBe('');
  expect(new URLSearchParams(location.hash.slice(1)).get('ticket')).toBe('b'.repeat(64));
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  const cookie = response.headers.getSetCookie().find(value => value.startsWith('__Host-rf-sso-browser='))!;
  expect(cookie).toMatch(/HttpOnly/i);
  expect(cookie).toMatch(/Secure/i);
  expect(cookie).not.toMatch(/Domain=/i);
  expect(issueLoginTicket).toHaveBeenCalledWith(sql, { userId: 'user', tenantId: 'firm', host: 'renkflow.com' });
});
