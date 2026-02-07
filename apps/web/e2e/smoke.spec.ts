import { test, expect } from '@playwright/test';

/**
 * Smoke tests: verify that all public routes return 200 (not redirect to login)
 * and that footer links point to valid destinations.
 */

const publicRoutes = [
  '/',
  '/about',
  '/pricing',
  '/features',
  '/integrations',
  '/faq',
  '/terms',
  '/privacy',
  '/cookies',
  '/contact',
  '/signup',
  '/roadmap',
  '/changelog',
  '/press',
  '/docs',
  '/security',
  '/status',
  '/full-landing',
  '/blog',
  '/careers',
  '/coming-soon',
];

test.describe('Smoke: Public Routes', () => {
  for (const route of publicRoutes) {
    test(`${route} should return 200`, async ({ request }) => {
      const response = await request.fetch(route, { method: 'HEAD' });
      expect(response.status()).toBe(200);
    });
  }
});

test.describe('Smoke: Auth Redirects', () => {
  test('/auth/signup should redirect to /signup', async ({ request }) => {
    const response = await request.fetch('/auth/signup', { method: 'HEAD', maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(response.headers()['location'] || '').toContain('/signup');
  });

  test('/auth/verify-email should redirect to /auth/verify', async ({ request }) => {
    const response = await request.fetch('/auth/verify-email', { method: 'HEAD', maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()['location'] || '').toContain('/auth/verify');
  });
});

test.describe('Smoke: Protected Routes Require Login', () => {
  const protectedRoutes = ['/dashboard', '/orders', '/settings', '/reports'];

  for (const route of protectedRoutes) {
    test(`${route} should redirect to /auth/login`, async ({ request }) => {
      const response = await request.fetch(route, { method: 'HEAD', maxRedirects: 0 });
      expect(response.status()).toBe(307);
      expect(response.headers()['location'] || '').toContain('/auth/login');
    });
  }
});

test.describe('Smoke: Footer Links', () => {
  test('all footer links should point to valid routes', async ({ request }) => {
    const hrefs = ['/privacy', '/terms', '/cookies', '/sitemap.xml'];
    for (const href of hrefs) {
      const response = await request.fetch(href, { method: 'HEAD' });
      expect(response.status(), `Footer link ${href} returned ${response.status()}`).toBe(200);
    }
  });
});

test.describe('Smoke: Newsletter Form', () => {
  test('newsletter API should return validation error for invalid email', async ({ request }) => {
    const response = await request.post('/api/subscribe', {
      data: { email: 'invalid-email' },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(String(body.error || '')).toContain('Geçerli');
  });
});
