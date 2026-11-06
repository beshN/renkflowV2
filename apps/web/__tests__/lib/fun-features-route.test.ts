/** @jest-environment node */
import { GET, POST } from '@/app/api/tenant/fun-features/route';
import { auth } from '@/auth';
import { requireTenantContext } from '@/lib/auth/serverAuth';
import { readFunFeatures, saveFunFeatures } from '@/lib/features/settings/fun-features.server';
jest.mock('server-only', () => ({}));
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/auth/serverAuth', () => ({ ...jest.requireActual('@/lib/auth/serverAuth'), requireTenantContext: jest.fn() }));
jest.mock('@/lib/features/settings/fun-features.server', () => ({ readFunFeatures: jest.fn(), saveFunFeatures: jest.fn() }));
const context = { tenantId: 'session-tenant', userId: 'session-user', role: 'owner' };
const post = (body: unknown) => POST(new Request('https://example.test/api/tenant/fun-features', { method: 'POST', body: JSON.stringify(body) }));
beforeEach(() => {
  (auth as jest.Mock).mockResolvedValue({ user: context });
  (requireTenantContext as jest.Mock).mockResolvedValue(context);
  (readFunFeatures as jest.Mock).mockResolvedValue({ enabled: false, canEdit: true });
  (saveFunFeatures as jest.Mock).mockResolvedValue({ enabled: false, canEdit: true });
});
it('reads and writes only the authenticated context; response is never shared-cacheable', async () => {
  const result = await GET();
  expect(result.headers.get('cache-control')).toBe('private, no-store');
  expect(readFunFeatures).toHaveBeenCalledWith(context);
  expect((await post({ enabled: false })).status).toBe(200);
  expect(saveFunFeatures).toHaveBeenCalledWith(context, false);
});
it('refuses client tenant selection and non-boolean input', async () => {
  for (const body of [{ enabled: false, tenantId: 'other' }, { enabled: 'false' }, {}]) expect((await post(body)).status).toBe(400);
  expect(saveFunFeatures).not.toHaveBeenCalled();
});
it('keeps anonymous public pages on the original behaviour without a tenant lookup', async () => {
  (auth as jest.Mock).mockResolvedValue(null);
  expect(await (await GET()).json()).toEqual({ enabled: true, canEdit: false });
  expect(readFunFeatures).not.toHaveBeenCalled();
});
