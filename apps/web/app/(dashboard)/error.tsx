'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';
import { AlertTriangle, LayoutDashboard, RefreshCw } from 'lucide-react';
import { WhileYouWait } from '@/components/spells/WhileYouWait';

/** A failing workspace screen: the sidebar and header stay, only the page area shows this. */
export default function WorkspaceError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  // Error boundaries swallow the error; report it (no-op without a Sentry DSN).
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="rf-page">
      <div role="alert" className="rf-panel mx-auto mt-6 max-w-lg p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            <AlertTriangle size={18} aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="text-base font-semibold">Bu ekran açılamadı</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Beklenmeyen bir sorun oluştu. Tekrar deneyebilir veya genel bakışa dönebilirsiniz.
            </p>
            {error.digest && <p className="mt-2 font-mono text-[11px] text-muted-foreground">Hata kodu: {error.digest}</p>}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={() => retry()} className="rf-primary-button">
            <RefreshCw size={14} aria-hidden /> Tekrar dene
          </button>
          <Link href="/dashboard" className="rf-secondary-button">
            <LayoutDashboard size={14} aria-hidden /> Genel bakışa dön
          </Link>
        </div>
        {process.env.NODE_ENV === 'development' && (
          <pre className="mt-5 whitespace-pre-wrap break-words rounded-md border border-border bg-muted/40 p-3 text-xs text-red-700 dark:text-red-300">{error.message}</pre>
        )}
        <WhileYouWait className="mt-6 border-t border-border pt-4" />
      </div>
    </div>
  );
}
