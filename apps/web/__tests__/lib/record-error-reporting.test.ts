/** @jest-environment node */
import { ZodError } from 'zod';
import { recordError } from '@/lib/features/records/http';
import { reportServerError } from '@/lib/observability/report-server-error';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';

jest.mock('server-only', () => ({}));
jest.mock('@/lib/observability/report-server-error', () => ({ reportServerError: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/features/work-orders/security', () => ({
  WorkOrderApiError: class extends Error {
    constructor(message: string, public status: number, public code?: string) { super(message); }
  },
}));

beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { jest.restoreAllMocks(); });

it('reports the fallback once with the operation label and preserves the response', async () => {
  const error = new Error('database failed');
  const response = await recordError(error, 'orders');
  expect(reportServerError).toHaveBeenCalledTimes(1);
  expect(reportServerError).toHaveBeenCalledWith('records:orders', error);
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: 'İşlem tamamlanamadı' });
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
});

it.each([
  [new WorkOrderApiError('Forbidden', 403, 'FORBIDDEN'), 403, { error: 'Forbidden', code: 'FORBIDDEN' }],
  [new ZodError([]), 400, { error: 'Geçersiz istek' }],
  [new SyntaxError('Bad JSON'), 400, { error: 'Geçersiz istek' }],
  [new Error('Dosya geçersiz'), 400, { error: 'Dosya geçersiz' }],
  [new Error('STORAGE_BACKEND missing'), 503, { error: 'Dosya eki bu kurulumda kapalı (depolama yapılandırılmamış)' }],
] as const)('preserves existing handled responses without reporting the fallback', async (error, status, body) => {
  const response = await recordError(error, 'orders');
  expect(response.status).toBe(status);
  expect(await response.json()).toEqual(body);
  expect(reportServerError).not.toHaveBeenCalled();
});
