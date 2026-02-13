'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { ArrowRight, Loader2, Mail } from 'lucide-react';
import { DashboardPreview } from '@/components/landing-new/DashboardPreview';
import { useTranslation } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';
import { getLandingCopy, getLandingLocale } from './copy';

export const HeroSection: React.FC = () => {
  const { locale, isRtl } = useTranslation();
  const { resolvedTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const copy = useMemo(() => getLandingCopy(locale), [locale]);
  const visualLocale = useMemo(() => getLandingLocale(locale), [locale]);
  const isDark = resolvedTheme === 'dark';

  const submitWaitlist = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalized = email.trim().toLowerCase();
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
    if (!isValid) {
      setStatus('error');
      return;
    }

    setStatus('loading');
    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalized }),
      });

      if (!response.ok) {
        setStatus('error');
        return;
      }

      setStatus('success');
      setEmail('');
    } catch {
      setStatus('error');
    }
  };

  return (
    <main className="relative min-h-[calc(100svh-5rem)] pt-24 pb-16 lg:pt-28 lg:pb-20">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(59,130,246,0.12),transparent_40%),radial-gradient(circle_at_88%_12%,rgba(14,116,144,0.1),transparent_45%)]"
      />

      <div className="rf-page-wrap">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <section className={cn('max-w-2xl', isRtl && 'text-right lg:justify-self-end')}>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/70 bg-white/85 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 shadow-sm dark:border-sky-500/20 dark:bg-slate-900/80 dark:text-sky-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {copy.hero.badge}
            </div>

            <h1 className="mt-6 text-4xl font-black leading-[1.03] tracking-tight text-slate-950 dark:text-white sm:text-5xl lg:text-6xl">
              {copy.hero.titleTop}
              <span className="mt-2 block bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 bg-clip-text text-transparent">
                {copy.hero.titleAccent}
              </span>
            </h1>

            <p className="mt-6 text-base leading-relaxed text-slate-600 dark:text-slate-300 sm:text-lg">
              {copy.hero.description}
            </p>

            <div className={cn('mt-8 flex flex-wrap gap-3', isRtl && 'justify-end')}>
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                {copy.hero.ctaPrimary}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={() => document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                className="inline-flex items-center rounded-xl border border-slate-300 bg-white/90 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500"
              >
                {copy.hero.ctaSecondary}
              </button>
            </div>

            <form
              id="waitlist"
              onSubmit={submitWaitlist}
              className="mt-8 rounded-2xl border border-slate-200/80 bg-white/90 p-2 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-900/85"
            >
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="relative flex-1">
                  <Mail className={cn('pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400', isRtl ? 'right-3' : 'left-3')} />
                  <input
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (status === 'error') setStatus('idle');
                    }}
                    type="email"
                    autoComplete="email"
                    placeholder={copy.hero.formPlaceholder}
                    className={cn(
                      'h-12 w-full rounded-xl border border-transparent bg-slate-50/80 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:bg-white dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-700',
                      isRtl ? 'pr-10 pl-3 text-right' : 'pl-10 pr-3'
                    )}
                  />
                </label>
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {status === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {copy.hero.formSubmit}
                </button>
              </div>

              <p className="mt-2 px-1 text-xs text-slate-500 dark:text-slate-400">{copy.hero.note}</p>
              {status === 'success' ? (
                <p className="mt-2 px-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">{copy.hero.formSuccess}</p>
              ) : null}
              {status === 'error' ? (
                <p className="mt-2 px-1 text-xs font-medium text-rose-600 dark:text-rose-400">{copy.hero.formError}</p>
              ) : null}
            </form>

            <ul className={cn('mt-6 flex flex-wrap gap-2', isRtl && 'justify-end')}>
              {copy.hero.chips.map((chip) => (
                <li
                  key={chip}
                  className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300"
                >
                  {chip}
                </li>
              ))}
            </ul>
          </section>

          <section className="relative">
            <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-blue-500/10 to-cyan-500/10 blur-2xl" />
            <div className="relative rounded-[2rem] border border-slate-200/80 bg-white/70 p-2 shadow-[0_30px_70px_-45px_rgba(15,23,42,0.55)] dark:border-slate-700/70 dark:bg-slate-950/70">
              <DashboardPreview isDark={isDark} locale={visualLocale} />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
};
