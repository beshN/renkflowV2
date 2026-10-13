/**
 * SAML / SSO Integration
 * 
 * Features:
 * - SAML 2.0 identity provider support
 * - Just-In-Time (JIT) provisioning
 * - Session management with SSO
 * - Multi-tenant SSO configuration
 */

import { sql, withTransaction } from '@/lib/db';
import { SAML } from '@node-saml/node-saml';
import { parseStringPromise } from 'xml2js';
import crypto from 'node:crypto';
import { openSecret, sealSecret } from '@/lib/security/secret-box';
import {
  Configuration,
  ClientSecretPost,
  authorizationCodeGrant,
  buildAuthorizationUrl,
  calculatePKCECodeChallenge,
  discovery,
  fetchUserInfo,
  randomPKCECodeVerifier,
  skipSubjectCheck,
} from 'openid-client';

// OIDC client secrets are stored sealed; rows written before this change are still read as plain text.
const SSO_SECRET_PURPOSE = 'sso.client_secret';

// ============================================
// Types
// ============================================

export interface SSOProvider {
  id: string;
  tenantId: string;
  name: string;
  type: 'saml' | 'oidc' | 'google' | 'azure';
  metadata?: string; // SAML XML metadata
  clientId?: string; // OIDC
  clientSecret?: string; // OIDC
  authorizationUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  issuerUrl?: string;
  enabled: boolean;
  allowSignup: boolean;
  domainRestrictions?: string[];
}

export interface SAMLProfile {
  email: string;
  name?: string;
  surname?: string;
  groups?: string[];
  attributes: Record<string, string | string[]>;
}

export interface OIDCProfile {
  email: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  groups?: string[];
  [key: string]: unknown;
}

// ============================================
// SSO Provider Management
// ============================================

export async function getSSOProviders(tenantId: string): Promise<SSOProvider[]> {
  const providers = await sql`
    SELECT 
      id,
      tenant_id as "tenantId",
      name,
      type,
      metadata,
      client_id as "clientId",
      client_secret as "clientSecret",
      authorization_url as "authorizationUrl",
      token_url as "tokenUrl",
      user_info_url as "userInfoUrl",
      enabled,
      allow_signup as "allowSignup",
      domain_restrictions as "domainRestrictions"
    FROM sso_providers
    WHERE tenant_id = ${tenantId} AND enabled = true
  `;

  const providersRows = providers as any[];
  return providersRows.map((p: any) => ({
    ...p,
    domainRestrictions: p.domainRestrictions || [],
  })) as SSOProvider[];
}

export async function createSSOProvider(
  data: Omit<SSOProvider, 'id'>
): Promise<SSOProvider> {
  const id = createUuid();
  
  const providerResult = await sql`
    INSERT INTO sso_providers (
      id,
      tenant_id,
      name,
      type,
      metadata,
      client_id,
      client_secret,
      authorization_url,
      token_url,
      user_info_url,
      issuer_url,
      enabled,
      allow_signup,
      domain_restrictions
    ) VALUES (
      ${id},
      ${data.tenantId},
      ${data.name},
      ${data.type},
      ${data.metadata || null},
      ${data.clientId || null},
      ${data.clientSecret ? sealSecret(data.clientSecret, SSO_SECRET_PURPOSE) : null},
      ${data.authorizationUrl || null},
      ${data.tokenUrl || null},
      ${data.userInfoUrl || null},
      ${data.issuerUrl || null},
      ${data.enabled},
      ${data.allowSignup},
      ${data.domainRestrictions || null}
    )
    RETURNING *
  `;
  const providerRows = providerResult as any[];
  const provider = providerRows[0];

  return {
    ...provider,
    tenantId: provider.tenant_id,
    clientId: provider.client_id,
    clientSecret: data.clientSecret,
    authorizationUrl: provider.authorization_url,
    tokenUrl: provider.token_url,
    userInfoUrl: provider.user_info_url,
    issuerUrl: provider.issuer_url,
    allowSignup: provider.allow_signup,
    domainRestrictions: provider.domain_restrictions || [],
  } as SSOProvider;
}

// ============================================
// SAML Authentication Flow
// ============================================

