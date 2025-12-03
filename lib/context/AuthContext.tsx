'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/auth/supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';

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
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const fetchTenantInfo = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('tenant_members')
        .select(`
          role,
          tenant_id,
          tenants (
            name,
            brand_color,
            logo_url
          )
        `)
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching tenant info:', error);
        return null;
      }

      const tenantData = data.tenants as any;
      const tenant = Array.isArray(tenantData) ? tenantData[0] : tenantData;

      return {
        role: data.role as 'owner' | 'admin' | 'member' | 'office' | 'worker',
        tenantId: data.tenant_id,
        tenantName: tenant?.name,
        brandColor: tenant?.brand_color,
        logoUrl: tenant?.logo_url
      };
    } catch (error) {
      console.error('Error in fetchTenantInfo:', error);
      return null;
    }
  };

  const mapSupabaseUser = async (supabaseUser: SupabaseUser) => {
    const tenantInfo = await fetchTenantInfo(supabaseUser.id);
    
    const newUser: User = {
      id: supabaseUser.id,
      name: supabaseUser.user_metadata?.full_name || supabaseUser.email?.split('@')[0] || 'Kullanıcı',
      email: supabaseUser.email || '',
      role: tenantInfo?.role || 'member',
      avatar: supabaseUser.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${supabaseUser.email}&background=random`,
      tenantId: tenantInfo?.tenantId,
      tenantName: tenantInfo?.tenantName,
      brandColor: tenantInfo?.brandColor,
      logoUrl: tenantInfo?.logoUrl
    };
    setUser(newUser);
    setIsLoading(false);
  };

  const checkSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await mapSupabaseUser(session.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Session check error:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await mapSupabaseUser(session.user);
      } else {
        setUser(null);
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push('/auth/login');
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, logout, refreshUser: checkSession }}>
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
