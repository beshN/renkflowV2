import 'server-only';
import {sql} from '@/lib/db';
import {type FieldActor} from '@/lib/features/field/service';
import {WorkOrderApiError} from '@/lib/features/work-orders/security';
import {validateMobileDTO} from './contract';
export type MobilePushMessage={kind:'assignment'|'mention'|'delay';eventId:string};
export interface MobilePushProvider {
  readonly name:'fcm'|'apns';readonly connected:boolean;
  send(token:string,message:MobilePushMessage):Promise<{sent:boolean;reason?:'disconnected'}>;
}
export class DisconnectedMobilePush implements MobilePushProvider {
  readonly connected=false;
  constructor(public readonly name:'fcm'|'apns'){}
  async send(_token:string,_message:MobilePushMessage) {return {sent:false,reason:'disconnected' as const};}
}
// Real adapters must be configured explicitly; no keys or fake successful deliveries.
export const mobilePushProviders={android:new DisconnectedMobilePush('fcm'),ios:new DisconnectedMobilePush('apns')};
export async function registerMobilePush(a:FieldActor,raw:unknown,platform:string) {
  const d=validateMobileDTO('PushDeviceInput',raw) as {deviceId:string;enabled:boolean;token?:string};
  if(!['android','ios'].includes(platform)) throw new WorkOrderApiError('Cihaz platformu geçersiz.',400);
  if(d.enabled && !d.token) throw new WorkOrderApiError('Sağlayıcı cihaz jetonu gerekli.',400);
  const [schema]=await sql`SELECT to_regclass('public.mobile_push_devices') IS NOT NULL AS present`;
  if(!schema?.present) throw new WorkOrderApiError('Bildirim cihaz kaydı henüz etkin değil.',503);
  await sql`INSERT INTO mobile_push_devices(tenant_id,user_id,device_id,platform,provider_token,enabled) VALUES(${a.tenantId},${a.userId},${d.deviceId},${platform},${d.enabled?d.token!:null},${d.enabled}) ON CONFLICT(tenant_id,user_id,device_id) DO UPDATE SET platform=EXCLUDED.platform,provider_token=EXCLUDED.provider_token,enabled=EXCLUDED.enabled,updated_at=now()`;
  return {registered:true,provider:'disconnected'};
}
