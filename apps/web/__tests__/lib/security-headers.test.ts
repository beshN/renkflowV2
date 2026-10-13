/**
 * Every response carries the security headers from `proxy.ts`, including a Content Security Policy.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { SECURITY_HEADERS } from '@/lib/security/security-headers';

describe('security headers', () => {
  it('enforces the CSP directives that cannot break the app', () => {
    const csp = SECURITY_HEADERS['Content-Security-Policy'];
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("object-src 'none'");
  });

  it('reports the full CSP without blocking and without eval', () => {
    const csp = SECURITY_HEADERS['Content-Security-Policy-Report-Only'];
    for (const directive of ["default-src 'self'", "object-src 'none'", "form-action 'self'", 'script-src', 'connect-src']) {
      expect(csp).toContain(directive);
    }
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it('keeps framing and sniffing protection', () => {
    expect(SECURITY_HEADERS['X-Frame-Options']).toBe('DENY');
    expect(SECURITY_HEADERS['X-Content-Type-Options']).toBe('nosniff');
  });

  it('is what the proxy applies', () => {
    const proxy = readFileSync(join(__dirname, '..', '..', 'proxy.ts'), 'utf8');
    expect(proxy).toMatch(/Object\.entries\(SECURITY_HEADERS\)/);
  });
});
