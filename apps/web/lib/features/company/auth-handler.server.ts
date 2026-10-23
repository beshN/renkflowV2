import { Auth } from '@auth/core';
import type { NextAuthConfig } from 'next-auth';
import type { NextRequest } from 'next/server';
import { parseCompanyHost } from './host';
import { companyForHost, CompanyHostError } from './host.server';

/**
 * NextAuth's request wrapper replaces the URL origin with AUTH_URL. On a company host that
 * sends OAuth state/PKCE cookies to the wrong callback. Use the same Auth.js core and config
 * with the validated actual origin; its encrypted redirect-proxy state relays Google's central
 * callback back here. No shared-domain cookies or custom OAuth exchange are needed.
 */
export async function companyAuthHandler(
  request: NextRequest,
  config: NextAuthConfig,
  sharedHandler: (request: NextRequest) => Promise<Response>,
): Promise<Response> {
  const development = process.env.NODE_ENV !== 'production' || process.env.ALLOW_INSECURE_HTTP === '1';
  const host = request.headers.get('host');
  const parsed = parseCompanyHost(host, development);
  if (parsed.kind === 'shared') return sharedHandler(request);
  if (parsed.kind === 'invalid')
    return Response.json({ error: 'Bu şirket adresi kullanılamıyor.' }, { status: 404 });
  try {
    await companyForHost(host);
  } catch (error) {
    return Response.json(
      { error: error instanceof CompanyHostError ? error.message : 'Şirket adresi doğrulanamadı.' },
      { status: error instanceof CompanyHostError ? error.status : 503 },
    );
  }
  const url = new URL(request.url);
  url.host = host!;
  if (!development) url.protocol = 'https:';
  return Auth(new Request(url, request), { ...config, basePath: '/api/auth' });
}
