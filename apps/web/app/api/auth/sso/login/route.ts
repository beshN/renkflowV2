import { NextRequest, NextResponse } from 'next/server';
import { getSSOProviders, initiateSAMLLogin, initiateOIDCLogin, SSOProvider } from '@/lib/auth/sso';
import { sql } from '@/lib/db';
import { resolveServerBaseUrl } from '@/lib/shared/config/runtime-env';
import { companyForHost } from '@/lib/features/company/host.server';
import { ssoFlowCookieName } from '@/lib/features/auth/login-ticket.server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');
    const tenantSlug = searchParams.get('slug'); // Option to login by tenant slug directly
    const company = await companyForHost(request.headers.get('host') || request.nextUrl.host);
    const baseUrl =
      resolveServerBaseUrl({
        context: 'api.auth.sso.login',
        fallbackOrigin: request.nextUrl.origin,
      }) || request.nextUrl.origin;
    const callbackUrl = `${company ? request.nextUrl.origin : baseUrl}/api/auth/sso/callback`;

    if (!email && !tenantSlug) {
      return NextResponse.json(
        { error: 'Email or Tenant Slug required' }, 
        { status: 400 }
      );
    }

    let provider: SSOProvider | undefined;

    if (tenantSlug) {
      // Find provider by tenant slug
      const providers = await sql`
        SELECT sp.* FROM sso_providers sp
        JOIN tenants t ON sp.tenant_id = t.id
        WHERE t.slug = ${tenantSlug} AND sp.enabled = true
        LIMIT 1
      `;
      const providersRows = providers as any[];
      if (providersRows.length > 0) {
        provider = {
            id: providersRows[0].id,
            tenantId: providersRows[0].tenant_id,
            name: providersRows[0].name,
            type: providersRows[0].type,
            metadata: providersRows[0].metadata,
            clientId: providersRows[0].client_id,
            clientSecret: providersRows[0].client_secret,
            authorizationUrl: providersRows[0].authorization_url,
            tokenUrl: providersRows[0].token_url,
            userInfoUrl: providersRows[0].user_info_url,
            issuerUrl: providersRows[0].issuer_url,
            enabled: providersRows[0].enabled,
            allowSignup: providersRows[0].allow_signup,
            domainRestrictions: providersRows[0].domain_restrictions || [],
        };
      }
    } else if (email) {
      // Find provider by email domain
      // 1. Check if user exists and get their tenant
       const users = await sql`
        SELECT u.id, tm.tenant_id 
        FROM users u
        JOIN LATERAL (
          SELECT tenant_id
          FROM tenant_members
          WHERE user_id = u.id
          ORDER BY
            CASE role
              WHEN 'owner' THEN 0
              WHEN 'admin' THEN 1
              WHEN 'accountant' THEN 2
              WHEN 'office' THEN 3
              WHEN 'worker' THEN 4
              ELSE 5
            END,
            created_at ASC
          LIMIT 1
        ) tm ON true
        WHERE u.email = ${email}
        LIMIT 1
      `;

      const usersRows = users as any[];
      if (usersRows.length > 0) {
        // User exists, check tenant SSO
        const providers = await getSSOProviders(usersRows[0].tenant_id);
        if (providers.length > 0) {
          provider = providers[0];
        }
      } else {
         // User doesn't exist, try to find a provider matching the domain
         // This is tricky without strict domain enforcement, but we check domain_restrictions
         const domain = email.split('@')[1];
         // Search for providers that explicitly list this domain
         const providers = await sql`
            SELECT * FROM sso_providers 
            WHERE enabled = true 
            AND ${domain} = ANY(domain_restrictions)
            LIMIT 1
         `;
         const domainProvidersRows = providers as any[];
         if (domainProvidersRows.length > 0) {
            provider = {
                id: domainProvidersRows[0].id,
                tenantId: domainProvidersRows[0].tenant_id,
                name: domainProvidersRows[0].name,
                type: domainProvidersRows[0].type,
                metadata: domainProvidersRows[0].metadata,
                clientId: domainProvidersRows[0].client_id,
                clientSecret: domainProvidersRows[0].client_secret,
                authorizationUrl: domainProvidersRows[0].authorization_url,
                tokenUrl: domainProvidersRows[0].token_url,
                userInfoUrl: domainProvidersRows[0].user_info_url,
                issuerUrl: domainProvidersRows[0].issuer_url,
                enabled: domainProvidersRows[0].enabled,
                allowSignup: domainProvidersRows[0].allow_signup,
                domainRestrictions: domainProvidersRows[0].domain_restrictions || [],
            };
         }
      }
    }

    if (!provider || !provider.enabled || (company && provider.tenantId !== company.id)) {
        return NextResponse.json(
            { error: 'SSO not configured for this account' },
            { status: 404 }
        );
    }

    // Initiate Login
    if (provider.type === 'saml') {
        const { redirectUrl, state } = await initiateSAMLLogin(provider.id, callbackUrl);
        return ssoRedirect(request, redirectUrl, state);
    } else if (provider.type === 'oidc' || provider.type === 'google' || provider.type === 'azure') {
        const { url, state } = await initiateOIDCLogin(provider.id, callbackUrl);
        return ssoRedirect(request, url, state);
    }

    return NextResponse.json({ error: 'Unsupported provider type' }, { status: 400 });

  } catch (error: unknown) {
    console.error('SSO Login Error:', error);
    return NextResponse.json(
      { error: 'SSO login failed. Please try again.' },
      { status: 500 }
    );
  }
}

function ssoRedirect(request: NextRequest, url: string, state: string) {
  const response = NextResponse.redirect(url);
  const secure = request.nextUrl.protocol === 'https:';
  // SAML IdPs POST cross-site; None is needed for the browser-bound state cookie on HTTPS.
  response.cookies.set(ssoFlowCookieName(secure), state, { httpOnly: true, secure, sameSite: secure ? 'none' : 'lax', path: '/', maxAge: 600 });
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
