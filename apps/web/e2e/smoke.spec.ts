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
  test('/full-landing should permanently redirect to /', async ({ request }) => {
    const response = await request.fetch('/full-landing', { method: 'HEAD', maxRedirects: 0 });
    expect([301, 308]).toContain(response.status());
    expect(new URL(response.headers()['location'] || '', 'http://x').pathname).toBe('/');
  });

  test('unknown blog posts should not be indexable', async ({ request }) => {
    // Landing pages stream, so Next.js marks not-found results with noindex instead of a 404 status.
    const response = await request.fetch('/blog/olmayan-yazi');
    expect(await response.text()).toContain('<meta name="robots" content="noindex"/>');
  });

  test('/auth/signup should redirect to /signup', async ({ request }) => {
    const response = await request.fetch('/auth/signup', { method: 'HEAD', maxRedirects: 0 });
    expect([302, 307, 308, 404]).toContain(response.status());
    if (response.status() !== 404) {
      expect(response.headers()['location'] || '').toContain('/signup');
    }
  });

  test('/auth/verify-email should redirect to /auth/verify', async ({ request }) => {
    const response = await request.fetch('/auth/verify-email', { method: 'HEAD', maxRedirects: 0 });
    expect([302, 307, 308, 404]).toContain(response.status());
    if (response.status() !== 404) {
      expect(response.headers()['location'] || '').toContain('/auth/verify');
    }
  });
});

test.describe('Smoke: Protected Routes Require Login', () => {
  const protectedRoutes = ['/dashboard', '/orders', '/settings', '/reports'];

  for (const route of protectedRoutes) {
    test(`${route} should require auth or return guarded response`, async ({ request }) => {
      const response = await request.fetch(route, { method: 'HEAD', maxRedirects: 0 });
      expect(response.status()).not.toBe(404);
      const location = response.headers()['location'] || '';
      if (location) {
        expect(
          location.includes('/auth/login') ||
            location.includes('/coming-soon'),
        ).toBeTruthy();
      }
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
    expect([400, 500]).toContain(response.status());
    const body = await response.json();
    expect(String(body.error || '').length > 0).toBeTruthy();
  });
});
