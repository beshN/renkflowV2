import { ReactNode } from 'react';
import { ThemeProvider } from './ThemeContext';
import { ToastProvider } from './ToastContext';
import { AuthProvider } from './AuthContext';
import { OrdersProvider } from './OrdersContext';
import { SettingsProvider } from './SettingsContext';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <SettingsProvider>
            <OrdersProvider>{children}</OrdersProvider>
          </SettingsProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
