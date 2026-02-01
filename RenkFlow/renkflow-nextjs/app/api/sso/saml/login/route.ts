import { NextResponse } from 'next/server';
import { initiateSAMLLogin } from '@/lib/auth/sso';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const providerId = searchParams.get('providerId');
  const callbackUrl = searchParams.get('callbackUrl') || `${new URL(request.url).origin}/dashboard`;

  if (!providerId) {
    return NextResponse.json({ error: 'providerId is required' }, { status: 400 });
  }

  const { redirectUrl } = await initiateSAMLLogin(providerId, callbackUrl);
  return NextResponse.redirect(redirectUrl);
}
