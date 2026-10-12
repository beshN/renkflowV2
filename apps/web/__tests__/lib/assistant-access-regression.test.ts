/** Regression coverage: no unauthorized queries or implied consent. */
jest.mock('server-only', () => ({}));
jest.mock('@/lib/db', () => ({ sql: jest.fn(async () => []) }));
jest.mock('@/lib/db/schema-guard', () => ({ tableExists: jest.fn(async () => false) }));
jest.mock('@/auth', () => ({ auth: jest.fn(async () => ({ user: { id: 'review-user', tenantId: 'review-tenant' } })) }));
jest.mock('@/lib/security/member-access.server', () => ({
  resolveMemberAccess: jest.fn(async () => ({ base: 'office', roleKey: 'custom-orders-only', permissions: { orders: ['view'] }, hidden: ['price', 'cost', 'profit'], deactivated: false })),
}));
jest.mock('@/lib/features/manufacturing/analytics.service', () => ({ productionAnalytics: jest.fn(async () => ({ centers: [], predictions: [] })) }));
jest.mock('@/lib/features/manufacturing/quality.service', () => ({ qualityAnalytics: jest.fn(async () => ({})) }));

import { sql } from '@/lib/db';
import { assertModelAllowed, forgetAiSettings } from '@/lib/ai/gate.server';
import { searchAssistant, assistantSnapshot } from '@/lib/ai/workspace';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';

it('blocks provider calls without a persisted consent even when migration 048 is missing', async () => {
  forgetAiSettings('review-tenant');
  await expect(assertModelAllowed({ tenantId: 'review-tenant', userId: 'review-user' })).rejects.toThrow();
});

it('does not query stock for an office member whose custom role only allows orders', async () => {
  const actor = await requireWorkOrderActor();
  await assistantSnapshot(actor, '/dashboard');
  const queries = (sql as unknown as jest.Mock).mock.calls.map(([parts]) => parts.join(' '));
  expect(queries.filter((q: string) => q.includes('FROM inventory_items'))).toEqual([]);
});

it('denies unauthorized search tools before touching the database', async () => {
  const actor=await requireWorkOrderActor();
  await expect(searchAssistant(actor,'materials','profil')).resolves.toHaveProperty('scope');
  expect(sql).not.toHaveBeenCalled();
});
