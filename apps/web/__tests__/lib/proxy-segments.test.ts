/**
 * The proxy lets signed-out requests for unknown top-level paths reach the 404 page. That is only safe while
 * its segment list names every top-level app route, so a new page can never slip past the login redirect.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const APP = join(ROOT, 'app');

function topSegments(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (!statSync(p).isDirectory()) return [];
    // Route groups like (dashboard) add no URL segment; look inside them.
    if (/^\(.*\)$/.test(name)) return topSegments(p);
    if (name.startsWith('_') || name.startsWith('[')) return [];
    const hasRoute = (d: string): boolean => readdirSync(d).some((f) => {
      const q = join(d, f);
      return statSync(q).isDirectory() ? hasRoute(q) : /^(page|route)\.tsx?$/.test(f);
    });
    return hasRoute(p) ? [name] : [];
  });
}

const source = readFileSync(join(ROOT, 'proxy.ts'), 'utf8');
const listed = new Set([...source.match(/const APP_SEGMENTS = new Set\(\[([\s\S]*?)\]\)/)![1].matchAll(/'([^']+)'/g)].map((m) => m[1]));
const publicPaths = new Set([...source.match(/const PUBLIC_EXACT_PATHS = new Set\(\[([\s\S]*?)\]\)/)![1].matchAll(/'\/([^'/]*)'/g)].map((m) => m[1]));

describe('proxy segment list', () => {
  it('names every top-level app route that is not a public page', () => {
    const missing = [...new Set(topSegments(APP))].filter((s) => !listed.has(s) && !publicPaths.has(s));
    expect(missing).toEqual([]);
  });
});
