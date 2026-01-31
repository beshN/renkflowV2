'use client';

import { SessionProvider } from 'next-auth/react';
import { AuthProvider } from './AuthContext';
import { SettingsProvider } from './SettingsContext';
import { OrdersProvider } from './OrdersContext';
import { ToastProvider } from './ToastContext';
import { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AuthProvider>
        <SettingsProvider>
          <OrdersProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </OrdersProvider>
        </SettingsProvider>
      </AuthProvider>
    </SessionProvider>
  );
}
