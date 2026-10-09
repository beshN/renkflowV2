import { NextRequest, NextResponse } from 'next/server';
import { GET as fieldGet, POST as fieldPost } from '@/app/api/v1/field/[...path]/route';
import { POST as login } from '@/app/api/v1/auth/login/route';
import { GET as me } from '@/app/api/v1/auth/me/route';
import { fieldActor } from '@/lib/features/field/service';
import { needsUpdate, MIN_APP_VERSION, MOBILE_API_VERSION, validateMobileDTO } from '@/lib/features/mobile/contract';
import { mobileReferences } from '@/lib/features/mobile/references';
import { readFieldJson } from '@/lib/features/field/service';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ path: string[] }> };
function json(data: unknown, status = 200) { return NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store', 'X-RenkFlow-API-Version': MOBILE_API_VERSION } }); }
async function handle(request: NextRequest, context: Context, writing: boolean) {
  if (needsUpdate(request.headers.get('x-renkflow-app-version'))) return json({ success: false, code: 'APP_UPDATE_REQUIRED', error: 'Uygulamayı güncelleyin.', minAppVersion: MIN_APP_VERSION }, 426);
  if (!['android', 'ios'].includes(request.headers.get('x-renkflow-platform') || '')) return json({ success: false, error: 'Mobil platform başlığı gerekli.' }, 400);
  try {
    const { path } = await context.params;
    if (writing) {
      const input = path.join('/') === 'auth/login' ? 'LoginInput' : path[0] === 'commands' ? 'CommandInput' : path[0] === 'files' ? 'PhotoInput' : path[2] === 'comments' ? 'CommentInput' : path[2] === 'checklist' ? 'ChecklistInput' : path[2] === 'transition' ? 'TransitionInput' : null;
      if (input) {
        const raw = await readFieldJson(request, input === 'PhotoInput' ? 2_900_000 : 64_000);
        try { validateMobileDTO(input, raw); }
        catch { return json({ success: false, error: 'Mobil istek alanları geçersiz.' }, 400); }
        request = new NextRequest(request.url, { method: 'POST', headers: request.headers, body: JSON.stringify(raw) });
      }
    }
    let response: Response;
    let schema: Parameters<typeof validateMobileDTO>[0];
    if (path.join('/') === 'auth/login' && writing) {
      const body = await readFieldJson(request);
      response = await login(new NextRequest(request.url, { method: 'POST', headers: request.headers, body: JSON.stringify(body) }));
      if (!response.ok) return response;
      const result = await response.json();
      // Login itself proves password ownership; the mobile guard then proves current membership/access.
      const headers = new Headers(request.headers); headers.set('authorization', `Bearer ${result.data.accessToken}`);
      await fieldActor(new NextRequest(request.url, { headers }));
      return json({ success: true, data: validateMobileDTO('Login', { user: result.data.user, accessToken: result.data.accessToken, expiresIn: result.data.expiresIn }) });
    }
    if (path.join('/') === 'references' && !writing) return json({ success: true, data: validateMobileDTO('References', await mobileReferences(await fieldActor(request))) });
    if (path.join('/') === 'auth/me' && !writing) { await fieldActor(request); response = await me(request); schema = 'User'; }
    else {
      response = await (writing ? fieldPost : fieldGet)(request, context);
      schema = writing ? (path[0] === 'files' ? 'Photo' : 'Accepted') : path[0] === 'snapshot' ? 'Snapshot' : path[0] === 'scan' ? 'Scan' : 'Job';
    }
    if (!response.ok) return response;
    const body = await response.json();
    return json({ success: true, data: validateMobileDTO(schema, schema === 'Photo' ? { url: body.data.url } : body.data) });
  } catch (error) {
    if (error instanceof WorkOrderApiError) return json({ success: false, error: error.message }, error.status);
    // A contract mismatch must fail closed; don't expose validation payloads or private fields.
    console.error('[mobile-contract] response rejected', error instanceof Error ? error.name : 'unknown');
    return json({ success: false, error: 'Mobil işlem doğrulanamadı. Yeniden deneyin.' }, 500);
  }
}
export function GET(request: NextRequest, context: Context) { return handle(request, context, false); }
export function POST(request: NextRequest, context: Context) { return handle(request, context, true); }
