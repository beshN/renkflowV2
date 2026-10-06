'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import { useToast } from '@/lib/context/ToastContext';
import { canAccessRoute, UserRole } from '@/lib/auth/permissions';
import { CutLoader } from '@/components/brand/CutLoader';

interface RouteGuardProps {
  children: React.ReactNode;
}

/**
 * Route Guard Component
 * Protects routes based on user permissions
 * Redirects to dashboard with toast message if unauthorized
 */
export function RouteGuard({ children }: RouteGuardProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { showToast } = useToast();

  useEffect(() => {
    if (isLoading) return;

    // Not authenticated - let NextAuth middleware handle it
    if (!isAuthenticated || !user) return;

    // Check if user can access current route
    const hasAccess = canAccessRoute(user.role as UserRole, pathname);

    if (!hasAccess) {
      showToast('Bu sayfaya erişim yetkiniz bulunmuyor', 'error');
      router.replace('/dashboard');
    }
  }, [isLoading, isAuthenticated, user, pathname, router, showToast]);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <CutLoader variant="page" className="flex-1" />
    );
  }

  return <>{children}</>;
}
