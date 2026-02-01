'use client';

import React from 'react';
import { useOnlineStatus, useSyncStatus } from './hooks';

interface OfflineContextValue {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  sync: () => Promise<void>;
}

const OfflineContext = React.createContext<OfflineContextValue | null>(null);

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const isOnline = useOnlineStatus();
  const { isSyncing, pendingCount, sync } = useSyncStatus();

  const value = React.useMemo(
    () => ({
      isOnline,
      isSyncing,
      pendingCount,
      sync,
    }),
    [isOnline, isSyncing, pendingCount, sync]
  );

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline(): OfflineContextValue {
  const context = React.useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within OfflineProvider');
  }
  return context;
}
