/**
 * Which paths search engines may see (app/robots.ts, app/sitemap.ts). __tests__/lib/site-routes.test.ts
 * keeps these lists in step with the folders under app/(landing) and app/(dashboard).
 */

/** Public marketing pages listed in the sitemap ('' is the home page). /careers is left out while no position is open. */
export const PUBLIC_PAGES = [
  '',
  '/features',
  '/pricing',
  '/integrations',
  '/security',
  '/about',
  '/contact',
  '/faq',
  '/blog',
  '/docs',
  '/changelog',
  '/roadmap',
  '/status',
  '/press',
  '/privacy',
  '/terms',
  '/cookies',
  '/signup',
] as const;

/** Signed-in workspace: one entry per folder under app/(dashboard). */
export const APP_ROUTES = [
  '/account', '/accounting', '/assistant', '/audit', '/calendar', '/crm', '/dashboard', '/factory',
  '/finance', '/installations', '/inventory', '/kanban', '/knowledge', '/leads', '/new-order',
  '/notifications', '/office', '/orders', '/production', '/products', '/purchases', '/quotations',
  '/receipts', '/reports', '/scrap', '/search', '/service', '/settings', '/shipments', '/suppliers',
  '/team', '/vehicles', '/warehouse', '/work-orders',
] as const;

/** APIs, sign-in flows, station tablets and token links sent to customers (quote approval, delivery signature, tracking). */
export const PRIVATE_ROUTES = ['/api/', '/auth/', '/station', '/q/', '/teklif/', '/teslim/', '/track/', '/product-3d-lab'] as const;

/** Prefixes are matched by crawlers as "starts with", so '/orders' also covers '/orders/123'. */
export const DISALLOWED_ROUTES = [...PRIVATE_ROUTES, ...APP_ROUTES];
