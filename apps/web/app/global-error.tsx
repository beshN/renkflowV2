'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Error boundaries swallow the error; report it (no-op without a Sentry DSN).
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="tr">
      <body className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl shadow-xl p-8">
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-12 h-12 rounded-xl bg-red-50 dark:bg-red-950/40 flex items-center justify-center border border-red-100 dark:border-red-900/40">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Uygulama hatası</h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Üzgünüz, uygulama genelinde beklenmeyen bir hata oluştu. Tekrar deneyebilir veya ana sayfaya dönebilirsin.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <RefreshCw className="w-4 h-4" />
              Tekrar dene
            </button>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
            >
              Sayfayı yenile
            </button>

            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
            >
              <Home className="w-4 h-4" />
              Ana sayfa
            </Link>
          </div>

          {process.env.NODE_ENV === 'development' && (
            <div className="mt-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-4">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Hata detayı (dev)</p>
              <pre className="mt-2 text-xs text-red-700 dark:text-red-300 whitespace-pre-wrap break-words">
                {error.message}
                {error.digest ? `\n\nDigest: ${error.digest}` : ''}
              </pre>
            </div>
          )}
        </div>
      </body>
    </html>
  );
}
