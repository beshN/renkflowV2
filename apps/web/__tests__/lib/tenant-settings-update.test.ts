/** @jest-environment node */
import { POST as updateTenant } from '@/app/api/tenant/update/route';
import { auth } from '@/auth';

jest.mock('server-only', () => ({}));
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/audit/audit-log', () => ({ ...jest.requireActual('@/lib/audit/audit-log'), recordAuditAfterCommit: jest.fn() }));

const tenantId = '22222222-2222-4222-8222-222222222222';
const identifiers: string[] = [];
const updates: unknown[][] = [];
let role = 'owner';

jest.mock('@/lib/db', () => {
  const run = (strings: TemplateStringsArray | string, ...values: unknown[]) => {
    if (!Array.isArray(strings)) { identifiers.push(...(typeof strings === 'string' ? [strings] : Object.keys(strings as object))); return { identifier: strings }; }
    const text = (strings as TemplateStringsArray).join('?');
    const result = (async () => {
      if (/FROM tenant_members/.test(text)) return [{ role }];
      if (/UPDATE tenants/.test(text)) { updates.push(values); return [{ name: 'Eski Ad', brand_color: '#123456', logo_url: null, industry: 'Mobilya', template_key: 'mobilya' }]; }
      return [];
    })();
    return Object.assign(result, { fragment: { text, values } });
  };
  return { sql: jest.fn(run) };
});

const post = (body: unknown) => updateTenant(new Request('http://x/api/tenant/update', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }));

beforeEach(() => {
  identifiers.length = 0;
  updates.length = 0;
  role = 'owner';
  (auth as jest.Mock).mockResolvedValue({ user: { id: '11111111-1111-4111-8111-111111111111', tenantId } });
});

it('saving only the name leaves the template, industry, colour and logo untouched', async () => {
  const response = await post({ tenantId, name: 'Renk Alüminyum' });
  expect(response.status).toBe(200);
  expect(identifiers).toEqual(['name']);
  expect(updates).toHaveLength(1);
});

it('changing the template also sets its industry, and nothing else', async () => {
  expect((await post({ templateKey: 'aluminyum' })).status).toBe(200);
  expect(identifiers.sort()).toEqual(['industry', 'template_key']);
});

it('rejects empty, unknown or invalid updates without writing', async () => {
  expect((await post({ tenantId })).status).toBe(400);
  expect((await post({ templateKey: 'yok' })).status).toBe(400);
  expect((await post({ templateKey: 'constructor' })).status).toBe(400);
  expect((await post({ brandColor: 'kırmızı' })).status).toBe(400);
  expect((await post({ name: 'A' })).status).toBe(400);
  expect(updates).toHaveLength(0);
});

it('is limited to owner and admin', async () => {
  role = 'office';
  expect((await post({ name: 'Renk Alüminyum' })).status).toBe(403);
  expect(updates).toHaveLength(0);
});
