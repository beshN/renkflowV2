jest.mock('server-only', () => ({}));
jest.mock('@/lib/db', () => ({ sql: jest.fn() }));
jest.mock('@/lib/features/field/common.server', () => ({ requireCap: jest.fn() }));
jest.mock('@/lib/features/work-orders/security', () => ({ WorkOrderApiError: class extends Error { constructor(message: string, public status: number) { super(message); } } }));
jest.mock('@/lib/features/manufacturing/platform.service', () => ({ productionCommand: jest.fn() }));
import { sql } from '@/lib/db';
import { requireCap } from '@/lib/features/field/common.server';
import { productionCommand } from '@/lib/features/manufacturing/platform.service';
import { kioskCommand, requireKioskAccess } from '@/lib/features/kiosk/service.server';
const actor = { tenantId: 'tenant', userId: 'worker', role: 'worker' as const };
const input = { commandId: '00000000-0000-4000-8000-000000000001', operationId: '00000000-0000-4000-8000-000000000002', action: 'start', version: 1 };
beforeEach(() => jest.resetAllMocks());
it('rejects narrowing that removes production edit', async () => {
  jest.mocked(requireCap).mockRejectedValue(new Error('denied'));
  await expect(requireKioskAccess(actor)).rejects.toThrow('denied');
});
it('does not dispatch an unassigned command', async () => {
  jest.mocked(sql).mockResolvedValue([] as never);
  await expect(kioskCommand(actor,input)).rejects.toThrow('atanmadı');
  expect(productionCommand).not.toHaveBeenCalled();
});
it('narrows managers to existing transactional worker assignment checks', async () => {
  jest.mocked(sql).mockResolvedValue([{id: input.operationId}] as never);
  await kioskCommand({...actor,role:'owner'},input);
  expect(productionCommand).toHaveBeenCalledWith({...actor,role:'worker'},expect.objectContaining({action:'operation',commandId:input.commandId}));
});
