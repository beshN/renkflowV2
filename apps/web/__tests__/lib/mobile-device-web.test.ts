const mockOwner=jest.fn(),mockRevoke=jest.fn(),mockRevalidate=jest.fn();
jest.mock('@/app/mobile-devices/identity',()=>({deviceOwner:()=>mockOwner()}));
jest.mock('@/lib/features/mobile/sessions',()=>({revokeMobileDevice:(...args:unknown[])=>mockRevoke(...args)}));
jest.mock('next/cache',()=>({revalidatePath:(...args:unknown[])=>mockRevalidate(...args)}));
import {revokeDevice} from '@/app/mobile-devices/actions';
beforeEach(()=>{jest.clearAllMocks();mockOwner.mockResolvedValue({userId:'current-user',tenantId:'current-tenant'});});
test('device action uses authenticated owner and ignores forged ownership fields',async()=>{const f=new FormData();f.set('id','00000000-0000-4000-8000-000000000001');f.set('userId','other');f.set('tenantId','other');await revokeDevice(f);expect(mockRevoke).toHaveBeenCalledWith('current-user','current-tenant',f.get('id'));expect(mockRevalidate).toHaveBeenCalledWith('/mobile-devices');});
test('invalid session identifier never reaches database',async()=>{const f=new FormData();f.set('id','bad-id');await expect(revokeDevice(f)).rejects.toThrow();expect(mockRevoke).not.toHaveBeenCalled();});
test('unauthenticated request cannot revoke',async()=>{mockOwner.mockRejectedValue(new Error('unauthorized'));const f=new FormData();f.set('id','00000000-0000-4000-8000-000000000001');await expect(revokeDevice(f)).rejects.toThrow('unauthorized');expect(mockRevoke).not.toHaveBeenCalled();});
