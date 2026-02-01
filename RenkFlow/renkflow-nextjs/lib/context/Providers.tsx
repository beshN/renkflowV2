'use client';

import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from 'next-themes';
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
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <AuthProvider>
          <SettingsProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </SettingsProvider>
        </AuthProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
