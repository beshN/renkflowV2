'use client';

import { createContext, useContext, ReactNode, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'accountant' | 'member' | 'office' | 'worker';
  avatar?: string;
  tenantId?: string;
  tenantName?: string;
  brandColor?: string;
  logoUrl?: string;
  tenantIndustry?: string;
  templateKey?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, status, update } = useSession();

  // Memoize user object to prevent unnecessary re-renders
  const user: User | null = useMemo(() => {
    if (!session?.user) return null;
    
    return {
      id: session.user.id,
      name: session.user.name || '',
      email: session.user.email || '',
      role: session.user.role || 'member',
      avatar: session.user.image || undefined,
      tenantId: session.user.tenantId,
      tenantName: session.user.tenantName,
      brandColor: session.user.brandColor,
      logoUrl: session.user.logoUrl,
      tenantIndustry: session.user.tenantIndustry,
      templateKey: session.user.templateKey,
    };
  }, [session?.user]);

  // Stable callback for refreshing user data
  const refreshUser = useCallback(async () => {
    await update();
  }, [update]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<AuthContextType>(() => ({
    user,
    isLoading: status === 'loading',
    isAuthenticated: !!user,
    refreshUser,
  }), [user, status, refreshUser]);

  return (
    <AuthContext.Provider value={contextValue}>
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
