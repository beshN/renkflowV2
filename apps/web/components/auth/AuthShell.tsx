'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { BrandMark } from '@/components/brand/BrandMark';
import '@/components/site/v2/landing-v2.css';

type AuthShellProps = {
  /** Kept for API compatibility; the card no longer shows a label above the title. */
  eyebrow?: string;
  title: string;
  description?: string;
  /** Kept for API compatibility; the card no longer shows an icon. */
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
};

/**
 * Every sign-in flow (login, sign-up, reset, invite, SSO): an anthracite band like the site's page
 * heads, and one rounded card centred on its edge. The form is in the first paint; it only settles.
 */
export function AuthShell({ title, description, children, footer }: AuthShellProps) {
  return (
    <div className="rf-auth-shell rfx relative flex min-h-screen flex-col">
      <div aria-hidden className="x-cone absolute inset-x-0 top-0 h-[300px] sm:h-[340px]" />
      <header className="relative mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 text-[var(--x-chrome-fg)] sm:px-8">
        <BrandMark href="/" tone="light" />
        <nav aria-label="Site" className="flex items-center gap-1 text-[13px]">
          <Link href="/security" className="hidden items-center gap-1.5 rounded-[var(--x-r-control)] px-3 py-1.5 text-[var(--x-chrome-muted)] transition-colors hover:bg-white/[0.07] hover:text-[var(--x-chrome-fg)] sm:flex"><ShieldCheck size={14} aria-hidden /> Güvenlik</Link>
          <Link href="/" className="flex items-center gap-1.5 rounded-[var(--x-r-control)] px-3 py-1.5 text-[var(--x-chrome-muted)] transition-colors hover:bg-white/[0.07] hover:text-[var(--x-chrome-fg)]"><ArrowLeft size={14} aria-hidden /> Ana sayfa</Link>
        </nav>
      </header>

      <main className="relative flex flex-1 flex-col items-center px-4 pb-10 pt-6 sm:pt-12">
        <div className="x-rise w-full max-w-[440px] rounded-[22px] bg-[var(--x-surface)] p-7 text-[var(--x-ink)] shadow-[var(--x-shadow-window)] sm:p-10">
          <h1 className="x-display text-[28px] leading-tight">{title}</h1>
          {description && <p className="mt-2 text-[14.5px] leading-6 text-[var(--x-muted)]">{description}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 border-t border-[var(--x-line)] pt-6 text-[13.5px] leading-6 text-[var(--x-muted)]">{footer}</div>}
        </div>
        <nav aria-label="Yasal" className="x-rise x-rise-3 mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[12.5px] text-[var(--x-muted)]">
          <Link href="/privacy" className="x-link hover:text-[var(--x-ink)]">Gizlilik</Link>
          <Link href="/terms" className="x-link hover:text-[var(--x-ink)]">Kullanım koşulları</Link>
          <Link href="/status" className="x-link hover:text-[var(--x-ink)]">Sistem durumu</Link>
          <Link href="/contact" className="x-link hover:text-[var(--x-ink)]">Destek</Link>
        </nav>
      </main>
    </div>
  );
}
