'use client';

import { SessionProvider } from 'next-auth/react';
import { AuthProvider } from './AuthContext';
import { SettingsProvider } from './SettingsContext';
import { ToastProvider } from './ToastContext';
import { ReactNode } from 'react';

/**
 * Application Providers
 * 
 * Note: OrdersProvider removed - now using Zustand for order state management.
 * Import useOrders from '@/lib/hooks/useOrders' in components that need order data.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AuthProvider>
        <SettingsProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </SettingsProvider>
      </AuthProvider>
    </SessionProvider>
  );
}
