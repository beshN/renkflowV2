/** @jest-environment node */
import {DisconnectedMobilePush} from '@/lib/features/mobile/push';
import {validateMobileDTO} from '@/lib/features/mobile/contract';
jest.mock('server-only',()=>({}));
jest.mock('@/auth',()=>({auth:jest.fn()}));
it.each(['fcm','apns'] as const)('never reports a disconnected %s provider as delivered',async name=>{
  const provider=new DisconnectedMobilePush(name);expect(provider.connected).toBe(false);
  expect(await provider.send('PRIVATE_PROVIDER_TOKEN',{kind:'assignment',eventId:'event'})).toEqual({sent:false,reason:'disconnected'});
});
it('keeps device tokens and customer identity out of registration responses',()=>{
  expect(()=>validateMobileDTO('PushDeviceStatus',{registered:true,provider:'disconnected'})).not.toThrow();
  expect(()=>validateMobileDTO('PushDeviceStatus',{registered:true,provider:'disconnected',token:'PRIVATE'})).toThrow();
  expect(()=>validateMobileDTO('PushDeviceInput',{deviceId:'broken',enabled:true,token:'PRIVATE'})).toThrow();
});
