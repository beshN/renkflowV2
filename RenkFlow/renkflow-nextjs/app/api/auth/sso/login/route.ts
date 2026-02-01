import { NextRequest, NextResponse } from 'next/server';
import { getSSOProviders, initiateSAMLLogin, initiateOIDCLogin, SSOProvider } from '@/lib/auth/sso';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');
    const tenantSlug = searchParams.get('slug'); // Option to login by tenant slug directly
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/sso/callback`;

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
      if (providers.length > 0) {
        provider = {
            id: providers[0].id,
            tenantId: providers[0].tenant_id,
            name: providers[0].name,
            type: providers[0].type,
            metadata: providers[0].metadata,
            clientId: providers[0].client_id,
            clientSecret: providers[0].client_secret,
            authorizationUrl: providers[0].authorization_url,
            tokenUrl: providers[0].token_url,
            userInfoUrl: providers[0].user_info_url,
            issuerUrl: providers[0].issuer_url,
            enabled: providers[0].enabled,
            allowSignup: providers[0].allow_signup,
            domainRestrictions: providers[0].domain_restrictions || [],
        };
      }
    } else if (email) {
      // Find provider by email domain
      // 1. Check if user exists and get their tenant
       const users = await sql`
        SELECT u.id, tm.tenant_id 
        FROM users u
        JOIN tenant_members tm ON u.id = tm.user_id
        WHERE u.email = ${email}
        LIMIT 1
      `;

      if (users.length > 0) {
        // User exists, check tenant SSO
        const providers = await getSSOProviders(users[0].tenant_id);
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
         if (providers.length > 0) {
            provider = {
                id: providers[0].id,
                tenantId: providers[0].tenant_id,
                name: providers[0].name,
                type: providers[0].type,
                metadata: providers[0].metadata,
                clientId: providers[0].client_id,
                clientSecret: providers[0].client_secret,
                authorizationUrl: providers[0].authorization_url,
                tokenUrl: providers[0].token_url,
                userInfoUrl: providers[0].user_info_url,
                issuerUrl: providers[0].issuer_url,
                enabled: providers[0].enabled,
                allowSignup: providers[0].allow_signup,
                domainRestrictions: providers[0].domain_restrictions || [],
            };
         }
      }
    }

    if (!provider) {
        return NextResponse.json(
            { error: 'SSO not configured for this account' },
            { status: 404 }
        );
    }

    // Initiate Login
    if (provider.type === 'saml') {
        const { redirectUrl } = await initiateSAMLLogin(provider.id, callbackUrl);
        return NextResponse.redirect(redirectUrl);
    } else if (provider.type === 'oidc' || provider.type === 'google' || provider.type === 'azure') {
        const { url } = await initiateOIDCLogin(provider.id, callbackUrl);
        return NextResponse.redirect(url);
    }

    return NextResponse.json({ error: 'Unsupported provider type' }, { status: 400 });

  } catch (error: any) {
    console.error('SSO Login Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
