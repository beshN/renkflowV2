/** @jest-environment node */
jest.mock('server-only', () => ({}));

import { collectTenantUsage, sumFileSources } from '@/lib/features/account/usage.server';

type Handler = (text: string, values: unknown[]) => unknown[] | Error;

function fakeDb(handler: Handler) {
  const seen: Array<{ text: string; values: unknown[] }> = [];
  const db = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join('?').replace(/\s+/g, ' ').trim();
    seen.push({ text, values });
    const out = handler(text, values);
    return out instanceof Error ? Promise.reject(out) : Promise.resolve(out as Array<Record<string, unknown>>);
  };
  return { db, seen };
}

const missing = () => Object.assign(new Error('relation does not exist'), { code: '42P01' });

beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

it('aggregates every metric for the firm only', async () => {
  const { db, seen } = fakeDb((text) => {
    if (text.startsWith('SELECT name, created_at FROM tenants')) return [{ name: 'Acme', created_at: '2026-03-01T09:00:00Z' }];
    if (text.includes('FROM tenant_members')) return [{ n: 4 }];
    if (text.includes('FROM orders')) return [{ n: 12 }];
    if (text.includes('FROM ai_usage')) return [{ month_spend: '3.25', today_spend: '0.5', calls: 40 }];
    if (text.includes('FROM office_files')) return [{ count: 2, bytes: '1000' }];
    if (text.includes('FROM record_attachments')) return [{ count: 3, bytes: '500' }];
    if (text.includes('FROM order_documents')) return [{ count: 0, bytes: '0' }];
    if (text.includes('FROM production_files')) return [{ count: 1, bytes: '24' }];
    if (text.includes('FROM knowledge_revisions')) return [{ count: 1, bytes: '76' }];
    return [];
  });
  const usage = await collectTenantUsage(db, 't1', { dailyBudgetUsd: 2 });
  expect(usage).toEqual({
    plan: { key: 'pilot', label: 'Pilot' },
    firmName: 'Acme',
    firmCreatedAt: '2026-03-01T09:00:00.000Z',
    activeMembers: 4,
    ordersThisMonth: 12,
    ai: { monthSpendUsd: 3.25, todaySpendUsd: 0.5, monthCalls: 40, dailyBudgetUsd: 2 },
    files: expect.objectContaining({ count: 7, bytes: 1600, partial: false }),
  });
  // Every statement is bound to the firm, and members exclude deactivated ones.
  for (const s of seen) expect(s.values).toContain('t1');
  expect(seen.find((s) => s.text.includes('FROM tenant_members'))!.text).toContain("deactivated_at') IS NULL");
  expect(seen.find((s) => s.text.includes('FROM orders'))!.text).toContain("date_trunc('month'");
});

it('shows a failing metric as null and keeps the others', async () => {
  const { db } = fakeDb((text) => {
    if (text.includes('FROM ai_usage') || text.includes('FROM knowledge_revisions') || text.includes('FROM orders')) return missing();
    if (text.includes('FROM tenant_members')) return [{ n: 2 }];
    if (text.includes('FROM office_files')) return [{ count: 1, bytes: '10' }];
    return [{ count: 0, bytes: 0 }];
  });
  const usage = await collectTenantUsage(db, 't1', { dailyBudgetUsd: null });
  expect(usage.ordersThisMonth).toBeNull();
  expect(usage.ai).toEqual({ monthSpendUsd: null, todaySpendUsd: null, monthCalls: null, dailyBudgetUsd: null });
  expect(usage.activeMembers).toBe(2);
  expect(usage.files).toMatchObject({ count: 1, bytes: 10, partial: true });
  expect(usage.firmName).toBeNull();
});

it('reports no file total when no file table could be read', async () => {
  const { db } = fakeDb(() => missing());
  const usage = await collectTenantUsage(db, 't1', { dailyBudgetUsd: null });
  expect(usage.files).toEqual({ count: null, bytes: null, partial: true, sources: [] });
  expect(usage.activeMembers).toBeNull();
  expect(usage.firmCreatedAt).toBeNull();
});

it('sums file sources', () => {
  expect(sumFileSources([])).toEqual({ count: null, bytes: null, partial: false, sources: [] });
  expect(sumFileSources([{ source: 'a', count: 1, bytes: 5 }, null])).toMatchObject({ count: 1, bytes: 5, partial: true });
});
