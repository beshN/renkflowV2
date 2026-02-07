// ============================================
// AUTH CLIENT HOOKS
// Client-side Authentication State
// ============================================

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '../store';
import { api } from '../api/client';

// ============================================
// TYPES
// ============================================

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'guest';
  avatar?: string;
}

interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

interface RegisterData {
  email: string;
  password: string;
  name: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

type AuthUser = User | null;

// ============================================
// USE AUTH HOOK
// ============================================

export function useAuth() {
  const router = useRouter();
  const { user, isAuthenticated, setUser, logout: storeLogout } = useAppStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkAuth = useCallback(async () => {
    try {
      const response = await api.get<{ user: User }>('/auth/me');
      setUser(response.user);
    } catch {
      setUser(null);
    }
  }, [setUser]);

  // Check auth status on mount
  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post<{ user: User }>('/auth/login', credentials);
      setUser(response.user);
      router.push('/dashboard');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Giriş başarısız';
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [router, setUser]);

  const register = useCallback(async (data: RegisterData) => {
    setIsLoading(true);
    setError(null);

    try {
      await api.post('/auth/register', data);
      router.push('/login?registered=true');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Kayıt başarısız';
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const logout = useCallback(async () => {
    setIsLoading(true);

    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore logout errors
    } finally {
      storeLogout();
      router.push('/login');
      setIsLoading(false);
    }
  }, [router, storeLogout]);

  const forgotPassword = useCallback(async (email: string) => {
    setIsLoading(true);
    setError(null);

    try {
      await api.post('/auth/forgot-password', { email });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'İşlem başarısız';
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resetPassword = useCallback(async (token: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      await api.post('/auth/reset-password', { token, password });
      router.push('/login?reset=true');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Şifre sıfırlama başarısız';
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    register,
    logout,
    forgotPassword,
    resetPassword,
    checkAuth,
  };
}

// ============================================
// USE SESSION HOOK
// ============================================

export function useSession() {
  const { user, isAuthenticated } = useAppStore();
  const [sessions, setSessions] = useState<Array<{
    id: string;
    device: string;
    location: string;
    lastActive: string;
    isCurrent: boolean;
  }>>([]);

  const fetchSessions = useCallback(async () => {
    try {
      const response = await api.get<{ sessions: typeof sessions }>('/auth/sessions');
      setSessions(response.sessions);
    } catch {
      // Ignore errors
    }
  }, []);

  const revokeSession = useCallback(async (sessionId: string) => {
    try {
      await api.delete(`/auth/sessions/${sessionId}`);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      return true;
    } catch {
      return false;
    }
  }, []);

  const revokeAllSessions = useCallback(async () => {
    try {
      await api.delete('/auth/sessions');
      setSessions([]);
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchSessions();
    }
  }, [isAuthenticated, fetchSessions]);

  return {
    user,
    isAuthenticated,
    sessions,
    fetchSessions,
    revokeSession,
    revokeAllSessions,
  };
}

// ============================================
// USE REQUIRE AUTH HOOK
// ============================================

export function useRequireAuth(requiredRole?: 'admin' | 'user') {
  const router = useRouter();
  const { user, isAuthenticated } = useAppStore();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    if (requiredRole && user?.role !== requiredRole && user?.role !== 'admin') {
      router.push('/403');
      return;
    }

    setIsAuthorized(true);
  }, [isAuthenticated, user, requiredRole, router]);

  return { isAuthorized, user };
}

// ============================================
// AUTH EVENT LISTENER
// ============================================

export function useAuthEvents() {
  const router = useRouter();
  const { logout } = useAppStore();

  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
      router.push('/login?expired=true');
    };

    const handleForbidden = () => {
      router.push('/403');
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    window.addEventListener('auth:forbidden', handleForbidden);

    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
      window.removeEventListener('auth:forbidden', handleForbidden);
    };
  }, [router, logout]);
}

// ============================================
// TOKEN REFRESH HOOK
// ============================================

export function useTokenRefresh() {
  useEffect(() => {
    let refreshTimer: NodeJS.Timeout;

    const scheduleRefresh = () => {
      // Refresh token 1 minute before expiry (assuming 15min access token)
      const refreshIn = 14 * 60 * 1000; // 14 minutes
      
      refreshTimer = setTimeout(async () => {
        try {
          await api.post('/auth/refresh');
          scheduleRefresh(); // Schedule next refresh
        } catch {
          // Token refresh failed, user will be logged out on next request
        }
      }, refreshIn);
    };

    scheduleRefresh();

    return () => {
      clearTimeout(refreshTimer);
    };
  }, []);
}
