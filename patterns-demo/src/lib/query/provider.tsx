// ============================================
// 4. DATA FETCHING & CACHING PATTERN
// React Query + Server/Client Component Integration
// ============================================

'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// ============================================
// QUERY CLIENT CONFIGURATION
// ============================================

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // SSR-friendly defaults
        staleTime: 60 * 1000, // 1 minute
        gcTime: 5 * 60 * 1000, // 5 minutes (previously cacheTime)
        retry: (failureCount, error) => {
          // Don't retry on 4xx errors
          if (error instanceof Error && 'statusCode' in error) {
            const statusCode = (error as { statusCode: number }).statusCode;
            if (statusCode >= 400 && statusCode < 500) return false;
          }
          return failureCount < 3;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// Browser singleton pattern
let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return makeQueryClient();
  } else {
    // Browser: make a new query client if we don't already have one
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}

// ============================================
// PROVIDER COMPONENT
// ============================================

interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(() => getQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

// ============================================
// HYDRATION BOUNDARY WRAPPER
// ============================================

export { HydrationBoundary } from '@tanstack/react-query';
export { dehydrate } from '@tanstack/react-query';

// Helper for server components
export function getServerQueryClient() {
  return makeQueryClient();
}
