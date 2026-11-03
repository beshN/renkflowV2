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
  jest.mocked(sql).mockResolvedValueOnce([] as never).mockImplementation(() => {
    throw new Error('Unrelated finance query must not run for a missing employee');
  });
  await expect(financeWorkspace(actor, employeeId)).rejects.toMatchObject({ status: 404 });
  expect(sql).toHaveBeenCalledTimes(1);
  expect(jest.mocked(sql).mock.calls[0]).toEqual([expect.any(Array), 'tenant-a', false, employeeId]);
});
test('unfiltered empty workspace remains valid', async () => {
  jest.mocked(sql).mockResolvedValue([] as never);
  const result = financeWorkspace(actor);
  expect(sql).toHaveBeenCalledTimes(4);
  await expect(result).resolves.toMatchObject({ employees: [] });
});
test('other queries wait for employee lookup, then preserve the full workspace result', async () => {
  let resolveEmployee!: (rows: Array<{ id: string }>) => void;
  const employeeQuery = new Promise<Array<{ id: string }>>((resolve) => { resolveEmployee = resolve; });
  const employees = [{ id: employeeId }];
  const entries = [{ id: 'entry' }], payments = [{ id: 'payment' }], orders = [{ id: 'order' }];
  jest.mocked(sql)
    .mockReturnValueOnce(employeeQuery as never)
    .mockResolvedValueOnce(entries as never)
    .mockResolvedValueOnce(payments as never)
    .mockResolvedValueOnce(orders as never);
  const result = financeWorkspace(actor, employeeId);
  expect(sql).toHaveBeenCalledTimes(1);
  resolveEmployee(employees);
  await expect(result).resolves.toEqual({ actor, employees, entries, payments, orders });
  expect(sql).toHaveBeenCalledTimes(4);
});
