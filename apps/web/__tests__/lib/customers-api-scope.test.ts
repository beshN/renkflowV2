/** @jest-environment node */
import { NextRequest } from 'next/server';
import { GET as listCustomers, POST as createCustomer } from '@/app/api/v1/customers/route';
import { GET as getCustomer, PUT as updateCustomer, DELETE as deleteCustomer } from '@/app/api/v1/customers/[id]/route';
import { GET as dashboardSummary } from '@/app/api/v1/dashboard/summary/route';
import { auth } from '@/auth';

jest.mock('server-only', () => ({}));
jest.mock('@/auth', () => ({ auth: jest.fn() }));

type Query = { text: string; values: unknown[] };
const queries: Query[] = [];
const identifiers: string[] = [];
const userId = '11111111-1111-4111-8111-111111111111';
const firmA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; // older membership: worker
const firmB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'; // session firm: owner
const customerId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const memberships: Record<string, string> = {};

jest.mock('@/lib/db', () => {
  const run = (strings: TemplateStringsArray | string, ...values: unknown[]) => {
    if (!Array.isArray(strings)) { identifiers.push(strings as string); return { identifier: strings }; }
    const text = (strings as TemplateStringsArray).join('?');
    const query = { text, values };
    const result = (async () => {
      queries.push(query);
      if (/SELECT role FROM tenant_members/.test(text)) return memberships[values[0] as string] ? [{ role: memberships[values[0] as string] }] : [];
      if (/FROM tenant_members/.test(text)) return [{ tenant_id: firmA }];
      if (/INSERT INTO customers/.test(text)) return [{ id: customerId, tenant_id: values[0] }];
      if (/COUNT\(\*\) AS total/.test(text)) return [{ total: '0' }];
      if (/UPDATE customers/.test(text)) return [{ id: customerId }];
      if (/FROM customers/.test(text)) return [{ id: customerId, full_name: 'Eski Ad' }];
      return [{}];
    })();
    return Object.assign(result, { fragment: query });
  };
  return { sql: jest.fn(run), getSql: () => jest.fn(run) };
});

const origin = 'http://127.0.0.1:3001';
const request = (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(origin + url, {
    method,
    headers: { host: '127.0.0.1:3001', origin, ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
const params = { params: Promise.resolve({ id: customerId }) };
const insertedTenant = () => queries.find((q) => /INSERT INTO customers/.test(q.text))?.values[0];

beforeEach(() => {
  queries.length = 0;
  identifiers.length = 0;
  for (const key of Object.keys(memberships)) delete memberships[key];
  memberships[firmA] = 'worker';
  memberships[firmB] = 'owner';
  (auth as jest.Mock).mockResolvedValue({ user: { id: userId, tenantId: firmB, name: 'Test Sahibi' } });
});

describe('a user who is a worker in firm A (older membership) and owner in firm B (session)', () => {
  it('creates the customer in the session firm, never in the first membership', async () => {
    const response = await createCustomer(request('POST', '/api/v1/customers', { fullName: 'Örnek Yapı A.Ş.' }));
    expect(response.status).toBe(201);
    expect(insertedTenant()).toBe(firmB);
    expect(queries.some((q) => /ORDER BY created_at ASC LIMIT 1/.test(q.text))).toBe(false);
    const log = queries.find((q) => /INSERT INTO activity_logs/.test(q.text));
    expect(log?.values.slice(0, 1)).toEqual([firmB]);
  });

  it('lists, reads, updates and deletes only inside the session firm', async () => {
    for (const call of [
      () => listCustomers(request('GET', '/api/v1/customers')),
      () => getCustomer(request('GET', '/api/v1/customers/' + customerId), params),
      () => updateCustomer(request('PUT', '/api/v1/customers/' + customerId, { phone: '0532 000 00 00' }), params),
      () => deleteCustomer(request('DELETE', '/api/v1/customers/' + customerId), params),
    ]) {
      queries.length = 0;
      expect((await call()).status).toBe(200);
      const customerQueries = queries.filter((q) => /customers/.test(q.text));
      expect(customerQueries.length).toBeGreaterThan(0);
      for (const q of customerQueries) {
        expect(q.values).toContain(firmB);
        expect(q.values).not.toContain(firmA);
      }
    }
  });

  it('reads the dashboard summary for the session firm', async () => {
    expect((await dashboardSummary()).status).toBe(200);
    const orderQuery = queries.find((q) => /FROM orders/.test(q.text));
    expect(orderQuery?.values).toEqual([firmB]);
  });
});

describe('role and request checks', () => {
  it('denies every customer operation to a worker without touching customer rows', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: userId, tenantId: firmA } });
    const responses = [
      await listCustomers(request('GET', '/api/v1/customers')),
      await getCustomer(request('GET', '/api/v1/customers/' + customerId), params),
      await createCustomer(request('POST', '/api/v1/customers', { fullName: 'X' })),
      await updateCustomer(request('PUT', '/api/v1/customers/' + customerId, { phone: '1' }), params),
      await deleteCustomer(request('DELETE', '/api/v1/customers/' + customerId), params),
    ];
    expect(responses.map((r) => r.status)).toEqual([403, 403, 403, 403, 403]);
    expect(queries.some((q) => /customers/.test(q.text))).toBe(false);
  });

  it('rejects a user whose membership in the session firm was removed', async () => {
    delete memberships[firmB];
    expect((await listCustomers(request('GET', '/api/v1/customers'))).status).toBe(401);
  });

  it('rejects cross-site writes and invalid bodies', async () => {
    expect((await createCustomer(request('POST', '/api/v1/customers', { fullName: 'X' }, { origin: 'https://evil.example' }))).status).toBe(403);
    expect((await createCustomer(request('POST', '/api/v1/customers', { fullName: '  ' }))).status).toBe(400);
    expect((await createCustomer(request('POST', '/api/v1/customers', { fullName: 'X', email: 'not-an-email' }))).status).toBe(400);
    expect((await updateCustomer(request('PUT', '/api/v1/customers/' + customerId, { tenantId: firmA }), params)).status).toBe(400);
    expect((await getCustomer(request('GET', '/api/v1/customers/not-a-uuid'), { params: Promise.resolve({ id: 'not-a-uuid' }) })).status).toBe(404);
    expect(queries.some((q) => /INSERT INTO customers|UPDATE customers/.test(q.text))).toBe(false);
  });
});

describe('customer updates', () => {
  it('changes only the fields the client sent', async () => {
    const response = await updateCustomer(request('PUT', '/api/v1/customers/' + customerId, { phone: '0532 000 00 00' }), params);
    expect(response.status).toBe(200);
    expect(identifiers).toEqual(['phone']);
  });

  it('rejects an empty update and out-of-range values without writing', async () => {
    expect((await updateCustomer(request('PUT', '/api/v1/customers/' + customerId, {}), params)).status).toBe(400);
    expect((await createCustomer(request('POST', '/api/v1/customers', { fullName: 'X', creditLimit: 5e10 }))).status).toBe(400);
    expect(queries.some((q) => /INSERT INTO customers|UPDATE customers/.test(q.text))).toBe(false);
  });

  it('keeps the stored contact title', async () => {
    await createCustomer(request('POST', '/api/v1/customers', { fullName: 'X', contacts: [{ name: 'Ali', title: 'Satın alma' }] }));
    const insert = queries.find((q) => /INSERT INTO customers/.test(q.text));
    expect(JSON.parse(insert?.values.at(-1) as string)).toEqual([{ name: 'Ali', title: 'Satın alma' }]);
  });
});
