import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import AzureAD from 'next-auth/providers/azure-ad';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

import { sql } from '@/lib/db';

const AUTH_SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

if (!AUTH_SECRET) {
  throw new Error(
    '[RenkFlow] FATAL: AUTH_SECRET or NEXTAUTH_SECRET environment variable is required.\n' +
      'Please set one of these in your .env file or deployment environment.'
  );
}

if (AUTH_SECRET.length < 32) {
  console.warn('[RenkFlow] WARNING: AUTH_SECRET should be at least 32 characters for security');
}

const DEBUG = process.env.AUTH_DEBUG === 'true' || process.env.NODE_ENV !== 'production';

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local?.charAt(0) || '*'}***@${domain}`;
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
      },
      async authorize(credentials) {
        if (DEBUG) console.log('[AUTH] Starting authorize...');
        
        try {
          if (!credentials?.email || !credentials?.password) {
            if (DEBUG) console.log('[AUTH] Missing credentials');
            return null;
          }

          if (DEBUG) console.log('[AUTH] Checking database connection...');
          
          // Query user from database
          const users = await sql`
            SELECT u.*, tm.tenant_id, tm.role, t.name as tenant_name, t.brand_color, t.logo_url
            FROM users u
            LEFT JOIN tenant_members tm ON u.id = tm.user_id
            LEFT JOIN tenants t ON tm.tenant_id = t.id
            WHERE u.email = ${credentials.email as string}
            LIMIT 1
          `;

          if (DEBUG) console.log('[AUTH] Query complete, found users:', users.length);

          const user = users[0];

          if (!user || !user.password) {
            if (DEBUG) console.log('[AUTH] User not found');
            throw new Error('Kullanıcı bulunamadı');
          }

          // Verify password
          const isPasswordValid = await bcrypt.compare(
            credentials.password as string,
            user.password
          );

          if (!isPasswordValid) {
            if (DEBUG) console.log('[AUTH] Invalid password');
            throw new Error('E-posta veya şifre hatalı');
          }

          if (!user.email_verified) {
            if (DEBUG) console.log('[AUTH] Email not verified');
            throw new Error('E-posta adresiniz doğrulanmamış. Lütfen gelen kutunuzu kontrol edin.');
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
          };
        } catch (error: any) {
          if (DEBUG) console.error('[AUTH] Authorize error:', error?.message || error);
          // Re-throw with the error message so NextAuth can display it
          throw new Error(error?.message || 'Giriş yapılamadı');
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
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      // For OAuth providers, create user and tenant if first time
      if (account?.provider !== 'credentials' && user.email) {
        try {
          const existingUsers = await sql`
            SELECT id FROM users WHERE email = ${user.email} LIMIT 1
          `;

          if (existingUsers.length === 0) {
            // Create user first for OAuth
            const newUsers = await sql`
              INSERT INTO users (name, email, email_verified, image, created_at, updated_at)
              VALUES (${user.name || 'Kullanıcı'}, ${user.email}, NOW(), ${user.image || null}, NOW(), NOW())
              RETURNING id
            `;

            if (newUsers.length === 0) {
              if (DEBUG) console.error('Failed to create OAuth user');
              return true;
            }

            const newUserId = newUsers[0].id;

            // Create tenant for new user
            const tenantSlug = (user.name || user.email)
              .toLowerCase()
              .replace(/[^a-z0-9]/g, '-') + '-' + Date.now();

            const tenants = await sql`
              INSERT INTO tenants (name, slug, created_at, updated_at)
              VALUES (${user.name || 'My Company'}, ${tenantSlug}, NOW(), NOW())
              RETURNING id
            `;

            if (tenants[0]) {
              // Link user to tenant as owner
              await sql`
                INSERT INTO tenant_members (tenant_id, user_id, role, created_at)
                VALUES (${tenants[0].id}, ${newUserId}, 'owner', NOW())
              `;
            }

            // Update user object with new id for session
            user.id = newUserId;
          } else {
            // Existing user - update user.id for session
            user.id = existingUsers[0].id;
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
