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
import { tableExists } from '@/lib/db/schema-guard';
import { IS_PRODUCTION } from '@/lib/shared/config/runtime-env';
import {
  SSO_ERRORS,
  SsoAccessError,
  decideSsoLink,
  mapOidcProfile,
  mapSamlProfile,
  type SsoEmailPolicy,
  type SsoProfile,
} from '@/lib/features/auth/sso-policy';
import { SAML } from '@node-saml/node-saml';
import { parseStringPromise } from 'xml2js';
import crypto from 'node:crypto';
import { openSecret, sealSecret } from '@/lib/security/secret-box';
import {
  Configuration,
  ClientSecretPost,
  allowInsecureRequests,
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
  /** The IdP verifies every e-mail it sends (column trust_idp_email, migration 080; false when absent). */
  trustIdpEmail?: boolean;
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
      domain_restrictions as "domainRestrictions",
      COALESCE((to_jsonb(sso_providers) ->> 'trust_idp_email')::boolean, false) as "trustIdpEmail"
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
  if (data.trustIdpEmail) {
    await sql`/* tenant-checked: the provider row inserted just above */ UPDATE sso_providers SET trust_idp_email = true WHERE id = ${id}`;
  }

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
    trustIdpEmail: Boolean(data.trustIdpEmail),
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
  const provider = mapDbProvider(providerRows[0]);
  // E-mail trust (provider policy, allowed domains) and the NameID subject are checked here.
  const profile = mapSamlProfile(response.profile as Record<string, any> | null, emailPolicy(provider));

  const user = await findOrCreateSSOUser(profile, provider);
  
  // Clean up state
  await sql`DELETE FROM sso_states WHERE state = ${state}`;

  return { user, redirectTo: stateRecord.callback_url };
}

// ============================================
// User Provisioning
// ============================================

/**
 * The account a provider login belongs to, bound by (provider, subject); the rules are in
 * decideSsoLink. Always returns a member of the provider's firm, with that firm as `tenantId`.
 */
