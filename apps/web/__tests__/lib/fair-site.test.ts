/** @jest-environment node */
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { FairRequestSchema, itemSummary, leadFamilyFor } from '@/lib/features/fair/schema';
import { defaultVisualization } from '@/lib/features/product-3d/catalog';

jest.mock('next-auth/jwt', () => ({ getToken: jest.fn(async () => null) }));

const TENANT = '11111111-2222-4333-8444-555555555555';
function withEnv(env: Record<string, string | undefined>, run: () => Promise<void>) {
  const previous = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
  Object.assign(process.env, env);
  for (const [k, v] of Object.entries(env)) if (v === undefined) delete process.env[k];
  return run().finally(() => {
    for (const [k, v] of Object.entries(previous)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  });
}
const hit = (url: string, init?: ConstructorParameters<typeof NextRequest>[1]) => proxy(new NextRequest(url, init));

describe('fair domain', () => {
  it('serves only the fair page, its API and static files', () =>
    withEnv({ FAIR_TENANT_ID: TENANT, FAIR_HOSTS: 'fuar.example.com', PRIVATE_ACCESS_EMAIL: 'pilot@example.invalid' }, async () => {
      const root = await hit('https://fuar.example.com/');
      expect(new URL(root.headers.get('x-middleware-rewrite')!).pathname).toBe('/fuar');
      expect((await hit('https://fuar.example.com/fuar')).headers.get('x-middleware-next')).toBe('1');
      expect((await hit('https://fuar.example.com/api/v1/public/fair', { method: 'POST' })).headers.get('x-middleware-next')).toBe('1');
      expect((await hit('https://fuar.example.com/_next/static/chunks/main.js')).headers.get('x-middleware-next')).toBe('1');
      const dashboard = await hit('https://fuar.example.com/dashboard');
      expect(dashboard.status).toBe(302);
      expect(new URL(dashboard.headers.get('location')!).pathname).toBe('/');
      for (const path of ['/api/v1/orders', '/api/v1/leads/fair', '/api/auth/session', '/api/v1/orders/x.pdf'])
        expect((await hit('https://fuar.example.com' + path)).status).toBe(404);
    }));

  it('opens the fair page on the main domain only when the module is configured', () =>
    withEnv({ FAIR_TENANT_ID: TENANT, FAIR_HOSTS: undefined, PRIVATE_ACCESS_EMAIL: 'pilot@example.invalid' }, async () => {
      expect((await hit('https://renkflow.com/fuar')).headers.get('x-middleware-next')).toBe('1');
      expect((await hit('https://renkflow.com/api/v1/public/fair', { method: 'POST' })).headers.get('x-middleware-next')).toBe('1');
    }));

  it('keeps the fair paths private when the module is off', () =>
    withEnv({ FAIR_TENANT_ID: undefined, FAIR_HOSTS: undefined, PRIVATE_ACCESS_EMAIL: 'pilot@example.invalid' }, async () => {
      expect((await hit('https://renkflow.com/api/v1/public/fair', { method: 'POST' })).status).toBe(401);
    }));
});

describe('fair request input', () => {
  const base = {
    items: [{ configuration: defaultVisualization('pergola'), quantity: 2 }],
    contactName: 'Ayşe Yılmaz', phone: '0532 123 45 67', privacyAccepted: true,
  };
  it('accepts a minimal request', () => {
    const d = FairRequestSchema.parse(base);
    expect(d.marketingConsent).toBe(false);
    expect(itemSummary(d.items[0])).toBe('2 × Pergola Tente 6000 × 4000 mm');
  });
  it('requires the privacy notice, a phone and at least one product', () => {
    expect(FairRequestSchema.safeParse({ ...base, privacyAccepted: false }).success).toBe(false);
    expect(FairRequestSchema.safeParse({ ...base, phone: '123' }).success).toBe(false);
    expect(FairRequestSchema.safeParse({ ...base, items: [] }).success).toBe(false);
  });
  it('rejects sizes beyond the product range and unknown fields', () => {
    expect(FairRequestSchema.safeParse({ ...base, items: [{ configuration: { ...defaultVisualization('zip'), widthMm: 9000 } }] }).success).toBe(false);
    expect(FairRequestSchema.safeParse({ ...base, tenantId: 'x' }).success).toBe(false);
  });
  it('maps a lead family only when every product shares one', () => {
    expect(leadFamilyFor([{ configuration: { kind: 'pergola' } }])).toBe('pergola');
    expect(leadFamilyFor([{ configuration: { kind: 'pergola' } }, { configuration: { kind: 'zip' } }])).toBeNull();
  });
});
