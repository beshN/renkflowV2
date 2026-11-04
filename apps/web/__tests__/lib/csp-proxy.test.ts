/** @jest-environment node */
import { HIDDEN_FIELDS_HEADER } from '@/lib/security/field-header';
import { NextRequest } from 'next/server';

jest.mock('@/lib/features/company/host.server', () => ({ companyForHost: jest.fn(async () => null) }));
jest.mock('next-auth/jwt', () => ({ getToken: jest.fn(async () => null) }));
jest.mock('@/lib/security/member-access.server', () => ({ accessDecision: jest.fn(), logAccessDenied: jest.fn(), narrowedHiddenFields: jest.fn(async () => []) }));
jest.mock('@/lib/security/bearer-identity', () => ({ bearerToken: jest.fn(), verifyBearerToken: jest.fn() }));

import { proxy } from '@/proxy';
import { CONTENT_SECURITY_POLICY } from '@/lib/security/security-headers';

describe('CSP through the actual proxy', () => {
  const original = { ...process.env };
  beforeEach(() => {
    process.env.PUBLIC_SITE_MODE = 'off';
    process.env.ALLOW_INSECURE_HTTP = '1';
    delete process.env.CSP_REPORT_ONLY;
    delete process.env.CSP_ENFORCE;
  });
  afterEach(() => { process.env = { ...original }; });
  const request = (path: string) => new NextRequest(`http://localhost:3027${path}`, {
    headers: { host: 'localhost:3027', 'x-nonce': 'attacker-nonce', [HIDDEN_FIELDS_HEADER]: 'prices', 'Content-Security-Policy': "script-src 'unsafe-inline'" },
  });

  it.each(['/auth/login', '/api/health', '/api/auth/session', '/dashboard'])('enforces for pass-through and redirects: %s', async path => {
    process.env.CSP_ENFORCE = '1';
    const response = await proxy(request(path));
    const csp = response.headers.get('Content-Security-Policy')!;
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain('nonce-');
    expect(csp).not.toContain('attacker-nonce');
    expect(response.headers.has('Content-Security-Policy-Report-Only')).toBe(false);
  });

  it('forwards the same nonce and CSP to Next rendering, retaining hidden-field filtering', async () => {
    const first = await proxy(request('/api/auth/session'));
    const second = await proxy(request('/api/auth/session'));
    const nonce = first.headers.get('x-middleware-request-x-nonce');
    expect(nonce).toBeTruthy();
    expect(nonce).not.toBe(second.headers.get('x-middleware-request-x-nonce'));
    expect(first.headers.get('Content-Security-Policy-Report-Only')).toContain(`'nonce-${nonce}'`);
    expect(first.headers.get('x-middleware-request-content-security-policy')).toBe(first.headers.get('Content-Security-Policy-Report-Only'));
    expect(first.headers.get(`x-middleware-request-${HIDDEN_FIELDS_HEADER}`)).toBeNull();
  });

  it.each([false, true])('keeps the baseline enforced in report-only mode; explicit rollback=%s', async rollback => {
    if (rollback) {
      process.env.CSP_ENFORCE = '1';
      process.env.CSP_REPORT_ONLY = '1';
    }
    const response = await proxy(request('/auth/login'));
    expect(response.headers.get('Content-Security-Policy')).toBe(CONTENT_SECURITY_POLICY);
    expect(response.headers.get('Content-Security-Policy-Report-Only')).toContain('nonce-');
    expect(response.headers.get('x-middleware-request-content-security-policy')).toContain('nonce-');
  });

  it('leaves the public landing policy unchanged', async () => {
    const response = await proxy(request('/'));
    expect(response.headers.get('Content-Security-Policy')).toBe(CONTENT_SECURITY_POLICY);
    expect(response.headers.get('Content-Security-Policy-Report-Only')).toContain("script-src 'self' 'unsafe-inline'");
  });
});