export async function findOrCreateSSOUser(profile: SsoProfile, provider: SSOProvider): Promise<any> {
  // Checked outside the transaction (own client). Without migration 080 nothing is linked and an
  // e-mail only finds an account that is already a member of the provider's firm.
  const identitiesAvailable = await tableExists('sso_identities');
  return withTransaction(async (tx) => {
    const membershipOf = async (userId: string | null) => {
      if (!userId) return 'none' as const;
      const [m] = await tx`
        SELECT (to_jsonb(tenant_members) ->> 'deactivated_at') IS NOT NULL AS deactivated
        FROM tenant_members
        WHERE user_id = ${userId} AND tenant_id = ${provider.tenantId}
        FOR UPDATE
      `;
      return !m ? ('none' as const) : m.deactivated ? ('deactivated' as const) : ('active' as const);
    };

    let identityUserId: string | null = null;
    if (identitiesAvailable) {
      const [identity] = await tx`
        SELECT user_id FROM sso_identities
        WHERE provider_id = ${provider.id} AND subject = ${profile.subject}
        FOR UPDATE
      `;
      identityUserId = identity?.user_id ?? null;
    }

    let emailUserId: string | null = null;
    let emailUserSubject: string | null = null;
    if (!identityUserId) {
      const [byEmail] = await tx`SELECT id FROM users WHERE email = ${profile.email} LIMIT 1 FOR UPDATE`;
      emailUserId = byEmail?.id ?? null;
      if (emailUserId && identitiesAvailable) {
        const [linked] = await tx`SELECT subject FROM sso_identities WHERE provider_id = ${provider.id} AND user_id = ${emailUserId}`;
        emailUserSubject = linked?.subject ?? null;
      }
    }

    const decision = decideSsoLink({
      identitiesAvailable,
      identityUserId,
      emailUserId,
      emailUserSubject,
      subject: profile.subject,
      allowSignup: provider.allowSignup,
      membership: await membershipOf(identityUserId ?? emailUserId),
    });

    let userId: string;
    let addMembership: boolean;
    if (decision.kind === 'create') {
      const [created] = await tx`
        INSERT INTO users (id, email, name, email_verified, created_at, updated_at)
        VALUES (
          ${createUuid()},
          ${profile.email},
          ${profile.name || profile.email.split('@')[0]},
          -- email_verified is the time it was verified: the identity provider vouched for it now.
          NOW(),
          NOW(),
          NOW()
        )
        ON CONFLICT (email) DO NOTHING
        RETURNING id
      `;
      // Created by another request since the lookup: refuse rather than adopt it without the link rules.
      if (!created?.id) throw new Error('SSO user was created concurrently; retry');
      userId = created.id;
      addMembership = true;
    } else {
      userId = decision.userId;
      addMembership = decision.addMembership;
      await tx`
        UPDATE users
        SET name = COALESCE(${profile.name || null}, name), updated_at = NOW()
        WHERE id = ${userId}
      `;
    }

    if (addMembership) {
      await tx`
        INSERT INTO tenant_members (tenant_id, user_id, role, created_at)
        VALUES (${provider.tenantId}, ${userId}, ${determineRoleFromGroups(profile.groups)}, NOW())
        ON CONFLICT (tenant_id, user_id) DO NOTHING
      `;
    }

    if (decision.kind === 'identity') {
      await tx`
        UPDATE sso_identities SET last_login_at = NOW()
        WHERE provider_id = ${provider.id} AND subject = ${profile.subject}
      `;
    } else if (decision.recordIdentity) {
      // Unique on (provider, subject) and on (provider, user): a racing login for another subject loses here.
      const [linked] = await tx`
        INSERT INTO sso_identities (provider_id, subject, user_id, created_at, last_login_at)
        VALUES (${provider.id}, ${profile.subject}, ${userId}, NOW(), NOW())
        ON CONFLICT DO NOTHING
        RETURNING user_id
      `;
      if (!linked) throw new SsoAccessError(SSO_ERRORS.subjectTaken);
    }

    const [membership] = await tx`
      SELECT tenant_id, role
      FROM tenant_members
      WHERE user_id = ${userId}
        AND tenant_id = ${provider.tenantId}
        AND (to_jsonb(tenant_members) ->> 'deactivated_at') IS NULL
    `;
    if (!membership) throw new SsoAccessError(SSO_ERRORS.notMember);
    const [user] = await tx`SELECT * FROM users WHERE id = ${userId}`;

    return {
      ...user,
      tenant_id: membership.tenant_id,
      tenantId: membership.tenant_id,
      providerId: provider.id,
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
  const claims = tokenSet.claims() as Record<string, unknown> | undefined;
  const expectedSubject = typeof claims?.sub === 'string' ? claims.sub : skipSubjectCheck;
  const userInfo = (await fetchUserInfo(config, tokenSet.access_token, expectedSubject)) as OIDCProfile;
  const provider = mapDbProvider(providerRows[0]);
  // Refuses `email_verified: false`, and an absent claim unless the provider policy vouches for it.
  const profile = mapOidcProfile(userInfo, emailPolicy(provider), claims);

  const user = await findOrCreateSSOUser(profile, provider);
  await sql`DELETE FROM sso_states WHERE state = ${params.state}`;

  return { user, redirectTo: stateRecord.callback_url };
}

async function createOidcConfig(provider: any, redirectUri: string): Promise<Configuration> {
  const clientMetadata = {
    redirect_uris: [redirectUri],
    response_types: ['code'],
  };

  if (provider.issuer_url) {
    const issuer = new URL(provider.issuer_url);
    return discovery(
      issuer,
      provider.client_id,
      clientMetadata,
      ClientSecretPost(openSecret(provider.client_secret, SSO_SECRET_PURPOSE) ?? ''),
      localPlainHttp(issuer) ? { execute: [allowInsecureRequests] } : undefined,
    );
  }

  const serverMetadata = {
    issuer: provider.name,
    authorization_endpoint: provider.authorization_url,
    token_endpoint: provider.token_url,
    userinfo_endpoint: provider.user_info_url,
  };

  const config = new Configuration(
    serverMetadata,
    provider.client_id,
    clientMetadata,
    ClientSecretPost(openSecret(provider.client_secret, SSO_SECRET_PURPOSE) ?? ''),
  );
  if (provider.token_url && localPlainHttp(new URL(provider.token_url))) allowInsecureRequests(config);
  return config;
}

/** Plain HTTP only to a loopback IdP outside production (local development and the integration test). */
function localPlainHttp(url: URL): boolean {
  return !IS_PRODUCTION && url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
}

function emailPolicy(provider: SSOProvider): SsoEmailPolicy {
  return { trustIdpEmail: provider.trustIdpEmail, domainRestrictions: provider.domainRestrictions };
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
    trustIdpEmail: row.trust_idp_email === true,
  };
}
