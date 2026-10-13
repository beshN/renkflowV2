import { isPrivateAccessAllowed } from '@/lib/features/auth/private-access';
import { openSession, refreshSessionIdentity } from '@/lib/features/auth/session-identity';
import type { NextAuthConfig } from 'next-auth';
import { CredentialsSignin } from 'next-auth';
import Google from 'next-auth/providers/google';
import AzureAD from 'next-auth/providers/azure-ad';
import Credentials from 'next-auth/providers/credentials';
import { clearLoginAttempts, consumeLoginAttempt, verifyPassword } from '@/lib/features/auth/login-guard';
import { getClientIp } from '@/lib/security/rate-limit';
import { recordAuditAfterCommit } from '@/lib/audit/audit-log';

import { getSql } from '@/lib/db';
import { DEFAULT_TEMPLATE_KEY, TEMPLATE_BY_KEY } from '@/lib/config/templates';
import {
  IS_BUILD_TIME,
  IS_PRODUCTION,
  resolveAuthSecret,
} from '@/lib/shared/config/runtime-env';

const AUTH_SECRET = resolveAuthSecret({
  context: 'auth.config',
  allowMissing: IS_BUILD_TIME,
});
const AUTH_TRUST_HOST =
  Boolean(process.env.VERCEL) || process.env.AUTH_TRUST_HOST === 'true' ||
  (!IS_PRODUCTION && process.env.AUTH_TRUST_HOST !== 'false');

if (!AUTH_SECRET && !IS_BUILD_TIME) {
  throw new Error(
    '[RenkFlow] FATAL: AUTH_SECRET or NEXTAUTH_SECRET environment variable is required.\n' +
      'Please set one of these in your .env file or deployment environment.'
  );
}

if (AUTH_SECRET && AUTH_SECRET.length < 32) {
  console.warn('[RenkFlow] WARNING: AUTH_SECRET should be at least 32 characters for security');
}

