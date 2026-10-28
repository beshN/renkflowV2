/** @jest-environment node */
jest.mock('server-only', () => ({}));
const tables = new Set<string>();
const queries: string[] = [];
const withTransaction = jest.fn();
jest.mock('@/lib/db/schema-guard', () => ({ tableExists: async (name: string) => tables.has(name) }));
jest.mock('@/lib/db', () => ({
  withTransaction: (...args: unknown[]) => withTransaction(...args),
  sql: jest.fn(async (strings: TemplateStringsArray) => {
    const text = strings.join('?');
    queries.push(text);
    if (text.includes('FROM ai_settings')) return [{ mode: 'assist', kvkk_ack_at: new Date(), daily_budget_usd: null, user_daily_calls: 1, detectors: {}, features: {} }];
    if (text.includes('FROM ai_usage')) return [{ spent: '0', mine: 0 }];
    return [];
  }),
}));

import { forgetAiSettings, reserveModelCall } from '@/lib/ai/gate.server';

beforeEach(() => { tables.clear(); queries.length = 0; withTransaction.mockReset(); forgetAiSettings('t1'); });

it('before migration 081 the gate falls back to the old check and takes no reservation', async () => {
  tables.add('ai_settings').add('ai_usage');
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  await expect(reserveModelCall({ tenantId: 't1', userId: 'u1' }, { estimateUsd: 1 })).resolves.toBeNull();
  expect(withTransaction).not.toHaveBeenCalled();
  expect(queries.some((q) => q.includes('ai_call_reservations'))).toBe(false);
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('081'));
  warn.mockRestore();
});

it('with 081 the reservation runs in one locked transaction', async () => {
  tables.add('ai_settings').add('ai_usage').add('ai_call_reservations');
  const tx = jest.fn(async (strings: TemplateStringsArray) => {
    const text = strings.join('?');
    queries.push(text);
    if (text.includes('FROM ai_settings')) return [{ mode: 'assist', kvkk_ack_at: new Date(), daily_budget_usd: null, user_daily_calls: 5, detectors: {}, features: {} }];
    if (text.includes('INSERT INTO ai_call_reservations')) return [{ id: 'r1' }];
    if (text.includes('FROM ai_call_reservations')) return [{ reserved: '0', mine: 0 }];
    return [{ spent: '0', mine: 0 }];
  });
  withTransaction.mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx));
  await expect(reserveModelCall({ tenantId: 't1', userId: 'u1' }, { estimateUsd: 0.2 })).resolves.toEqual({ id: 'r1', tenantId: 't1' });
  expect(queries[0]).toContain('pg_advisory_xact_lock');
  expect(queries.findIndex((q) => q.includes('INSERT INTO ai_call_reservations'))).toBe(queries.length - 1);
});
