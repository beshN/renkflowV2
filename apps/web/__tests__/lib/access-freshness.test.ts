jest.mock('server-only', () => ({}));
let member: Record<string, unknown> | null;
jest.mock('@/lib/db', () => ({ sql: jest.fn(async (parts: TemplateStringsArray) => {
  const query=parts.join(' ');
  if(query.includes('information_schema.columns')) return [{ok:true}];
  if(query.includes('FROM tenant_members m')) return member ? [member] : [];
  return [];
}) }));

import { accessDecision, forgetMemberAccess, forgetSessions, narrowedHiddenFields, resolveMemberAccess } from '@/lib/security/member-access.server';
const user='fresh-user',tenant='fresh-tenant';
beforeEach(() => {
  forgetMemberAccess(user,tenant);forgetSessions(user);
  member={role:'office',access_role:'office',deactivated_at:null};
});

it('checks a narrowed role immediately even when an identity hint is cached', async () => {
  await resolveMemberAccess(user,tenant,{cached:true});
  member!.access_role='sales';
  await expect(accessDecision(user,tenant,'/api/v1/production','POST')).resolves.toMatchObject({status:403});
});

it('never forwards old hidden-field permissions after a role change', async () => {
  await resolveMemberAccess(user,tenant,{cached:true});
  member!.access_role='sales';
  await expect(narrowedHiddenFields(user,tenant)).resolves.toEqual(['cost','profit']);
});

it('refuses a deactivated or removed member without waiting for cache expiry', async () => {
  await resolveMemberAccess(user,tenant,{cached:true});
  member!.deactivated_at='2026-10-12T00:00:00Z';
  await expect(accessDecision(user,tenant,'/api/v1/orders','GET')).resolves.toMatchObject({status:401});
  member=null;
  await expect(accessDecision(user,tenant,'/api/v1/orders','GET')).resolves.toMatchObject({status:401});
});
