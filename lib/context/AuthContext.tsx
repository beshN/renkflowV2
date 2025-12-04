'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useSession } from 'next-auth/react';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'office' | 'worker';
  avatar?: string;
  tenantId?: string;
  tenantName?: string;
  brandColor?: string;
  logoUrl?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, status, update } = useSession();

  const user: User | null = session?.user
    ? {
        id: session.user.id,
        name: session.user.name || '',
        email: session.user.email || '',
        role: session.user.role || 'member',
        avatar: session.user.image || undefined,
        tenantId: session.user.tenantId,
        tenantName: session.user.tenantName,
        brandColor: session.user.brandColor,
        logoUrl: session.user.logoUrl,
      }
    : null;

  const refreshUser = async () => {
    // Refresh session to get latest user data
    await update();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading: status === 'loading',
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
