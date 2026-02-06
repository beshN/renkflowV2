'use client';

import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from './AuthContext';
import { SettingsProvider } from './SettingsContext';
import { ToastProvider } from './ToastContext';
import { ReactNode } from 'react';
import { I18nProvider } from '@/lib/i18n';

/**
 * Application Providers
 * 
 * Note: OrdersProvider removed - now using Zustand for order state management.
 * Import useOrders from '@/lib/hooks/useOrders' in components that need order data.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <I18nProvider>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <AuthProvider>
            <SettingsProvider>
              <ToastProvider>
                {children}
              </ToastProvider>
            </SettingsProvider>
          </AuthProvider>
        </ThemeProvider>
      </I18nProvider>
    </SessionProvider>
  );
}