export async function initiateSAMLLogin(
  providerId: string,
  callbackUrl: string
): Promise<{ redirectUrl: string; state: string }> {
  const state = createId('state');
  
  // Store state for validation
  await sql`
    INSERT INTO sso_states (state, provider_id, callback_url, created_at, expires_at)
    VALUES (${state}, ${providerId}, ${callbackUrl}, NOW(), NOW() + INTERVAL '10 minutes')
  `;

  // Build SAML AuthnRequest
  const providerResult = await sql`SELECT * FROM sso_providers WHERE id = ${providerId}`;
  const providerRows = providerResult as any[];
  
  if (!providerRows[0]) {
    throw new Error('SSO provider not found');
  }

  if (!providerRows[0]?.metadata) {
    throw new Error('SSO provider metadata is missing');
  }

  const saml = await createSamlInstance(providerRows[0], callbackUrl);
  const redirectUrl = await saml.getAuthorizeUrlAsync(state, undefined, {});
  
  return { redirectUrl, state };
}

export async function handleSAMLCallback(
  samlResponse: string,
  state: string
): Promise<{ user: any; redirectTo: string }> {
  // Validate state
  const stateResult = await sql`
    SELECT * FROM sso_states 
    WHERE state = ${state} AND expires_at > NOW()
  `;
  const stateRows = stateResult as any[];
  const stateRecord = stateRows[0];

  if (!stateRecord) {
    throw new Error('Invalid or expired state');
  }

  const providerResult = await sql`SELECT * FROM sso_providers WHERE id = ${stateRecord.provider_id}`;
  const providerRows = providerResult as any[];

  if (!providerRows[0]) {
    throw new Error('SSO provider not found');
  }

  if (!providerRows[0].metadata) {
    throw new Error('SSO provider metadata is missing');
  }

  const saml = await createSamlInstance(providerRows[0], stateRecord.callback_url);
  const response = await saml.validatePostResponseAsync({ SAMLResponse: samlResponse });
  const profile = mapSamlProfile(response.profile);
  
  // Check domain restrictions
  const domain = profile.email.split('@')[1];
  
  if (providerRows[0]?.domain_restrictions?.length > 0) {
    if (!providerRows[0].domain_restrictions.includes(domain)) {
      throw new Error('Domain not allowed for this SSO provider');
    }
  }

  // Find or create user
  const user = await findOrCreateSSOUser(profile, mapDbProvider(providerRows[0]));
  
  // Clean up state
  await sql`DELETE FROM sso_states WHERE state = ${state}`;

  return { user, redirectTo: stateRecord.callback_url };
}

// ============================================
// User Provisioning
// ============================================

async function findOrCreateSSOUser(
  profile: { email: string; name?: string; surname?: string; groups?: string[]; attributes?: Record<string, unknown> },
  provider: SSOProvider
): Promise<any> {
  return withTransaction(async (tx) => {
    const existingUserResult = await tx`
      SELECT u.*
      FROM users u
      WHERE u.email = ${profile.email}
      LIMIT 1
      FOR UPDATE
    `;
    const existingUserRows = existingUserResult as any[];
    let user = existingUserRows[0];

    if (user) {
      await tx`
        UPDATE users
        SET
          name = COALESCE(${profile.name || null}, name),
          updated_at = NOW()
        WHERE id = ${user.id}
      `;
    } else {
      if (!provider.allowSignup) {
        throw new Error('User not found and automatic signup is disabled');
      }

      const createdUsers = await tx`
        INSERT INTO users (id, email, name, email_verified, created_at, updated_at)
        VALUES (
          ${createUuid()},
          ${profile.email},
          ${profile.name || profile.email.split('@')[0]},
          true,
          NOW(),
          NOW()
        )
        ON CONFLICT (email)
        DO UPDATE SET
          name = COALESCE(EXCLUDED.name, users.name),
          updated_at = NOW()
        RETURNING *
      `;
      const createdRows = createdUsers as any[];
      user = createdRows[0];
    }

    if (!user?.id) {
      throw new Error('Failed to resolve SSO user');
    }

    if (provider.allowSignup) {
      const role = determineRoleFromGroups(profile.groups);
      await tx`
        INSERT INTO tenant_members (tenant_id, user_id, role, created_at)
        VALUES (${provider.tenantId}, ${user.id}, ${role}, NOW())
        ON CONFLICT (tenant_id, user_id) DO NOTHING
      `;
    }

    const membershipResult = await tx`
      SELECT tenant_id, role
      FROM tenant_members
      WHERE user_id = ${user.id}
        AND tenant_id = ${provider.tenantId}
      LIMIT 1
    `;
    const membershipRows = membershipResult as any[];
    const membership = membershipRows[0];

    if (!membership) {
      throw new Error('User is not a member of this tenant and automatic signup is disabled');
    }

    return {
      ...user,
      tenant_id: membership.tenant_id,
      tenantId: membership.tenant_id,
      role: membership.role,
    };
  });
}

