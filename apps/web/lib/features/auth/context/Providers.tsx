'use client';

import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from './AuthContext';
import { SettingsProvider } from './SettingsContext';
import { ToastProvider } from './ToastContext';
import { ReactNode, useEffect, useState } from 'react';
import { I18nProvider } from '@/lib/i18n';

/**
 * Application Providers
 * 
 * Note: OrdersProvider removed - now using Zustand for order state management.
 * Import useOrders from '@/lib/hooks/useOrders' in components that need order data.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        {children}
      </ThemeProvider>
    </I18nProvider>
  );
}

export function AuthProviders({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);
  return (
    <SessionProvider refetchOnWindowFocus={online} refetchInterval={60} refetchWhenOffline={false}>
      <AuthProvider>
        <SettingsProvider>
          <ToastProvider>{children}</ToastProvider>
        </SettingsProvider>
      </AuthProvider>
    </SessionProvider>
  );
}
