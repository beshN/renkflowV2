import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      tenantId?: string;
      tenantName?: string;
      role?: 'owner' | 'admin' | 'member' | 'office' | 'worker';
      brandColor?: string;
      logoUrl?: string;
    } & DefaultSession['user'];
  }

  interface User {
    tenantId?: string;
    tenantName?: string;
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
    role?: string;
    brandColor?: string;
    logoUrl?: string;
  }
}