function determineRoleFromGroups(groups?: string[]): 'owner' | 'admin' | 'member' {
  if (!groups) return 'member';
  
  if (groups.includes('admin') || groups.includes('Owner')) return 'owner';
  if (groups.includes('manager') || groups.includes('Admin')) return 'admin';
  return 'member';
}

// ============================================
// SAML Utilities
// ============================================

async function parseSamlMetadata(metadata: string): Promise<{ entryPoint: string; cert: string; issuer?: string }> {
  const parsed = await parseStringPromise(metadata);
  const entity = parsed?.EntityDescriptor || parsed?.['md:EntityDescriptor'];
  const entityId = entity?.$?.entityID;
  const idp = entity?.IDPSSODescriptor?.[0] || entity?.['md:IDPSSODescriptor']?.[0];
  const ssoServices = idp?.SingleSignOnService || idp?.['md:SingleSignOnService'] || [];
  const preferred = ssoServices.find((s: any) => s.$?.Binding?.includes('HTTP-Redirect'))
    || ssoServices[0];
  const entryPoint = preferred?.$?.Location;

  const keyDescriptor = (idp?.KeyDescriptor || idp?.['md:KeyDescriptor'] || []).find((k: any) =>
    !k.$?.use || k.$?.use === 'signing'
  ) || (idp?.KeyDescriptor || idp?.['md:KeyDescriptor'] || [])[0];
  const cert =
    keyDescriptor?.KeyInfo?.[0]?.X509Data?.[0]?.X509Certificate?.[0] ||
    keyDescriptor?.['ds:KeyInfo']?.[0]?.['ds:X509Data']?.[0]?.['ds:X509Certificate']?.[0];

  if (!entryPoint || !cert) {
    throw new Error('Invalid SAML metadata');
  }

  return {
    entryPoint,
    cert: cert.replace(/\s+/g, ''),
    issuer: entityId,
  };
}

async function createSamlInstance(provider: any, callbackUrl: string): Promise<SAML> {
  const { entryPoint, cert, issuer } = await parseSamlMetadata(provider.metadata);
  return new SAML({
    entryPoint,
    issuer: issuer || callbackUrl,
    callbackUrl,
    idpCert: cert,
    wantAssertionsSigned: true,
    wantAuthnResponseSigned: true,
    disableRequestedAuthnContext: false,
    acceptedClockSkewMs: 300000,
  });
}

function mapSamlProfile(profile: any): SAMLProfile {
  const email =
    profile?.email ||
    profile?.mail ||
    profile?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'];
  if (!email) {
    throw new Error('SAML response missing email');
  }

  return {
    email,
    name: profile?.givenName || profile?.firstName || profile?.name,
    surname: profile?.sn || profile?.lastName || profile?.surname,
    groups: profile?.groups || profile?.memberOf,
    attributes: profile,
  };
}

// ============================================
// OIDC Flow (Google, Azure, etc.)
// ============================================

