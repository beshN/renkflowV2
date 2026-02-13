'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useTranslation } from '@/lib/i18n/client';
import { getLandingCopy } from './copy';

export const CTASection: React.FC = () => {
  const { locale, isRtl } = useTranslation();
  const copy = useMemo(() => getLandingCopy(locale), [locale]);

  return (
    <section className="py-16 lg:py-20">
      <div className="rf-page-wrap">
        <div className="rounded-3xl border border-slate-200 bg-white/95 p-7 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.38)] dark:border-slate-800 dark:bg-slate-900/90 md:p-10">
          <div className={isRtl ? 'text-right' : 'text-left'}>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
              {copy.cta.title}
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-600 dark:text-slate-300 sm:text-lg">
              {copy.cta.description}
            </p>
          </div>

          <div className={`mt-8 flex flex-wrap gap-3 ${isRtl ? 'justify-end' : 'justify-start'}`}>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              {copy.cta.primary}
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500"
            >
              {copy.cta.secondary}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};
