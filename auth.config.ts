import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import AzureAD from 'next-auth/providers/azure-ad';
import Credentials from 'next-auth/providers/credentials';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const sql = neon(process.env.DATABASE_URL!);

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/auth/login',
    error: '/auth/login',
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    AzureAD({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      authorization: {
        params: {
          tenant: process.env.AZURE_AD_TENANT_ID || 'common'
        }
      }
    }),
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Geçersiz kimlik bilgileri');
        }

        // Query user from database
        const users = await sql`
          SELECT u.*, tm.tenant_id, tm.role, t.name as tenant_name, t.brand_color, t.logo_url
          FROM users u
          LEFT JOIN tenant_members tm ON u.id = tm.user_id
          LEFT JOIN tenants t ON tm.tenant_id = t.id
          WHERE u.email = ${credentials.email as string}
          LIMIT 1
        `;

        const user = users[0];

        if (!user || !user.password) {
          throw new Error('Kullanıcı bulunamadı');
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isPasswordValid) {
          throw new Error('E-posta veya şifre hatalı');
        }

        if (!user.email_verified) {
          throw new Error('E-posta adresiniz doğrulanmamış. Lütfen gelen kutunuzu kontrol edin.');
        }

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
    async signIn({ user, account }) {
      // For OAuth providers, create tenant if first time
      if (account?.provider !== 'credentials' && user.email) {
        const existingUsers = await sql`
          SELECT id FROM users WHERE email = ${user.email} LIMIT 1
        `;

        if (existingUsers.length === 0) {
          // New OAuth user - create tenant
          const tenantSlug = (user.name || user.email)
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-') + '-' + Date.now();

          const tenants = await sql`
            INSERT INTO tenants (name, slug)
            VALUES (${user.name || 'My Company'}, ${tenantSlug})
            RETURNING id
          `;

          if (tenants[0]) {
            // Link user to tenant as owner
            await sql`
              INSERT INTO tenant_members (tenant_id, user_id, role)
              VALUES (${tenants[0].id}, ${user.id}, 'owner')
            `;
          }
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
