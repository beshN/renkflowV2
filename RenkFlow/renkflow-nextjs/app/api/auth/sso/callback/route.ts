import { NextRequest, NextResponse } from 'next/server';
import { handleOIDCCallback, handleSAMLCallback } from '@/lib/auth/sso';
import { sql } from '@/lib/db';
import crypto from 'node:crypto';

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
    const state = url.searchParams.get('state') || (await request.formData().catch(() => null))?.get('RelayState') as string;
    
    // Parse SAMLResponse from FormData if POST
    let samlResponse = null;
    if (request.method === 'POST') {
        const formData = await request.formData();
        samlResponse = formData.get('SAMLResponse') as string;
    }

    if (!state) {
        return NextResponse.json({ error: 'Missing state parameter' }, { status: 400 });
    }

    // 1. Retrieve state to find provider type
    const stateResult = await sql`
        SELECT s.*, p.type, p.id as provider_id
        FROM sso_states s
        JOIN sso_providers p ON s.provider_id = p.id
        WHERE s.state = ${state}
    `;
    const stateRows = stateResult as any[];
    const stateRecord = stateRows[0];

    if (!stateRecord) {
        return NextResponse.json({ error: 'Invalid or expired state' }, { status: 400 });
    }

    let result;

    if (stateRecord.type === 'saml') {
        if (!samlResponse) {
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

    // 2. Create a temporary login ticket (magic code)
    const ticket = crypto.randomBytes(32).toString('hex');
    
    // Update user with verification token
    await sql`
        UPDATE users 
        SET verification_token = ${ticket} 
        WHERE id = ${result.user.id}
    `;

    // 3. Redirect to a client-side page that performs the actual sign-in
    const redirectUrl = new URL('/auth/sso-verify', request.url);
    redirectUrl.searchParams.set('email', result.user.email);
    redirectUrl.searchParams.set('ticket', ticket);
    
    return NextResponse.redirect(redirectUrl);

  } catch (error: unknown) {
    console.error('SSO Callback Error:', error);
    return NextResponse.json(
      { error: 'Authentication failed. Please try again.' },
      { status: 500 }
    );
  }
}
