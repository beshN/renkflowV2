/** Finishing a mobile installation keeps the web audit and delivery workflow. */
jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/schema-guard', () => ({ tableExists: jest.fn(async () => true) }));
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/security/member-access.server', () => ({ resolveMemberAccess: jest.fn() }));
jest.mock('@/lib/db', () => {
  const tx = jest.fn(async (parts: TemplateStringsArray) => {
    const q = parts.join(' ');
    if (q.includes("to_regclass('public.installations')") || q.includes("to_regclass('public.mobile_receipts')")) return [{ present: true }];
    if (q.includes('SELECT id,status,version,issues FROM installations')) return [{ id: '33333333-3333-4333-8333-333333333333', status: 'in_progress', version: 3, issues: [] }];
    return [];
  });
  return { sql: Object.assign(tx, { begin: async (fn: (tx: unknown) => Promise<unknown>) => fn(tx) }) };
});
jest.mock('@/lib/features/manufacturing/platform.service', () => ({ productionCommand: jest.fn() }));
jest.mock('@/lib/ai/suggestions/kinds/mark-delivered', () => ({ fileDeliveredSuggestion: jest.fn() }));

import { syncCommand } from '@/lib/features/mobile/sync';
import { fileDeliveredSuggestion } from '@/lib/ai/suggestions/kinds/mark-delivered';

it('creates the office delivery approval after completing an installation from mobile', async () => {
  const actor = { userId: '11111111-1111-4111-8111-111111111111', tenantId: '22222222-2222-4222-8222-222222222222', role: 'office' as const, mobileAccess: { roleKey: 'office', production: { view: true, edit: true }, inventory: { view: true, edit: true }, installations: { view: true, edit: true } } };
  await expect(syncCommand(actor, { idempotencyKey: '44444444-4444-4444-8444-444444444444', kind: 'installation', installationId: '33333333-3333-4333-8333-333333333333', data: { action: 'complete', expectedVersion: 3 } })).resolves.toEqual({ accepted: true });
  expect(fileDeliveredSuggestion).toHaveBeenCalled();
});
