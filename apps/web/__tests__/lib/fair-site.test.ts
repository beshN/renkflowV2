/** @jest-environment node */
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { DesignItemsSchema, itemSpecs, itemSummary, newItem, newToken, TOKEN_PATTERN } from '@/lib/features/fair/design';
import { decodeDesign, encodeDesign, fragmentPayload } from '@/lib/features/fair/transfer';
import { configuratorRewrite } from '@/lib/features/fair/config';
import { QuoteInput } from '@/lib/features/fair/quote-input';
import { quoteEmailHtml, sendQuoteConfirmation } from '@/lib/features/fair/email.server';

jest.mock('next-auth/jwt', () => ({ getToken: jest.fn(async () => null) }));
jest.mock('server-only', () => ({}));

const TENANT = '11111111-2222-4333-8444-555555555555';
function withEnv(env: Record<string, string | undefined>, run: () => Promise<void>) {
  const previous = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
  for (const [k, v] of Object.entries(env)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  return run().finally(() => {
    for (const [k, v] of Object.entries(previous)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  });
}
const hit = (url: string, init?: ConstructorParameters<typeof NextRequest>[1]) => proxy(new NextRequest(url, init));
const rewrittenTo = (res: Response) => new URL(res.headers.get('x-middleware-rewrite')!).pathname;
const HOST = 'https://configurator.example.com';

describe('configurator domain', () => {
  const env = { FAIR_TENANT_ID: TENANT, FAIR_HOSTS: 'configurator.example.com', PRIVATE_ACCESS_EMAIL: 'pilot@example.invalid' };
  it('maps the public routes onto the configurator', () =>
    withEnv(env, async () => {
      expect(rewrittenTo(await hit(HOST + '/'))).toBe('/configurator');
      expect(rewrittenTo(await hit(HOST + '/fair/rt2027'))).toBe('/configurator/fair/rt2027');
      expect(rewrittenTo(await hit(HOST + '/simulator'))).toBe('/configurator/simulator');
      expect((await hit(HOST + '/fair/rt2027')).headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
      expect((await hit(HOST + '/simulator')).headers.get('X-Frame-Options')).toBe('DENY');
      expect((await hit(HOST + '/c/AbCdEfGhIjKlMnOpQrStUv')).headers.get('X-Frame-Options')).toBe('DENY');
      expect(rewrittenTo(await hit(HOST + '/c/AbCdEfGhIjKlMnOpQrStUv'))).toBe('/configurator/c/AbCdEfGhIjKlMnOpQrStUv');
      for (const path of ['/api/v1/public/fair/designs', '/api/v1/public/fair/quotes', '/configurator-sw.js', '/_next/static/chunks/main.js'])
        expect((await hit(HOST + path, { method: path.includes('api') ? 'POST' : 'GET' })).headers.get('x-middleware-next')).toBe('1');
    }));
  it('serves nothing else', () =>
    withEnv(env, async () => {
      const dashboard = await hit(HOST + '/dashboard');
      expect(dashboard.status).toBe(302);
      expect(new URL(dashboard.headers.get('location')!).pathname).toBe('/');
      for (const path of ['/api/v1/orders', '/api/v1/leads/fair', '/api/auth/session', '/api/v1/orders/x.pdf'])
        expect((await hit(HOST + path)).status).toBe(404);
    }));
  it('opens the configurator inside RenkFlow only when it is configured', async () => {
    await withEnv({ ...env, FAIR_HOSTS: undefined }, async () => {
      expect((await hit('https://renkflow.com/configurator/fair/rt2027')).headers.get('x-middleware-next')).toBe('1');
      expect((await hit('https://renkflow.com/configurator/fair/rt2027')).headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
      expect((await hit('https://renkflow.com/api/v1/public/fair/quotes', { method: 'POST' })).headers.get('x-middleware-next')).toBe('1');
    });
    await withEnv({ ...env, FAIR_TENANT_ID: undefined, FAIR_HOSTS: undefined }, async () => {
      expect((await hit('https://renkflow.com/api/v1/public/fair/quotes', { method: 'POST' })).status).toBe(401);
    });
  });
  it('rewrites only the supported public shapes', () => {
    expect(configuratorRewrite('/simulator/')).toBe('/configurator/simulator');
    expect(configuratorRewrite('/simulator/anything')).toBeNull();
    expect(configuratorRewrite('/fair/rt2027/')).toBe('/configurator/fair/rt2027');
    expect(configuratorRewrite('/fair/a/b')).toBeNull();
    expect(configuratorRewrite('/dashboard')).toBeNull();
  });
});

describe('design model', () => {
  it('builds valid items for every product, WINMAX included', () => {
    const items = (['makasli', 'pergola', 'zip', 'giyotin', 'bioclimatic'] as const).map(newItem);
    expect(DesignItemsSchema.safeParse(items).success).toBe(true);
  });
  it('rejects a configuration that does not match its product or its range', () => {
    const awning = newItem('makasli');
    expect(DesignItemsSchema.safeParse([{ ...awning, awning: { ...awning.awning!, widthMm: 20000 } }]).success).toBe(false);
    const pergola = newItem('pergola');
    expect(DesignItemsSchema.safeParse([{ ...pergola, kind: 'zip' }]).success).toBe(false);
    expect(DesignItemsSchema.safeParse([{ ...pergola, options: { control: 'motor-remote' } }]).success).toBe(false);
    expect(DesignItemsSchema.safeParse([]).success).toBe(false);
  });
  it('makes unguessable 22-character tokens', () => {
    const tokens = new Set(Array.from({ length: 200 }, newToken));
    expect(tokens.size).toBe(200);
    for (const t of tokens) expect(t).toMatch(TOKEN_PATTERN);
  });
  it('describes items in three languages', () => {
    const awning = { ...newItem('makasli'), quantity: 2 };
    expect(itemSummary('en', awning)).toBe('2 × WINMAX Folding-Arm Awning · 6000 × 4000 mm');
    expect(itemSummary('de', awning)).toContain('Gelenkarmmarkise');
    expect(itemSpecs('en', awning)).toEqual(expect.arrayContaining([['Motor and control', 'UBESER · remote control'], ['Frame colour', 'Anthracite (#343a40)']]));
    expect(itemSpecs('tr', awning).map(([k]) => k)).toContain('Motor ve kontrol');
  });
});

describe('QR transfer', () => {
  it('round-trips a multi-product design without previews and stays QR-sized', () => {
    const items = [newItem('makasli'), newItem('pergola'), newItem('zip'), newItem('giyotin')].map((i) => ({ ...i, image: 'data:image/jpeg;base64,AAAA' }));
    const encoded = encodeDesign({ fairCode: 'rt2027', locale: 'de', items });
    const decoded = decodeDesign(fragmentPayload(`#d=${encoded}`)!);
    expect(decoded?.fairCode).toBe('rt2027');
    expect(decoded?.locale).toBe('de');
    expect(decoded?.items).toEqual(items.map(({ image: _i, ...rest }) => rest));
    // A version-25 QR code at level L holds ~1800 characters; the whole link must stay well below.
    expect(`https://configurator.renkaluminyum.com/c/${newToken()}#d=${encoded}`.length).toBeLessThan(900);
  });
  it('rejects tampered or foreign fragments', () => {
    expect(decodeDesign('not-a-design')).toBeNull();
    expect(fragmentPayload('#x=1')).toBeNull();
  });
});

describe('quote input', () => {
  const base = { token: newToken(), locale: 'en', items: [newItem('makasli')], contactName: 'Ada Lovelace', email: 'ada@example.com', privacyAccepted: true };
  it('needs only name and e-mail; marketing consent defaults to off', () => {
    const d = QuoteInput.parse(base);
    expect(d.marketingConsent).toBe(false);
  });
  it('requires the e-mail and the privacy acknowledgement', () => {
    expect(QuoteInput.safeParse({ ...base, email: '' }).success).toBe(false);
    expect(QuoteInput.safeParse({ ...base, privacyAccepted: false }).success).toBe(false);
  });
});

describe('confirmation e-mail', () => {
  const items = [{ ...newItem('makasli'), note: '<script>x</script>' }];
  it('lists the products, links the design and escapes customer text', () => {
    const html = quoteEmailHtml({ locale: 'de', firm: 'Renk', number: 'TT-2026-000001', contactName: 'Ada <b>', items, designUrl: 'https://configurator.example.com/c/AbCdEfGhIjKlMnOpQrStUv' });
    expect(html).toContain('https://configurator.example.com/c/AbCdEfGhIjKlMnOpQrStUv');
    expect(html).toContain('Gelenkarmmarkise');
    expect(html).toContain('Fernbedienung');
    expect(html).not.toContain('<script>');
    expect(html).toContain('Ada &lt;b&gt;');
  });
  it('says so when no e-mail service is configured', async () => {
    const previous = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    await expect(sendQuoteConfirmation({ to: 'a@b.c', locale: 'en', firm: '', number: 'TT-1', contactName: 'A', items, designUrl: 'x' })).resolves.toEqual({ status: 'not_configured', error: 'RESEND_API_KEY is not set' });
    if (previous !== undefined) process.env.RESEND_API_KEY = previous;
  });
});
