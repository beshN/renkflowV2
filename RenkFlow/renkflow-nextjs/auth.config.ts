import type { NextAuthConfig } from 'next-auth';
import { CredentialsSignin } from 'next-auth';
import Google from 'next-auth/providers/google';
import AzureAD from 'next-auth/providers/azure-ad';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

import { getSql } from '@/lib/db';
import { DEFAULT_TEMPLATE_KEY, TEMPLATE_BY_KEY } from '@/lib/config/templates';

const AUTH_SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
const IS_BUILD_TIME = process.env.NEXT_PHASE === 'phase-production-build';

if (!AUTH_SECRET && !IS_BUILD_TIME) {
  throw new Error(
    '[RenkFlow] FATAL: AUTH_SECRET or NEXTAUTH_SECRET environment variable is required.\n' +
      'Please set one of these in your .env file or deployment environment.'
  );
}

if (AUTH_SECRET && AUTH_SECRET.length < 32) {
  console.warn('[RenkFlow] WARNING: AUTH_SECRET should be at least 32 characters for security');
}

const DEBUG = process.env.AUTH_DEBUG === 'true' || process.env.NODE_ENV !== 'production';

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
    normalized.includes('econn')
  ) {
    return 'db_unavailable';
  }

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
      async authorize(credentials) {
        if (DEBUG) console.log('[AUTH] Starting authorize...');
        
        try {
          const sql = getSql();
          const normalizedEmail = credentials?.email
            ? (credentials.email as string).trim().toLowerCase()
            : '';
          
          // Ticket-based Login (SSO/Magic Link)
          if (credentials?.ticket && normalizedEmail) {
            if (DEBUG) console.log('[AUTH] Attempting ticket login for:', normalizedEmail);
            
            const users = await sql`
              SELECT u.*, tm.tenant_id, tm.role, t.name as tenant_name, t.brand_color, t.logo_url, t.industry, t.template_key
              FROM users u
              LEFT JOIN tenant_members tm ON u.id = tm.user_id
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
            LEFT JOIN tenant_members tm ON u.id = tm.user_id
            LEFT JOIN tenants t ON tm.tenant_id = t.id
            WHERE u.email = ${normalizedEmail}
            LIMIT 1
          `;

          const usersRows = users as any[];
          if (DEBUG) console.log('[AUTH] Query complete, found users:', usersRows.length);

          const user = usersRows[0];

          if (!user) {
            if (DEBUG) console.log('[AUTH] User not found');
            throw createCredentialsError('user_not_found');
          }

          if (!user.password) {
            if (DEBUG) console.log('[AUTH] Password not set (OAuth account)');
            throw createCredentialsError('oauth_only');
          }

          // Verify password
          const isPasswordValid = await bcrypt.compare(
            credentials.password as string,
            user.password
          );

          if (!isPasswordValid) {
            if (DEBUG) console.log('[AUTH] Invalid password');
            throw createCredentialsError('invalid_password');
          }

          if (!user.email_verified) {
            if (DEBUG) console.log('[AUTH] Email not verified');
            throw createCredentialsError('email_not_verified');
          }

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
          if (DEBUG) console.error('[AUTH] Authorize error:', message);

          throw createCredentialsError(mapAuthErrorToCode(message));
        }
      },
    }),
  ],
  callbacks: {
    async authorized({ auth }) {
      return !!auth?.user;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.tenantId = user.tenantId;
        token.tenantName = user.tenantName;
        token.role = user.role;
        token.brandColor = user.brandColor;
        token.logoUrl = user.logoUrl;
        token.tenantIndustry = user.tenantIndustry;
        token.templateKey = user.templateKey;
      }

      // Update session data on refresh
      if (trigger === 'update' && session) {
        token = { ...token, ...session.user };
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.tenantId = token.tenantId as string;
        session.user.tenantName = token.tenantName as string;
        session.user.role = token.role as 'owner' | 'admin' | 'member' | 'office' | 'worker';
        session.user.brandColor = token.brandColor as string;
        session.user.logoUrl = token.logoUrl as string;
        session.user.tenantIndustry = token.tenantIndustry as string;
        session.user.templateKey = token.templateKey as string;
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      // For OAuth providers, create user and tenant if first time
      if (account?.provider !== 'credentials' && user.email) {
        try {
          const sql = getSql();
          const existingUsers = await sql`
            SELECT id FROM users WHERE email = ${user.email} LIMIT 1
          `;

          const existingUsersRows = existingUsers as any[];
          if (existingUsersRows.length === 0) {
            // Create user first for OAuth
            const newUsers = await sql`
              INSERT INTO users (name, email, email_verified, image, created_at, updated_at)
              VALUES (${user.name || 'Kullanıcı'}, ${user.email}, NOW(), ${user.image || null}, NOW(), NOW())
              RETURNING id
            `;
            const newUsersRows = newUsers as any[];

            if (newUsersRows.length === 0) {
              if (DEBUG) console.error('Failed to create OAuth user');
              return true;
            }

            const newUserId = newUsersRows[0].id;

            // Create tenant for new user
            const tenantSlug = (user.name || user.email)
              .toLowerCase()
              .replace(/[^a-z0-9]/g, '-') + '-' + Date.now();

            const oauthTemplate = TEMPLATE_BY_KEY[DEFAULT_TEMPLATE_KEY];
            const tenants = await sql`
              INSERT INTO tenants (name, slug, industry, template_key, created_at, updated_at)
              VALUES (${user.name || 'My Company'}, ${tenantSlug}, ${oauthTemplate.industry}, ${oauthTemplate.key}, NOW(), NOW())
              RETURNING id
            `;

            const tenantsRows = tenants as any[];
            if (tenantsRows[0]) {
              // Link user to tenant as owner
              await sql`
                INSERT INTO tenant_members (tenant_id, user_id, role, created_at)
                VALUES (${tenantsRows[0].id}, ${newUserId}, 'owner', NOW())
              `;
            }

            // Update user object with new id for session
            user.id = newUserId;
          } else {
            // Existing user - update user.id for session
            user.id = existingUsersRows[0].id;
          }
        } catch (error) {
          if (DEBUG) console.error('OAuth signIn error:', error);
        }
      }

      return true;
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  trustHost: true,
};
