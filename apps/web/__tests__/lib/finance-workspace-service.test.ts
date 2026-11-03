/** @jest-environment node */
jest.mock('server-only', () => ({}));
jest.mock('@/lib/db', () => ({ sql: jest.fn() }));
jest.mock('@/lib/db/schema-guard', () => ({ tableExists: jest.fn() }));
jest.mock('@/lib/features/finance/collection-cap.server', () => ({ collectionCap: jest.fn() }));
jest.mock('@/lib/features/work-orders/security', () => ({ WorkOrderApiError: class extends Error {
  constructor(message: string, public status: number) { super(message); }
} }));
import { sql } from '@/lib/db';
import { financeWorkspace } from '@/lib/features/finance/workspace.service';
const actor = { tenantId: 'tenant-a', userId: 'u', role: 'owner' as const };
const employeeId = 'c72c27fa-1903-4332-8ba0-507cc8441f18';
beforeEach(() => jest.mocked(sql).mockReset());
test('unknown or other-tenant employee returns 404 after tenant-scoped lookup', async () => {
  jest.mocked(sql).mockResolvedValue([] as never);
  await expect(financeWorkspace(actor, employeeId)).rejects.toMatchObject({ status: 404 });
  expect(jest.mocked(sql).mock.calls[0]).toEqual([expect.any(Array), 'tenant-a', false, employeeId]);
});
test('unfiltered empty workspace remains valid', async () => {
  jest.mocked(sql).mockResolvedValue([] as never);
  await expect(financeWorkspace(actor)).resolves.toMatchObject({ employees: [] });
});
test('existing employee remains valid', async () => {
  jest.mocked(sql).mockResolvedValue([] as never).mockResolvedValueOnce([{ id: employeeId }] as never);
  await expect(financeWorkspace(actor, employeeId)).resolves.toMatchObject({ employees: [{ id: employeeId }] });
});
