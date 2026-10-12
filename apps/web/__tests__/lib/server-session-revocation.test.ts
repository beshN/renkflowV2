jest.mock('server-only', () => ({}));
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/db', () => ({ sql: jest.fn() }));
jest.mock('@/lib/security/member-access.server', () => ({ resolveMemberAccess: jest.fn(), sessionRevoked: jest.fn() }));

import { auth } from '@/auth';
import { resolveMemberAccess, sessionRevoked } from '@/lib/security/member-access.server';
import { getServerUserContext } from '@/lib/features/auth/serverAuth';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';

beforeEach(() => {
  (auth as jest.Mock).mockResolvedValue({ user: { id: 'user', tenantId: 'tenant', email: 'user@example.invalid' }, sessionId: 'session', issuedAt: 100 });
  (resolveMemberAccess as jest.Mock).mockResolvedValue({base:'office',roleKey:'office',deactivated:false});
  (sessionRevoked as jest.Mock).mockResolvedValue(true);
});

it('refuses a revoked session inside server actions even when auth returned an identity hint', async () => {
  await expect(getServerUserContext()).rejects.toMatchObject({statusCode:401});
  expect(sessionRevoked).toHaveBeenCalledWith('user','session',100);
});
it('refuses the same revoked identity in work-order and assistant guards', async () => {
  await expect(requireWorkOrderActor()).rejects.toMatchObject({status:401});
});
it('checks the global cutoff for legacy sessions without a tracked ID', async () => {
  (auth as jest.Mock).mockResolvedValue({user:{id:'user',tenantId:'tenant'},issuedAt:100});
  await expect(getServerUserContext()).rejects.toMatchObject({statusCode:401});
  expect(sessionRevoked).toHaveBeenCalledWith('user',null,100);
});
it('keeps an active session usable', async () => {
  (sessionRevoked as jest.Mock).mockResolvedValue(false);
  await expect(getServerUserContext()).resolves.toMatchObject({userId:'user',tenantId:'tenant',role:'office'});
});
