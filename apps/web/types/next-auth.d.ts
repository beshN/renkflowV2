import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    /** The tracked sign-in (user_sessions.id); absent for sign-ins from before session tracking. */
    sessionId?: string;
    user: {
      id: string;
      tenantId?: string;
      tenantName?: string;
      tenantIndustry?: string;
      templateKey?: string;
      role?: 'owner' | 'admin' | 'accountant' | 'member' | 'office' | 'worker';
      brandColor?: string;
      logoUrl?: string;
    } & DefaultSession['user'];
  }

  interface User {
    tenantId?: string;
    tenantName?: string;
    tenantIndustry?: string;
    templateKey?: string;
    role?: string;
    brandColor?: string;
    logoUrl?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    tenantId?: string;
    tenantName?: string;
    tenantIndustry?: string;
    templateKey?: string;
    role?: string;
    brandColor?: string;
    logoUrl?: string;
    sid?: string;
  }
}
