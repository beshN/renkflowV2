/** @jest-environment node */
import { createCsp } from '@/lib/security/csp';

describe('application CSP', () => {
  const original = { ...process.env };
  beforeEach(() => {
    delete process.env.CSP_REPORT_ONLY;
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    delete process.env.NEXT_PUBLIC_SOCKET_URL;
    delete process.env.NEXT_PUBLIC_WS_URL;
    delete process.env.NEXT_PUBLIC_SUPPORT_SOCKET_URL;
  });
  afterEach(() => { process.env = { ...original }; });

  it('enforces by default, with an unpredictable nonce per request and critical directives', () => {
    const first = createCsp('/dashboard');
    const second = createCsp('/dashboard');
    expect(first.header).toBe('Content-Security-Policy');
    expect(first.nonce).not.toBe(second.nonce);
    expect(Buffer.from(first.nonce, 'base64')).toHaveLength(32);
    expect(first.policy).toContain(`'nonce-${first.nonce}'`);
    for (const directive of ["default-src 'self'", "frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-src 'self' blob:"]) {
      expect(first.policy).toContain(directive);
    }
    const scripts = first.policy.split('; ').find(part => part.startsWith('script-src'));
    expect(scripts).not.toContain('unsafe-inline');
    expect(scripts).not.toContain('unsafe-eval');
  });

  it.each(['', '0', 'true', 'typo'])('fails safely for rollback value %s', value => {
    process.env.CSP_REPORT_ONLY = value;
    expect(createCsp('/api/health').header).toBe('Content-Security-Policy');
  });

  it('switches only the full policy to report-only with the explicit flag', () => {
    process.env.CSP_REPORT_ONLY = '1';
    const csp = createCsp('/api/health');
    expect(csp.header).toBe('Content-Security-Policy-Report-Only');
    expect(csp.policy).toContain("object-src 'none'");
  });

  it.each(['/api/station/file', '/api/storage/content', '/api/v1/production/files/t/id', '/api/v1/knowledge/id/content', '/api/orders/documents/id/content'])('preserves same-origin preview framing for %s', path => {
    expect(createCsp(path).policy).toContain("frame-ancestors 'self'");
    expect(createCsp('/api/orders').policy).toContain("frame-ancestors 'none'");
  });

  it('allows configured telemetry and sockets without credentials or paths', () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://public-key@telemetry.example.test/42';
    process.env.NEXT_PUBLIC_SOCKET_URL = 'https://socket.example.test/events';
    const csp = createCsp('/dashboard');
    expect(csp.policy).toContain('https://telemetry.example.test');
    expect(csp.policy).toContain('wss://socket.example.test');
    expect(csp.policy).not.toContain('public-key');
    expect(csp.policy).not.toContain('/events');
  });
});
