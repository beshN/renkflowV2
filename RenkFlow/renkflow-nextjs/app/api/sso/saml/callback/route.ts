import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { encode } from 'next-auth/jwt';
import { handleSAMLCallback } from '@/lib/auth/sso';
import { getSql } from '@/lib/db';

const AUTH_SECRET = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;

function getSessionCookieName() {
  return process.env.NODE_ENV === 'production' ? '__Secure-authjs.session-token' : 'authjs.session-token';
}

async function setSessionCookie(user: any) {
  if (!AUTH_SECRET) {
    throw new Error('Missing AUTH_SECRET');
  }

  const token = await encode({
    secret: AUTH_SECRET,
    salt: getSessionCookieName(),
    token: {
      id: user.id,
      email: user.email,
      name: user.name,
      tenantId: user.tenantId,
      tenantName: user.tenantName,
      role: user.role,
      brandColor: user.brandColor,
      logoUrl: user.logoUrl,
      tenantIndustry: user.tenantIndustry,
      templateKey: user.templateKey,
    },
  } as Parameters<typeof encode>[0]);

  const cookieStore = await cookies();
  cookieStore.set(getSessionCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

async function loadSessionUser(userId: string) {
  const sql = getSql();
  const [user] = await sql`
    SELECT u.*, tm.tenant_id, tm.role, t.name as tenant_name, t.brand_color, t.logo_url, t.industry, t.template_key
    FROM users u
    LEFT JOIN tenant_members tm ON u.id = tm.user_id
    LEFT JOIN tenants t ON tm.tenant_id = t.id
    WHERE u.id = ${userId}
    LIMIT 1
  `;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    tenantId: user.tenant_id,
    tenantName: user.tenant_name,
    role: user.role,
    brandColor: user.brand_color,
    logoUrl: user.logo_url,
    tenantIndustry: user.industry,
    templateKey: user.template_key,
  };
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const samlResponse = formData.get('SAMLResponse')?.toString();
  const state = formData.get('RelayState')?.toString();

  if (!samlResponse || !state) {
    return NextResponse.json({ error: 'Invalid SAML response' }, { status: 400 });
  }

  const { user, redirectTo } = await handleSAMLCallback(samlResponse, state);
  const sessionUser = await loadSessionUser(user.id);
  await setSessionCookie(sessionUser);

  return NextResponse.redirect(redirectTo);
}
