'use client';

import React from 'react';
import { useSyncStatus } from '@/lib/offline/hooks';

export function SyncStatusBar() {
  const { status, isOnline, hasConflicts, retryFailed, pendingCount } = useSyncStatus();

  if (!isOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 border-b border-amber-200 bg-amber-50/95 px-4 py-2 text-amber-800 backdrop-blur dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
        <div className="rf-page-wrap flex items-center justify-between gap-3">
          <span className="text-sm font-medium">Çevrimdışı mod - Değişiklikler senkronize edilecek</span>
        </div>
      </div>
    );
  }

  if (hasConflicts) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 border-b border-red-200 bg-red-50/95 px-4 py-2 text-red-800 backdrop-blur dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
        <div className="rf-page-wrap flex items-center justify-between gap-3">
          <span className="text-sm font-medium">Senkronizasyon çakışması - Çözümlemek için tıklayın</span>
          <button
            type="button"
            onClick={retryFailed}
            className="rounded-lg border border-red-300 bg-white/60 px-3 py-1 text-sm font-semibold text-red-800 hover:bg-white dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200"
          >
            Tekrar dene
          </button>
        </div>
      </div>
    );
  }

  if (status.failedCount > 0) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 border-b border-red-200 bg-red-50/95 px-4 py-2 text-red-800 backdrop-blur dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
        <div className="rf-page-wrap flex items-center justify-between gap-3">
          <span className="text-sm font-medium">{status.failedCount} senkronizasyon başarısız - Tekrar dene</span>
          <button
            type="button"
            onClick={retryFailed}
            className="rounded-lg border border-red-300 bg-white/60 px-3 py-1 text-sm font-semibold text-red-800 hover:bg-white dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200"
          >
            Tekrar dene
          </button>
        </div>
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 border-b border-sky-200 bg-sky-50/95 px-4 py-2 text-sky-800 backdrop-blur dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
        <div className="rf-page-wrap flex items-center justify-between gap-3">
          <span className="text-sm font-medium">{pendingCount} değişiklik bekleniyor...</span>
        </div>
      </div>
    );
  }

  return null;
}