export async function initiateOIDCLogin(
  providerId: string,
  redirectUri: string
): Promise<{ url: string; state: string; codeVerifier: string }> {
  const state = createId('state');

  const providerResult = await sql`SELECT * FROM sso_providers WHERE id = ${providerId}`;
  const providerRows = providerResult as any[];
  
  if (!providerRows[0]) {
    throw new Error('SSO provider not found');
  }

  const config = await createOidcConfig(providerRows[0], redirectUri);
  const codeVerifier = randomPKCECodeVerifier();
  const codeChallenge = await calculatePKCECodeChallenge(codeVerifier);
  const url = buildAuthorizationUrl(config, {
    scope: 'openid email profile',
    state,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  // Store PKCE data
  await sql`
    INSERT INTO sso_states (state, provider_id, callback_url, code_verifier, created_at, expires_at)
    VALUES (${state}, ${providerId}, ${redirectUri}, ${codeVerifier}, NOW(), NOW() + INTERVAL '10 minutes')
  `;

  return { url: url.toString(), state, codeVerifier };
}

export async function handleOIDCCallback(
  providerId: string,
  redirectUri: string,
  params: { code: string; state: string }
): Promise<{ user: any; redirectTo: string }> {
  const stateResult = await sql`
    SELECT * FROM sso_states
    WHERE state = ${params.state} AND expires_at > NOW()
  `;
  const stateRows = stateResult as any[];
  const stateRecord = stateRows[0];

  if (!stateRecord) {
    throw new Error('Invalid or expired state');
  }

  const providerResult = await sql`SELECT * FROM sso_providers WHERE id = ${providerId}`;
  const providerRows = providerResult as any[];

  if (!providerRows[0]) {
    throw new Error('SSO provider not found');
  }

  const config = await createOidcConfig(providerRows[0], redirectUri);
  const currentUrl = new URL(redirectUri);
  currentUrl.searchParams.set('code', params.code);
  currentUrl.searchParams.set('state', params.state);
  const tokenSet = await authorizationCodeGrant(config, currentUrl, {
    pkceCodeVerifier: stateRecord.code_verifier,
    expectedState: params.state,
  });
  const expectedSubject = tokenSet.claims()?.sub ?? skipSubjectCheck;
  const userInfo = (await fetchUserInfo(config, tokenSet.access_token, expectedSubject)) as OIDCProfile;
  const profile = mapOidcProfile(userInfo);

  const user = await findOrCreateSSOUser(profile, mapDbProvider(providerRows[0]));
  await sql`DELETE FROM sso_states WHERE state = ${params.state}`;

  return { user, redirectTo: stateRecord.callback_url };
}

function mapOidcProfile(profile: OIDCProfile) {
  if (!profile.email) {
    throw new Error('OIDC profile missing email');
  }
  return {
    email: profile.email,
    name: profile.name || profile.given_name,
    surname: profile.family_name,
    groups: Array.isArray(profile.groups) ? profile.groups : undefined,
    attributes: profile as Record<string, unknown>,
  };
}

async function createOidcConfig(provider: any, redirectUri: string): Promise<Configuration> {
  const clientMetadata = {
    redirect_uris: [redirectUri],
    response_types: ['code'],
  };

  if (provider.issuer_url) {
    return discovery(
      new URL(provider.issuer_url),
      provider.client_id,
      clientMetadata,
      ClientSecretPost(openSecret(provider.client_secret, SSO_SECRET_PURPOSE) ?? ''),
    );
  }

  const serverMetadata = {
    issuer: provider.name,
    authorization_endpoint: provider.authorization_url,
    token_endpoint: provider.token_url,
    userinfo_endpoint: provider.user_info_url,
  };

  return new Configuration(
    serverMetadata,
    provider.client_id,
    clientMetadata,
    ClientSecretPost(openSecret(provider.client_secret, SSO_SECRET_PURPOSE) ?? ''),
  );
}

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(16).toString('hex')}`;
}

function createUuid(): string {
  return crypto.randomUUID();
}

function mapDbProvider(row: any): SSOProvider {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    type: row.type,
    metadata: row.metadata,
    clientId: row.client_id,
    clientSecret: row.client_secret,
    authorizationUrl: row.authorization_url,
    tokenUrl: row.token_url,
    userInfoUrl: row.user_info_url,
    issuerUrl: row.issuer_url,
    enabled: row.enabled,
    allowSignup: row.allow_signup,
    domainRestrictions: row.domain_restrictions || [],
  };
}
