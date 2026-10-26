/** @jest-environment node */
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import { APP_ROUTES, DISALLOWED_ROUTES, PUBLIC_PAGES } from '@/lib/core/site-routes';

const app = path.join(process.cwd(), 'app');
const folders = (dir: string) =>
  readdirSync(path.join(app, dir), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => `/${d.name}`);

describe('robots and sitemap', () => {
  const env = process.env.PUBLIC_SITE_MODE;
  beforeAll(() => { process.env.PUBLIC_SITE_MODE = 'off'; });
  afterAll(() => { process.env.PUBLIC_SITE_MODE = env; });

  it('disallows every signed-in workspace route', () => {
    expect([...APP_ROUTES].sort()).toEqual(folders('(dashboard)').sort());
    const rule = [robots().rules].flat()[0];
    const disallow = [rule.disallow].flat();
    for (const route of [...APP_ROUTES, '/api/']) expect(disallow).toContain(route);
  });

  it('lists only real public pages in the sitemap', () => {
    for (const route of PUBLIC_PAGES) {
      const dir = route === '' ? '(landing)' : route === '/signup' ? 'signup' : `(landing)${route}`;
      expect(existsSync(path.join(app, dir, 'page.tsx'))).toBe(true);
    }
    const urls = sitemap().map((entry) => new URL(entry.url).pathname);
    expect(urls).not.toContain('/careers');
    for (const url of urls) expect(DISALLOWED_ROUTES.some((prefix) => url.startsWith(prefix))).toBe(false);
  });

  it('names no route that does not exist', () => {
    const disallow = [[robots().rules].flat()[0].disallow].flat() as string[];
    for (const gone of ['/full-landing', '/analytics', '/members']) expect(disallow).not.toContain(gone);
  });
});
