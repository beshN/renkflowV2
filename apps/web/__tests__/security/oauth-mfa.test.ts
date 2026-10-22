/** @jest-environment node */
jest.mock('server-only', () => ({}));
jest.mock('next-auth', () => ({ CredentialsSignin: class extends Error { code = 'credentials'; } }));
jest.mock('next-auth/providers/google', () => ({ __esModule: true, default: (options: unknown) => ({ id: 'google', options }) }));
jest.mock('next-auth/providers/azure-ad', () => ({ __esModule: true, default: (options: unknown) => ({ id: 'azure-ad', options }) }));
jest.mock('next-auth/providers/credentials', () => ({ __esModule: true, default: (options: unknown) => ({ id: 'credentials', options }) }));
jest.mock('@/lib/shared/config/runtime-env', () => ({ IS_PRODUCTION: true, IS_BUILD_TIME: false, resolveAuthSecret: () => 'oauth-test-only-secret-at-least-thirty-two-characters' }));
jest.mock('@/lib/features/company/host.server', () => ({ currentCompany: jest.fn(async () => ({ id: 'firm' })), companyForHost: jest.fn() }));
jest.mock('@/lib/features/auth/private-access', () => ({ isPrivateAccessAllowed: () => true }));
jest.mock('@/lib/features/auth/mfa.server', () => ({ isMfaEnabled: jest.fn(), verifyMfaCode: jest.fn() }));
jest.mock('@/lib/features/auth/login-ticket.server', () => ({ issueLoginTicket: jest.fn(), loginTicketCookieName: () => '__Host-rf-sso-browser' }));
jest.mock('next/headers', () => ({ headers: jest.fn(), cookies: jest.fn() }));
jest.mock('@/lib/db', () => {
  const query = jest.fn(async (strings: TemplateStringsArray) => {
    const text = strings.join('?');
    if (text.includes('INSERT INTO users')) return [{ id: 'user' }];
    if (text.includes('LEFT JOIN LATERAL')) return [{ tenant_id: 'firm', role: 'owner', tenant_name: 'Test firm' }];
    return [{ tenant_id: 'firm' }];
  });
  Object.assign(query, { begin: (run: (tx: typeof query) => Promise<unknown>) => run(query) });
  return { getSql: () => query, sql: query };
});
import { authConfig } from '@/lib/core/auth.config';
import { isMfaEnabled } from '@/lib/features/auth/mfa.server';
import { issueLoginTicket } from '@/lib/features/auth/login-ticket.server';
import { headers, cookies } from 'next/headers';

const setCookie = jest.fn();
const signin = (verified: boolean = true) => (authConfig.callbacks!.signIn as any)({ user: { email: 'owner@example.invalid', name: 'Owner' }, account: { provider: 'google' }, profile: { email_verified: verified } });
beforeEach(() => {
  (isMfaEnabled as jest.Mock).mockResolvedValue(true);
  (issueLoginTicket as jest.Mock).mockResolvedValue({ ticket: 'a'.repeat(64), browser: 'b'.repeat(64) });
  (headers as jest.Mock).mockResolvedValue(new Headers({ host: 'test.renkflow.com', 'x-forwarded-proto': 'https' }));
  (cookies as jest.Mock).mockResolvedValue({ set: setCookie });
});
it('sends a verified Google identity to this account’s OTP step before Auth.js can create a member session', async () => {
  const result = await signin();
  const target = new URL(result);
  expect(target.origin).toBe('https://test.renkflow.com');
  expect(target.pathname).toBe('/auth/sso-verify');
  expect(target.search).toBe('');
  expect(new URLSearchParams(target.hash.slice(1)).get('ticket')).toBe('a'.repeat(64));
  expect(issueLoginTicket).toHaveBeenCalledWith(expect.any(Function), { userId: 'user', tenantId: 'firm', host: 'test.renkflow.com' });
  expect(setCookie).toHaveBeenCalledWith('__Host-rf-sso-browser', 'b'.repeat(64), { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 300 });
});
it('does not trust an unverified Google email for account linking', async () => {
  expect(await signin(false)).toBe(false);
  expect(issueLoginTicket).not.toHaveBeenCalled();
});
it('keeps the existing direct OAuth path for accounts without MFA', async () => {
  (isMfaEnabled as jest.Mock).mockResolvedValue(false);
  expect(await signin()).toBe(true);
  expect(setCookie).not.toHaveBeenCalled();
});
it('fails closed when the callback host is not an allowed application host', async () => {
  (headers as jest.Mock).mockResolvedValue(new Headers({ host: 'attacker.invalid' }));
  expect(await signin()).toBe(false);
  expect(issueLoginTicket).not.toHaveBeenCalled();
});
