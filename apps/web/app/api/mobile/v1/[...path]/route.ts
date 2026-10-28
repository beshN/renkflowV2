import { NextRequest, NextResponse } from 'next/server';
import { GET as fieldGet, POST as fieldPost } from '@/app/api/v1/field/[...path]/route';
import {mobileLogin,mobileRefresh,requireMobileSession,mobileDevices,revokeMobileDevice} from '@/lib/features/mobile/sessions';
import { GET as me } from '@/app/api/v1/auth/me/route';
import { fieldActor } from '@/lib/features/field/service';
import { needsUpdate, MIN_APP_VERSION, MOBILE_API_VERSION, validateMobileDTO } from '@/lib/features/mobile/contract';
import { uploadChunk, uploadStatus, installationPhoto } from '@/lib/features/mobile/uploads';
import { syncCommand, MobileConflict } from '@/lib/features/mobile/sync';
import { mobileInstallations, mobileInstallationDetails, mobileNotifications, mobileNotificationPreferences } from '@/lib/features/mobile/field-context';
import { registerMobilePush } from '@/lib/features/mobile/push';
import { mobileReferences } from '@/lib/features/mobile/references';
import { readFieldJson } from '@/lib/features/field/service';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
type Context = { params: Promise<{ path: string[] }> };
function json(data: unknown, status = 200) { return NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store', 'X-RenkFlow-API-Version': MOBILE_API_VERSION } }); }
async function handle(request: NextRequest, context: Context, writing: boolean) {
  if (needsUpdate(request.headers.get('x-renkflow-app-version'))) return json({ success: false, code: 'APP_UPDATE_REQUIRED', error: 'Uygulamayı güncelleyin.', minAppVersion: MIN_APP_VERSION }, 426);
  if (!['android', 'ios'].includes(request.headers.get('x-renkflow-platform') || '')) return json({ success: false, error: 'Mobil platform başlığı gerekli.' }, 400);
  try {
    const { path } = await context.params;
    if (writing) {
      const input = path.join('/')==='auth/refresh' ? 'RefreshInput' : path.join('/')==='auth/devices/revoke' ? 'DeviceRevokeInput' : path.join('/') === 'uploads' ? 'UploadInput' : path.join('/') === 'sync' ? 'SyncInput' : path.join('/')==='notifications/device' ? 'PushDeviceInput' : path.join('/') === 'notifications/preferences' ? 'NotificationPreferences' : path.join('/') === 'auth/login' ? 'LoginInput' : path[0] === 'commands' ? 'CommandInput' : path[0] === 'files' ? 'PhotoInput' : path[2] === 'comments' ? 'CommentInput' : path[2] === 'checklist' ? 'ChecklistInput' : path[2] === 'transition' ? 'TransitionInput' : null;
      if (input) {
        const raw = await readFieldJson(request, input === 'PhotoInput' ? 2_900_000 : input === 'UploadInput' ? 400_000 : 64_000);
        try { validateMobileDTO(input, raw); }
        catch { return json({ success: false, error: 'Mobil istek alanları geçersiz.' }, 400); }
        request = new NextRequest(request.url, { method: 'POST', headers: request.headers, body: JSON.stringify(raw) });
      }
    }
    let response: Response;
    let schema: Parameters<typeof validateMobileDTO>[0];
    if (path.join('/') === 'auth/login' && writing) {
      const body = await readFieldJson(request);
      return json({success:true,data:validateMobileDTO('Login',await mobileLogin(request,body,request.headers.get('x-renkflow-platform')!))});
    }
    if(path.join('/')==='auth/refresh' && writing) return json({success:true,data:validateMobileDTO('Login',await mobileRefresh(await readFieldJson(request)))});
    const identity=await requireMobileSession(request);
    if(path.join('/')==='auth/devices' && !writing) {await fieldActor(request,'any');return json({success:true,data:validateMobileDTO('Devices',await mobileDevices(identity.sub!,identity.tenantId))});}
    if((path.join('/')==='auth/logout'||path.join('/')==='auth/devices/revoke') && writing) {
      await fieldActor(request,'any');const id=path.join('/')==='auth/logout' ? identity.sid : (await readFieldJson(request) as {id:string}).id;
      return json({success:true,data:validateMobileDTO('Accepted',await revokeMobileDevice(identity.sub!,identity.tenantId,id))});
    }
    if(path.join('/')==='snapshot' && !writing) {
      const actor=await fieldActor(request,'any');
      if(!actor.mobileAccess?.production.view) return json({success:true,data:validateMobileDTO('Snapshot',{workOrders:[],operations:[],cutPlans:[],generatedAt:new Date().toISOString(),truncated:false,permissions:{transition:false,close:false,checklist:false,comment:false}})});
    }
    if(path[0]==='installation-files' && path.length===2 && !writing) {
      const file=await installationPhoto(await fieldActor(request,'installations'),path[1]);
      return new NextResponse(file.body,{headers:{'Content-Type':'image/jpeg','Content-Length':String(file.size),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
    }
    if (path[0]==='uploads' && path.length===2 && !writing) return json({success:true,data:validateMobileDTO('UploadStatus',await uploadStatus(await fieldActor(request,'any'),path[1]))});
    if (path.join('/')==='uploads' && writing) return json({success:true,data:validateMobileDTO('UploadStatus',await uploadChunk(await fieldActor(request,'any'),await readFieldJson(request,400_000)))});
    if (path.join('/') === 'sync' && writing) return json({ success:true, data:validateMobileDTO('Accepted',await syncCommand(await fieldActor(request,'any'),await readFieldJson(request))) });
    if (path.join('/') === 'installations' && !writing) return json({ success: true, data: validateMobileDTO('Installations', await mobileInstallations(await fieldActor(request,'installations'))) });
    if(path[0]==='installations' && path.length===2 && !writing) return json({success:true,data:validateMobileDTO('InstallationDetails',await mobileInstallationDetails(await fieldActor(request,'installations'),path[1]))});
    if (path.join('/') === 'notifications' && !writing) return json({ success: true, data: validateMobileDTO('Notifications', await mobileNotifications(await fieldActor(request,'any'))) });
    if(path.join('/')==='notifications/device' && writing) return json({success:true,data:validateMobileDTO('PushDeviceStatus',await registerMobilePush(await fieldActor(request,'any'),await readFieldJson(request),request.headers.get('x-renkflow-platform')!))});
    if (path.join('/') === 'notifications/preferences') {
      const actor = await fieldActor(request,'any');
      const input = writing ? await readFieldJson(request) as { assignment: boolean; mention: boolean; delay: boolean } : undefined;
      return json({ success: true, data: validateMobileDTO('NotificationPreferences', await mobileNotificationPreferences(actor, input)) });
    }
    if (path.join('/') === 'references' && !writing) return json({ success: true, data: validateMobileDTO('References', await mobileReferences(await fieldActor(request,'any'))) });
    if (path.join('/') === 'auth/me' && !writing) { await fieldActor(request,'any'); response = await me(request); schema = 'User'; }
    else {
      response = await (writing ? fieldPost : fieldGet)(request, context);
      schema = writing ? (path[0] === 'files' ? 'Photo' : 'Accepted') : path[0] === 'snapshot' ? 'Snapshot' : path[0] === 'scan' ? 'Scan' : 'Job';
    }
    if (!response.ok) return response;
    const body = await response.json();
    return json({ success: true, data: validateMobileDTO(schema, schema === 'Photo' ? { url: body.data.url } : body.data) });
  } catch (error) {
    if (error instanceof MobileConflict) return json({success:false,error:error.message,code:'SYNC_CONFLICT',canRetry:error.canRetry},409);
    if (error instanceof WorkOrderApiError) return json({ success: false, error: error.message, ...(error.code ? { code: error.code } : {}) }, error.status);
    // A contract mismatch must fail closed; don't expose validation payloads or private fields.
    console.error('[mobile-contract] response rejected', error instanceof Error ? error.name : 'unknown');
    return json({ success: false, error: 'Mobil işlem doğrulanamadı. Yeniden deneyin.' }, 500);
  }
}
export function GET(request: NextRequest, context: Context) { return handle(request, context, false); }
export function POST(request: NextRequest, context: Context) { return handle(request, context, true); }
