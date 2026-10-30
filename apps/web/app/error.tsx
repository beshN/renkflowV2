'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { WhileYouWait } from '@/components/spells/WhileYouWait';
import '@/components/site/v2/landing-v2.css';

export default function Error({
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
    <div className="rfx flex min-h-screen items-center justify-center p-6">
      <div role="alert" className="x-window x-rise w-full max-w-lg p-8">
        <div className="flex items-start gap-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--x-r-panel)] bg-[rgb(180_67_47/0.08)] text-[var(--x-danger)]"><AlertTriangle aria-hidden="true" className="h-5 w-5" /></span>
          <div className="min-w-0">
            <h1 className="x-display text-[22px] leading-tight">Bu sayfa yüklenemedi</h1>
            <p className="mt-1.5 text-[14.5px] leading-6 text-[var(--x-muted)]">Beklenmeyen bir sorun oluştu. Tekrar deneyin; sorun sürerse sayfayı yenileyin ya da ana sayfaya dönün.</p>
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <button type="button" onClick={() => reset()} className="x-btn x-btn-primary"><RefreshCw aria-hidden="true" className="h-4 w-4" /> Tekrar dene</button>
          <button type="button" onClick={() => window.location.reload()} className="x-btn x-btn-quiet">Sayfayı yenile</button>
          <Link href="/" className="x-btn x-btn-quiet"><Home aria-hidden="true" className="h-4 w-4" /> Ana sayfa</Link>
        </div>
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-6 rounded-[var(--x-r-panel)] bg-[var(--x-surface-sunk)] p-4 shadow-[inset_0_0_0_1px_var(--x-line)]">
            <p className="text-[12px] font-medium text-[var(--x-muted)]">Hata detayı (geliştirme)</p>
            <pre className="x-code mt-2 whitespace-pre-wrap break-words text-[var(--x-danger)]">
              {error.message}
              {error.digest ? `\n\nDigest: ${error.digest}` : ''}
            </pre>
          </div>
        )}
        <WhileYouWait className="mt-6 border-t border-[var(--x-line)] pt-4" />
      </div>
    </div>
  );
}
