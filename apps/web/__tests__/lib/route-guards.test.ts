/**
 * Every API route handler must pass a server-side guard (directly or through a helper in the same
 * file), or be on the public list below with the reason and the protection it must keep.
 * A new route without a guard fails this test.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const API = join(ROOT, 'app', 'api');

const GUARD = /getAPIUser|requireWorkOrderActor|getServerUserContext|requireTenantContext|\bauth\(\)|apiContextWithPermission|requireCustomerActor|runCron|internalAuthorized|resolveTenantMembership/;

/** Public on purpose: path → why, and what must stay in the file to keep it safe. */
const PUBLIC: Record<string, { why: string; keeps: RegExp | null }> = {
  'auth/[...nextauth]': { why: 'NextAuth giriş uç noktası', keeps: /handlers/ },
  'auth/forgot-password': { why: 'şifre sıfırlama talebi', keeps: /consumeRateLimit/ },
  'auth/register': { why: 'kayıt', keeps: /consumeRateLimit/ },
  'auth/resend-verification': { why: 'doğrulama e-postası', keeps: /consumeRateLimit/ },
  'auth/reset-password': { why: 'tek kullanımlık özetlenmiş jeton', keeps: /hashToken/ },
  'auth/verify-reset-token': { why: 'tek kullanımlık özetlenmiş jeton', keeps: /hashToken/ },
  'auth/sso/login': { why: 'SSO yönlendirmesi', keeps: /initiate(SAML|OIDC)Login/ },
  'auth/sso/callback': { why: 'SSO dönüşü (sağlayıcı doğrular)', keeps: /sso/ },
  'v1/auth/login': { why: 'mobil giriş', keeps: /rateLimit/ },
  'tenant/invite/accept': { why: 'davet jetonuyla katılım', keeps: /consumeRateLimit/ },
  'tenant/invite/validate': { why: 'davet jetonu kontrolü', keeps: /consumeRateLimit/ },
  'v1/public/quotes/[token]': { why: 'müşteri teklif bağlantısı (jeton)', keeps: /getClientIp/ },
  'v1/tracking/[token]': { why: 'müşteri takip bağlantısı (jeton)', keeps: /token/ },
  'v1/webhooks/resend': { why: 'imzalı webhook', keeps: /webhooks\.verify/ },
  'v1/webhooks/whatsapp': { why: 'imzalı webhook', keeps: /timingSafeEqual/ },
  'contact': { why: 'iletişim formu', keeps: /consumeRateLimit/ },
  'subscribe': { why: 'bülten', keeps: /consumeRateLimit/ },
  'health': { why: 'sağlık kontrolü, veri yok', keeps: null },
  'health/ready': { why: 'hazır kontrolü, veri yok', keeps: null },
  'ready': { why: 'hazır kontrolü, veri yok', keeps: null },
  'notifications/vapid-key': { why: 'açık anahtar', keeps: null },
};

function routes(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return routes(p);
    return name === 'route.ts' ? [p] : [];
  });
}

/** Handlers exported by a route file, each with whether it reaches a guard. */
function handlers(source: string) {
  const fns = new Map<string, string>();
  for (const m of source.matchAll(/(?:async\s+)?function\s+(\w+)\s*\(/g)) fns.set(m[1], '');
  const chunks = source.split(/(?=(?:export\s+)?(?:async\s+)?function\s+\w+\s*\(|export\s+const\s+(?:GET|POST|PUT|PATCH|DELETE)\b)/);
  const bodies = new Map<string, string>();
  for (const c of chunks) {
    const m = c.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)|^export\s+const\s+(\w+)/);
    if (m) bodies.set(m[1] ?? m[2], c);
  }
  const guarded = (name: string, seen = new Set<string>()): boolean => {
    if (seen.has(name)) return false;
    seen.add(name);
    const body = bodies.get(name) ?? '';
    if (GUARD.test(body)) return true;
    return [...fns.keys()].some((f) => f !== name && new RegExp(`\\b${f}\\(`).test(body) && guarded(f, seen));
  };
  return [...bodies.keys()].filter((n) => /^(GET|POST|PUT|PATCH|DELETE)$/.test(n)).map((n) => ({ method: n, guarded: guarded(n) }));
}

const files = routes(API).map((file) => ({ file, key: relative(API, file).replace(/\/route\.ts$/, '').replace(/\\/g, '/'), source: readFileSync(file, 'utf8') }));

describe('API route guards', () => {
  it('finds the routes', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('every handler outside the public list passes a server-side guard', () => {
    const open = files
      .filter((f) => !PUBLIC[f.key])
      .flatMap((f) => handlers(f.source).filter((h) => !h.guarded).map((h) => `${h.method} /api/${f.key}`));
    expect(open).toEqual([]);
  });

  it('each public route still has the protection it is listed with', () => {
    const missing = Object.entries(PUBLIC).flatMap(([key, rule]) => {
      const f = files.find((x) => x.key === key);
      if (!f) return [`${key}: dosya yok (listeden çıkarın)`];
      return rule.keeps && !rule.keeps.test(f.source) ? [`${key}: ${rule.keeps}`] : [];
    });
    expect(missing).toEqual([]);
  });

  it('the internal e-mail relay fails closed without its secret', () => {
    const f = files.find((x) => x.key === 'internal/admin-notification')!;
    expect(f.source).toMatch(/if \(!secret \|\| !header\) return false/);
    expect(f.source).not.toMatch(/NODE_ENV === 'production'/);
  });
});
