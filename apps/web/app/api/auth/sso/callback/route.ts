import { NextRequest, NextResponse } from 'next/server';
import { handleOIDCCallback, handleSAMLCallback } from '@/lib/auth/sso';
import { sql } from '@/lib/db';
import { issueLoginTicket, loginTicketCookieName, ssoFlowCookieName, matchesSsoFlow } from '@/lib/features/auth/login-ticket.server';
import { assertCompanyHostTenant } from '@/lib/features/company/host.server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleCallback(request);
}

export async function POST(request: NextRequest) {
  return handleCallback(request);
}

async function handleCallback(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const form = request.method === 'POST' ? await request.formData().catch(() => null) : null;
    const state = url.searchParams.get('state') || form?.get('RelayState');
    const samlResponse = form?.get('SAMLResponse');
    const secure = request.nextUrl.protocol === 'https:';
    if (typeof state !== 'string' || !matchesSsoFlow(state, request.cookies.get(ssoFlowCookieName(secure))?.value)) {
        return NextResponse.json({ error: 'Invalid or expired login flow' }, { status: 400 });
    }

    // 1. Retrieve state to find provider type
    const stateResult = await sql`
        SELECT s.*, p.type, p.id as provider_id, p.tenant_id
        FROM sso_states s
        JOIN sso_providers p ON s.provider_id = p.id
        WHERE s.state = ${state} AND s.expires_at>now() AND p.enabled=true
    `;
    const stateRows = stateResult as any[];
    const stateRecord = stateRows[0];

    if (!stateRecord) {
        return NextResponse.json({ error: 'Invalid or expired state' }, { status: 400 });
    }
    await assertCompanyHostTenant(stateRecord.tenant_id, request.headers.get('host') || request.nextUrl.host);

    let result;

    if (stateRecord.type === 'saml') {
        if (typeof samlResponse !== 'string' || !samlResponse) {
             return NextResponse.json({ error: 'Missing SAMLResponse' }, { status: 400 });
        }
        result = await handleSAMLCallback(samlResponse, state);
    } else {
        if (!code) {
             return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 });
        }
        result = await handleOIDCCallback(stateRecord.provider_id, stateRecord.callback_url, { code, state });
    }

    if (!result || !result.user) {
        throw new Error('Authentication failed');
    }

    const { ticket, browser } = await issueLoginTicket(sql, {
      userId: result.user.id,
      tenantId: stateRecord.tenant_id,
      host: request.headers.get('host') || request.nextUrl.host,
    });

    // 3. Redirect to a client-side page that performs the actual sign-in
    const redirectUrl = new URL('/auth/sso-verify', request.url);
    // Fragments stay in the browser: tickets must not enter server access logs or Referer URLs.
    redirectUrl.hash = new URLSearchParams({ email: result.user.email, ticket }).toString();
    
    const response = NextResponse.redirect(redirectUrl, 303);
    response.cookies.set(loginTicketCookieName(secure), browser, { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 300 });
    response.cookies.set(ssoFlowCookieName(secure), '', { httpOnly: true, secure, sameSite: secure ? 'none' : 'lax', path: '/', maxAge: 0 });
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    return response;

  } catch (error: unknown) {
    console.error('SSO Callback Error:', error);
    return NextResponse.json(
      { error: 'Authentication failed. Please try again.' },
      { status: 500 }
    );
  }
}
