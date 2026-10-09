/** @jest-environment node */
import { mobileInstallations, mobileNotificationPreferences, mobileNotifications } from '@/lib/features/mobile/field-context';
import { validateMobileDTO } from '@/lib/features/mobile/contract';
import { mobileAccess } from '@/lib/features/mobile/access';
import { sql } from '@/lib/db';
jest.mock('server-only', () => ({}));
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/db', () => ({ sql: jest.fn() }));
const actor = { userId: 'u', tenantId: 't', role: 'worker' as const, mobileAccess: mobileAccess('worker','operator') };
beforeEach(() => jest.mocked(sql).mockReset());
it('returns an explicit unavailable installation module before night-2 schema', async () => {
  jest.mocked(sql).mockResolvedValueOnce([{ present: false }] as never);
  expect(validateMobileDTO('Installations',await mobileInstallations(actor))).toEqual({available:false,installations:[]});
});
it('projects technical installations without any office/customer/sign-off fields', async () => {
  jest.mocked(sql).mockResolvedValueOnce([{present:true}] as never).mockResolvedValueOnce([{id:'i',installation_number:'MNT-1',scheduled_date:'2026-10-09',start_time:'09:00',duration_minutes:240,status:'planned',version:1,product_name:'Pergola',done:1,total:3,address:'PRIVATE',signed_name:'PRIVATE',customer_phone:'PRIVATE',total_amount:999,signoff_token_hash:'PRIVATE'}] as never);
  const result=await mobileInstallations(actor); expect(()=>validateMobileDTO('Installations',result)).not.toThrow(); expect(JSON.stringify(result)).not.toContain('PRIVATE');
  expect(jest.mocked(sql).mock.calls[1]).toContain('t'); expect(jest.mocked(sql).mock.calls[1]).toContain('u');
});
it('rejects warehouse installation access before querying any rows', async () => {
  await expect(mobileInstallations({...actor,role:'office',mobileAccess:mobileAccess('office','warehouse')})).rejects.toMatchObject({status:403}); expect(sql).not.toHaveBeenCalled();
});
it('returns notification metadata and disconnected provider instead of arbitrary commercial message bodies', async () => {
  jest.mocked(sql).mockResolvedValueOnce([{id:'n',type:'work_order:assigned',read:false,created_at:new Date('2026-10-09'),title:'PRIVATE price',message:'PRIVATE phone',data:{cost:999}}] as never);
  const result=await mobileNotifications(actor); expect(()=>validateMobileDTO('Notifications',result)).not.toThrow(); expect(JSON.stringify(result)).not.toContain('PRIVATE'); expect(result.provider).toBe('disconnected');
});
it('reads shared web preference flags without exposing the user or other notification groups', async () => {
  jest.mocked(sql).mockResolvedValueOnce([{in_app:{'work_order:assigned':false,mention:true,'deadline:approaching':false,privateKey:'PRIVATE'}}] as never);
  expect(await mobileNotificationPreferences(actor)).toEqual({assignment:false,mention:true,delay:false});
});
it.each(['Installation','Notification','NotificationPreferences'])('rejects unrecognized private additions to %s', schema => {
  expect(()=>validateMobileDTO(schema as 'Installation', {customerPhone:'PRIVATE',cost:999})).toThrow();
});
