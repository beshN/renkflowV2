import { evaluateComingSoonRequest } from '@/lib/launch/comingSoonGate';

describe('Coming soon middleware', () => {
  it('passes through when mode is off', () => {
    const action = evaluateComingSoonRequest('/pricing', 'GET', 'off');
    expect(action).toEqual({ type: 'next' });
  });

  it('rewrites root to coming soon in launch mode', () => {
    const action = evaluateComingSoonRequest('/', 'GET', 'coming-soon');
    expect(action).toEqual({ type: 'rewrite', destination: '/coming-soon' });
  });

  it('rewrites root HEAD requests to coming soon in launch mode', () => {
    const action = evaluateComingSoonRequest('/', 'HEAD', 'coming-soon');
    expect(action).toEqual({ type: 'rewrite', destination: '/coming-soon' });
  });

  it('allows direct coming-soon page access', () => {
    const action = evaluateComingSoonRequest('/coming-soon', 'GET', 'coming-soon');
    expect(action).toEqual({ type: 'next' });
  });

  it('redirects non-public pages to coming-soon', () => {
    const action = evaluateComingSoonRequest('/dashboard', 'GET', 'coming-soon');
    expect(action).toEqual({ type: 'redirect', destination: '/coming-soon' });
  });

  it('allows subscribe API for POST and handles preflight OPTIONS', () => {
    const postAction = evaluateComingSoonRequest('/api/subscribe', 'POST', 'coming-soon');
    const optionsAction = evaluateComingSoonRequest('/api/subscribe', 'OPTIONS', 'coming-soon');
    expect(postAction).toEqual({ type: 'next' });
    expect(optionsAction).toEqual({ type: 'subscribeOptions' });
  });

  it('blocks subscribe API for non-public methods', () => {
    const action = evaluateComingSoonRequest('/api/subscribe', 'GET', 'coming-soon');
    expect(action).toEqual({ type: 'api404' });
  });

  it('returns api404 for non-public APIs in launch mode', () => {
    const action = evaluateComingSoonRequest('/api/auth/session', 'GET', 'coming-soon');
    expect(action).toEqual({ type: 'api404' });
  });

  it('allows next internal and public static assets', () => {
    const nextAssetAction = evaluateComingSoonRequest('/_next/static/chunks/main.js', 'GET', 'coming-soon');
    const publicAssetAction = evaluateComingSoonRequest('/renkflow-logo-new.png', 'GET', 'coming-soon');
    expect(nextAssetAction).toEqual({ type: 'next' });
    expect(publicAssetAction).toEqual({ type: 'next' });
  });

  // Edge-case: HEAD requests for non-root paths
  it('redirects HEAD requests for non-public pages', () => {
    const action = evaluateComingSoonRequest('/dashboard', 'HEAD', 'coming-soon');
    expect(action).toEqual({ type: 'redirect', destination: '/coming-soon' });
  });

  // Edge-case: API path variations
  it('blocks API paths with trailing slashes', () => {
    const action = evaluateComingSoonRequest('/api/subscribe/', 'POST', 'coming-soon');
    expect(action).toEqual({ type: 'api404' });
  });

  it('blocks other API paths', () => {
    const action = evaluateComingSoonRequest('/api/orders', 'GET', 'coming-soon');
    expect(action).toEqual({ type: 'api404' });
  });

  // Edge-case: Case sensitivity
  it('blocks API paths regardless of case in path', () => {
    const action = evaluateComingSoonRequest('/api/Subscribe', 'POST', 'coming-soon');
    expect(action).toEqual({ type: 'api404' });
  });

  // Edge-case: Public paths allowlist
  it('allows all PUBLIC_PATHS entries', () => {
    const publicPaths = ['/coming-soon', '/robots.txt', '/sitemap.xml', '/favicon.ico', '/manifest.json', '/sw.js'];
    publicPaths.forEach(path => {
      const action = evaluateComingSoonRequest(path, 'GET', 'coming-soon');
      expect(action).toEqual({ type: 'next' });
    });
  });

  // Edge-case: _next/image path
  it('allows _next/image paths', () => {
    const action = evaluateComingSoonRequest('/_next/image?url=/logo.png&w=128&q=75', 'GET', 'coming-soon');
    expect(action).toEqual({ type: 'next' });
  });

  // Edge-case: Invalid/empty mode values
  it('passes through for empty mode value', () => {
    const action = evaluateComingSoonRequest('/dashboard', 'GET', '');
    expect(action).toEqual({ type: 'next' });
  });

  it('passes through for whitespace mode value', () => {
    const action = evaluateComingSoonRequest('/dashboard', 'GET', '  ');
    expect(action).toEqual({ type: 'next' });
  });

  it('enforces coming-soon mode even with trailing newline', () => {
    const action = evaluateComingSoonRequest('/dashboard', 'GET', 'coming-soon\n');
    expect(action).toEqual({ type: 'redirect', destination: '/coming-soon' });
  });

  it('enforces coming-soon mode regardless of case in env value', () => {
    const action = evaluateComingSoonRequest('/dashboard', 'GET', 'COMING-SOON');
    expect(action).toEqual({ type: 'redirect', destination: '/coming-soon' });
  });

  // Edge-case: DELETE/PUT/PATCH methods on subscribe
  it('blocks non-POST/OPTIONS methods on subscribe API', () => {
    ['DELETE', 'PUT', 'PATCH'].forEach(method => {
      const action = evaluateComingSoonRequest('/api/subscribe', method, 'coming-soon');
      expect(action).toEqual({ type: 'api404' });
    });
  });

  // Edge-case: coming-soon subpaths
  it('allows coming-soon subpaths', () => {
    const action = evaluateComingSoonRequest('/coming-soon/thank-you', 'GET', 'coming-soon');
    expect(action).toEqual({ type: 'next' });
  });
});
