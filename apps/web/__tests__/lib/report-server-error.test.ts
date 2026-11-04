/** @jest-environment node */
import * as Sentry from '@sentry/nextjs';
import { auth } from '@/auth';
import { reportServerError } from '@/lib/observability/report-server-error';

jest.mock('server-only', () => ({}));
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@sentry/nextjs', () => ({ withScope: jest.fn(), captureException: jest.fn() }));

const mockAuth = auth as jest.Mock;
const mockScope = {
  setTag: jest.fn(),
  addEventProcessor: jest.fn(),
};
const env = process.env;

beforeEach(() => {
  process.env = { ...env, SENTRY_DSN: 'https://key@o1.ingest.sentry.io/1', NEXT_PUBLIC_SENTRY_DSN: '' };
  mockAuth.mockResolvedValue({ user: { tenantId: 'tenant-1', name: 'Private Name', email: 'private@example.test' } });
  (Sentry.withScope as jest.Mock).mockImplementation((callback) => callback(mockScope));
});
afterEach(() => { process.env = env; jest.resetAllMocks(); });

it('does nothing without either DSN, including whitespace', async () => {
  process.env.SENTRY_DSN = '   ';
  await expect(reportServerError('records:orders', new Error('private'))).resolves.toBeUndefined();
  expect(mockAuth).not.toHaveBeenCalled();
  expect(Sentry.withScope).not.toHaveBeenCalled();
  expect(Sentry.captureException).not.toHaveBeenCalled();
});

it('sends the source label and authenticated tenant as tags', async () => {
  await reportServerError('records:orders', new Error('private'));
  expect(mockScope.setTag).toHaveBeenCalledWith('label', 'records:orders');
  expect(mockScope.setTag).toHaveBeenCalledWith('tenant_id', 'tenant-1');
  expect(Sentry.captureException).toHaveBeenCalledTimes(1);
});

it.each([
  new Error('Private Name private@example.test +90 555 123 45 67', { cause: { body: 'private request' } }),
  { email: 'private@example.test', name: 'Private Name', phone: '+90 555 123 45 67', body: 'private request' },
  'Private Name private@example.test +90 555 123 45 67',
])('never forwards raw errors or SDK-enriched personal data', async (error) => {
  await reportServerError('records:orders', error);
  const captured = (Sentry.captureException as jest.Mock).mock.calls[0][0] as Error;
  expect(captured.message).toBe('Caught server error');
  expect(captured).not.toBe(error);
  expect(captured.cause).toBeUndefined();
  const processor = mockScope.addEventProcessor.mock.calls[0][0];
  const event = processor({
    event_id: 'event-1', exception: { values: [{ value: captured.message }] },
    message: 'private@example.test', extra: { body: 'private request' },
    request: { data: 'private request' }, user: { name: 'Private Name' },
    breadcrumbs: [{ message: '+90 555 123 45 67' }], contexts: { private: {} },
    tags: { email: 'private@example.test' },
  });
  expect(event.tags).toEqual({ label: 'records:orders', tenant_id: 'tenant-1' });
  expect(event).not.toHaveProperty('extra');
  expect(event).not.toHaveProperty('message');
  expect(JSON.stringify(event)).not.toMatch(/private|Private|555/);
});

it('uses the public DSN and unknown tenant for public routes', async () => {
  process.env.SENTRY_DSN = '';
  process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://key@o1.ingest.sentry.io/1';
  mockAuth.mockResolvedValue(null);
  await reportServerError('public:contact', undefined);
  expect(mockScope.setTag).toHaveBeenCalledWith('tenant_id', 'unknown');
});

it('still reports when session lookup fails', async () => {
  mockAuth.mockRejectedValue(new Error('session unavailable'));
  await expect(reportServerError('orders', null)).resolves.toBeUndefined();
  expect(Sentry.captureException).toHaveBeenCalled();
  expect(mockScope.setTag).toHaveBeenCalledWith('tenant_id', 'unknown');
});

it('never lets an SDK failure change the API response', async () => {
  (Sentry.captureException as jest.Mock).mockImplementation(() => { throw new Error('SDK failure'); });
  await expect(reportServerError('orders', null)).resolves.toBeUndefined();
});
