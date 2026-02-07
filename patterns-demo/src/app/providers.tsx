// ============================================
// ROOT PROVIDERS COMPOSITION
// All app-level providers in one place
// ============================================

'use client';

import { type ReactNode } from 'react';
import { QueryProvider } from '@/lib/query/provider';
import { StateProviders } from '@/lib/store/context';
import { ErrorBoundary, PageErrorFallback } from '@/components/error-boundary';
import { ToastContainer } from '@/components/toast';
import { useAuthEvents, useTokenRefresh } from '@/lib/auth/hooks';

// ============================================
// AUTH INITIALIZER
// ============================================

function AuthInitializer({ children }: { children: ReactNode }) {
  // Setup global auth event listeners
  useAuthEvents();
  
  // Setup automatic token refresh
  useTokenRefresh();
  
  return <>{children}</>;
}

// ============================================
// THEME PROVIDER (if needed)
// ============================================

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: 'light' | 'dark' | 'system';
}

function ThemeProvider({ children, defaultTheme = 'system' }: ThemeProviderProps) {
  // Theme is managed by Zustand store, this just initializes
  return <>{children}</>;
}

// ============================================
// COMBINED PROVIDERS
// ============================================

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ErrorBoundary fallback={(error, reset) => <PageErrorFallback error={error} reset={reset} />}>
      <QueryProvider>
        <StateProviders>
          <ThemeProvider>
            <AuthInitializer>
              {children}
              <ToastContainer />
            </AuthInitializer>
          </ThemeProvider>
        </StateProviders>
      </QueryProvider>
    </ErrorBoundary>
  );
}

// ============================================
// FEATURE-SPECIFIC PROVIDERS
// ============================================

interface FeatureProviderProps {
  children: ReactNode;
  features?: {
    auth?: boolean;
    realtime?: boolean;
    analytics?: boolean;
  };
}

export function FeatureProviders({ 
  children, 
  features = { auth: true, realtime: false, analytics: false } 
}: FeatureProviderProps) {
  let content = <>{children}</>;

  // Wrap with auth if enabled
  if (features.auth) {
    content = <AuthInitializer>{content}</AuthInitializer>;
  }

  return (
    <QueryProvider>
      <StateProviders>
        {content}
      </StateProviders>
    </QueryProvider>
  );
}

// ============================================
// TESTING PROVIDERS
// ============================================

export function TestProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <StateProviders>
        {children}
      </StateProviders>
    </QueryProvider>
  );
}
