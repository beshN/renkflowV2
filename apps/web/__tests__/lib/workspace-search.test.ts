/** @jest-environment node */
import { searchWorkspace } from '@/lib/features/search/workspace-search';
import { sql } from '@/lib/db';

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db', () => ({ sql: jest.fn() }));

const tenantId = '22222222-2222-4222-8222-222222222222';
type Node = { strings: TemplateStringsArray; values: unknown[] };
const queries: Array<{ text: string; values: unknown[] }> = [];

/** Flattens nested postgres.js fragments into one text + value list, so tests see the real SQL. */
function flatten(node: Node): { text: string; values: unknown[] } {
  let text = '';
  const values: unknown[] = [];
  node.strings.forEach((part, i) => {
    text += part;
    if (i >= node.values.length) return;
    const value = node.values[i] as Node | unknown;
    if (value && typeof value === 'object' && 'strings' in (value as object)) {
      const inner = flatten(value as Node);
      text += inner.text;
      values.push(...inner.values);
    } else {
      text += '?';
      values.push(value);
    }
  });
  return { text, values };
}

beforeEach(() => {
  queries.length = 0;
  (sql as unknown as jest.Mock).mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => {
    const node: Node & PromiseLike<unknown[]> = {
      strings,
      values,
      then(resolve, reject) {
        const flat = flatten(node);
        queries.push(flat);
        const rows = /FROM orders/.test(flat.text) ? [{ id: 'o1', order_number: 'RF-1', product_name: 'Pergola', customer_name: 'Örnek', status: 'pending' }]
          : /FROM customers/.test(flat.text) ? [{ id: 'c1', full_name: 'Işık İnşaat', company_name: null, phone: '0532', email: null }]
          : /FROM quotations/.test(flat.text) ? [{ id: 'q1', quotation_number: 'TEK-1', customer_name: 'Örnek', status: 'sent' }]
          : /FROM inventory_items/.test(flat.text) ? [{ id: 'i1', name: 'Profil 40x40', sku: 'P-40', stock_uom: 'm', on_hand: '12.5' }]
          : [];
        return Promise.resolve(rows).then(resolve, reject);
      },
    };
    return node;
  });
});

it('searches every screen an owner can open, folding Turkish letters on both sides', async () => {
  const result = await searchWorkspace({ tenantId, userId: 'u', role: 'owner' }, '  IŞIK ');
  expect(result.orders?.[0]).toMatchObject({ title: 'RF-1', meta: 'Örnek', href: '/orders/o1' });
  expect(result.customers?.[0]).toMatchObject({ title: 'Işık İnşaat', href: '/crm/c1' });
  expect(result.quotations?.[0]).toMatchObject({ title: 'TEK-1', href: '/quotations/q1' });
  expect(result.stock?.[0]).toMatchObject({ title: 'Profil 40x40', href: '/inventory/i1' });
  expect(result.ordersLimitedToAssigned).toBe(false);
  for (const q of queries) {
    expect(q.values).toContain('%işik%');
    expect(q.values).toContain(tenantId);
    expect(q.text).toMatch(/translate\(regexp_replace\(btrim\(coalesce\(/);
  }
});

it('takes the user\'s % and _ literally', async () => {
  await searchWorkspace({ tenantId, userId: 'u', role: 'owner' }, '50%_a');
  expect(queries[0].values).toContain('%50\\%\\_a%');
});

it('keeps global search closed to workers; their technical search belongs to the worker screen', async () => {
  const result=await searchWorkspace({tenantId,userId:'worker-1',role:'worker'},'RF');
  expect(result.orders).toBeNull();expect(result.stock).toBeNull();expect(result.customers).toBeNull();expect(result.quotations).toBeNull();
  expect(queries).toHaveLength(0);
});

it('keeps quotations closed to the member role, like the quotations screen', async () => {
  const result = await searchWorkspace({ tenantId, userId: 'u', role: 'member' }, 'TEK');
  expect(result.quotations).toBeNull();
  expect(result.customers).not.toBeNull();
});

it('does not query for fewer than two characters', async () => {
  const result = await searchWorkspace({ tenantId, userId: 'u', role: 'owner' }, ' R ');
  expect(queries).toHaveLength(0);
  expect(result.orders).toEqual([]);
});