const DEBUG = process.env.AUTH_DEBUG === 'true' || !IS_PRODUCTION;

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local?.charAt(0) || '*'}***@${domain}`;
}

function createCredentialsError(code: string) {
  const error = new CredentialsSignin();
  error.code = code;
  return error;
}

function mapAuthErrorToCode(message: string) {
  const normalized = message.toLowerCase();

  if (
    normalized.includes('database_url') ||
    normalized.includes('connection') ||
    normalized.includes('connect') ||
    normalized.includes('timeout') ||
    normalized.includes('econn') ||
    normalized.includes('sql') ||
    normalized.includes('db') ||
    normalized.includes('fetch') ||
    normalized.includes('network')
  ) {
    return 'db_unavailable';
  }

  // Log unknown errors for debugging
  console.error('[AUTH] Unmapped error message:', message);
  return 'auth_failed';
}

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/auth/login',
    error: '/auth/login',
  },
  secret: AUTH_SECRET,
  providers: [
    // Only add Google if credentials are configured
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [Google({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        })]
      : []),
    // Only add Azure AD if credentials are configured
    ...(process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET
      ? [AzureAD({
          clientId: process.env.AZURE_AD_CLIENT_ID,
          clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
          authorization: {
            params: {
              tenant: process.env.AZURE_AD_TENANT_ID || 'common'
            }
          }
        })]
      : []),
    // Always add Credentials provider
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        ticket: { label: 'Ticket', type: 'text' },
      },
      async authorize(credentials, request) {
        if (DEBUG) console.log('[AUTH] Starting authorize...');
        
        try {
          const sql = getSql();
          const normalizedEmail = credentials?.email
            ? (credentials.email as string).trim().toLowerCase()
            : '';
          
          if (normalizedEmail) {
            const attempt = await consumeLoginAttempt(getClientIp(request.headers), normalizedEmail);
            if (!attempt.allowed) throw createCredentialsError('rate_limited');
          }

          if (!isPrivateAccessAllowed(normalizedEmail)) throw createCredentialsError('invalid_credentials');

          // Ticket-based Login (SSO/Magic Link)
          if (credentials?.ticket && normalizedEmail) {
            if (DEBUG) console.log('[AUTH] Attempting ticket login for:', normalizedEmail);
            
            const users = await sql`
              SELECT u.*, tm.tenant_id, tm.role, t.name as tenant_name, t.brand_color, t.logo_url, t.industry, t.template_key
              FROM users u
              LEFT JOIN LATERAL (
                SELECT tenant_id, role
                FROM tenant_members
                WHERE user_id = u.id
                ORDER BY
                  -- A firm where the member was deactivated comes last (the column exists from migration 044 on).
                  (to_jsonb(tenant_members) ->> 'deactivated_at') IS NOT NULL,
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
              LEFT JOIN tenants t ON tm.tenant_id = t.id
              WHERE u.email = ${normalizedEmail}
              AND u.verification_token = ${credentials.ticket as string}
              LIMIT 1
            `;

            const usersRows = users as any[];
            if (usersRows.length === 0) {
              if (DEBUG) console.log('[AUTH] Invalid ticket or email');
              throw createCredentialsError('invalid_credentials');
            }

            const user = usersRows[0];

            // Clear the used ticket
            if (!user.tenant_id) {
              throw createCredentialsError('tenant_not_found');
            }

            await sql`
              UPDATE users SET verification_token = NULL WHERE id = ${user.id}
            `;

            if (DEBUG) console.log('[AUTH] Ticket login successful for:', maskEmail(user.email));

            return {
              id: user.id,
              email: user.email,
              name: user.name,
              image: user.image,
              tenantId: user.tenant_id,
              tenantName: user.tenant_name,
              role: user.role,
              brandColor: user.brand_color,
              logoUrl: user.logo_url,
              tenantIndustry: user.industry,
              templateKey: user.template_key,
            };
          }

          // Password-based Login
          if (!normalizedEmail || !credentials?.password) {
            if (DEBUG) console.log('[AUTH] Missing credentials');
            throw createCredentialsError('missing_credentials');
          }

          if (DEBUG) console.log('[AUTH] Checking database connection...');
          
          // Query user from database
          const users = await sql`
            SELECT u.*, tm.tenant_id, tm.role, t.name as tenant_name, t.brand_color, t.logo_url, t.industry, t.template_key
            FROM users u
            LEFT JOIN LATERAL (
              SELECT tenant_id, role
              FROM tenant_members
              WHERE user_id = u.id
              ORDER BY
                -- A firm where the member was deactivated comes last (the column exists from migration 044 on).
                (to_jsonb(tenant_members) ->> 'deactivated_at') IS NOT NULL,
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
            LEFT JOIN tenants t ON tm.tenant_id = t.id
            WHERE u.email = ${normalizedEmail}
            LIMIT 1
          `;

          const usersRows = users as any[];
          if (DEBUG) console.log('[AUTH] Query complete, found users:', usersRows.length);

          const user = usersRows[0];

          // The error code reaches the client, so unknown accounts, OAuth-only
          // accounts and wrong passwords must share one code and similar timing.
          const isPasswordValid = await verifyPassword(credentials.password as string, user?.password);

          if (!user || !isPasswordValid) {
            if (DEBUG) console.log('[AUTH] Invalid credentials');
            // Recorded for existing members only, and not awaited: the response time must not
            // tell an existing account from an unknown one.
            if (user?.tenant_id) {
              void recordAuditAfterCommit({ tenantId: user.tenant_id, actorId: user.id, entityType: 'user', entityId: user.id, action: 'login_failed', metadata: { method: 'password' } });
            }
            throw createCredentialsError('invalid_credentials');
          }

          if (!user.email_verified) {
            if (DEBUG) console.log('[AUTH] Email not verified');
            throw createCredentialsError('email_not_verified');
          }

          if (!user.tenant_id) {
            if (DEBUG) console.log('[AUTH] User has no tenant membership');
            throw createCredentialsError('tenant_not_found');
          }

          await clearLoginAttempts(normalizedEmail);
          await recordAuditAfterCommit({ tenantId: user.tenant_id, actorId: user.id, entityType: 'user', entityId: user.id, action: 'login_succeeded', metadata: { method: 'password' } });
          if (DEBUG) console.log('[AUTH] Login successful for:', maskEmail(user.email));

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            tenantId: user.tenant_id,
            tenantName: user.tenant_name,
            role: user.role,
            brandColor: user.brand_color,
            logoUrl: user.logo_url,
            tenantIndustry: user.industry,
            templateKey: user.template_key,
          };
        } catch (error: any) {
          if (error instanceof CredentialsSignin) {
            throw error;
          }

          const message = error?.message || String(error);
          console.error('[AUTH] Full authorize error:', error);
          console.error('[AUTH] Error message:', message);
          console.error('[AUTH] Error stack:', error?.stack);

          throw createCredentialsError(mapAuthErrorToCode(message));
        }
      },
    }),
  ],
  callbacks: {
    async authorized({ auth }) {
      return !!auth?.user;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.tenantId = user.tenantId;
        token.tenantName = user.tenantName;
        token.role = user.role;
        token.brandColor = user.brandColor;
        token.logoUrl = user.logoUrl;
        token.tenantIndustry = user.tenantIndustry;
        token.templateKey = user.templateKey;
        // Each sign-in is a session of its own (listed and closable on the sessions screen).
        const sid = await openSession(String(user.id), user.tenantId as string | undefined);
        if (sid) token.sid = sid;
      }

      return refreshSessionIdentity(token);
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.tenantId = token.tenantId as string;
        session.user.tenantName = token.tenantName as string;
        session.user.role = token.role as 'owner' | 'admin' | 'accountant' | 'member' | 'office' | 'worker';
        session.user.brandColor = token.brandColor as string;
        session.user.logoUrl = token.logoUrl as string;
        session.user.tenantIndustry = token.tenantIndustry as string;
        session.user.templateKey = token.templateKey as string;
        session.sessionId = typeof token.sid === 'string' ? token.sid : undefined;
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      if (!isPrivateAccessAllowed(user.email)) return false;
      // For OAuth providers, create user and tenant if first time
      if (account?.provider !== 'credentials' && user.email) {
        try {
          const sql = getSql();
          const normalizedEmail = user.email.trim().toLowerCase();
          const resolvedUserId = await sql.begin(async (tx: any) => {
            const upsertedUsers = await tx`
              INSERT INTO users (name, email, email_verified, image, created_at, updated_at)
              VALUES (${user.name || 'Kullanıcı'}, ${normalizedEmail}, NOW(), ${user.image || null}, NOW(), NOW())
              ON CONFLICT (email)
              DO UPDATE SET
                name = COALESCE(EXCLUDED.name, users.name),
                image = COALESCE(EXCLUDED.image, users.image),
                email_verified = COALESCE(users.email_verified, EXCLUDED.email_verified),
                updated_at = NOW()
              RETURNING id
            `;
            const upsertedUserRows = upsertedUsers as Array<{ id: string }>;
            const targetUserId = upsertedUserRows[0]?.id;
            if (!targetUserId) {
              throw new Error('Failed to upsert OAuth user');
            }

            const memberships = await tx`
              SELECT tenant_id
              FROM tenant_members
              WHERE user_id = ${targetUserId}
              LIMIT 1
            `;
            const membershipRows = memberships as Array<{ tenant_id: string }>;

            if (membershipRows.length === 0) {
              const oauthTemplate = TEMPLATE_BY_KEY[DEFAULT_TEMPLATE_KEY];
              const slugSeed = (user.name || normalizedEmail.split('@')[0] || 'tenant')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '')
                .slice(0, 36) || 'tenant';

              let tenantId = '';
              for (let attempt = 0; attempt < 3; attempt += 1) {
                const tenantSlug = `${slugSeed}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
                const tenants = await tx`
                  INSERT INTO tenants (name, slug, industry, template_key, created_at, updated_at)
                  VALUES (${user.name || 'My Company'}, ${tenantSlug}, ${oauthTemplate.industry}, ${oauthTemplate.key}, NOW(), NOW())
                  ON CONFLICT (slug) DO NOTHING
                  RETURNING id
                `;
                const tenantRows = tenants as Array<{ id: string }>;
                if (tenantRows[0]?.id) {
                  tenantId = tenantRows[0].id;
                  break;
                }
              }

              if (!tenantId) {
                throw new Error('Failed to create OAuth tenant');
              }

              await tx`
                INSERT INTO tenant_members (tenant_id, user_id, role, created_at)
                VALUES (${tenantId}, ${targetUserId}, 'owner', NOW())
                ON CONFLICT (tenant_id, user_id) DO NOTHING
              `;
            }

            return targetUserId;
          });

          user.id = resolvedUserId;

          if (user.id) {
            const tenantRows = await sql`
              SELECT tm.tenant_id, tm.role, t.name as tenant_name, t.brand_color, t.logo_url, t.industry, t.template_key
              FROM users u
              LEFT JOIN LATERAL (
                SELECT tenant_id, role
                FROM tenant_members
                WHERE user_id = u.id
                ORDER BY
                  -- A firm where the member was deactivated comes last (the column exists from migration 044 on).
                  (to_jsonb(tenant_members) ->> 'deactivated_at') IS NOT NULL,
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
              LEFT JOIN tenants t ON tm.tenant_id = t.id
              WHERE u.id = ${user.id}
              LIMIT 1
            `;
            const tenantUser = (tenantRows as any[])[0];
            if (!tenantUser?.tenant_id) {
              return false;
            }

            user.tenantId = tenantUser.tenant_id;
            user.tenantName = tenantUser.tenant_name;
            user.role = tenantUser.role;
            user.brandColor = tenantUser.brand_color;
            user.logoUrl = tenantUser.logo_url;
            user.tenantIndustry = tenantUser.industry;
            user.templateKey = tenantUser.template_key;
          }
        } catch (error) {
          if (DEBUG) console.error('OAuth signIn error:', error);
          return false;
        }
      }

      return true;
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  trustHost: AUTH_TRUST_HOST,
};
