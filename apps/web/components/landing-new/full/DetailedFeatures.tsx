'use client';

import { AlertTriangle, TimerReset, Wrench } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from '@/lib/i18n/client';
import { getLandingCopy } from './copy';

const ICONS = [TimerReset, AlertTriangle, Wrench] as const;

export const DetailedFeatures: React.FC = () => {
  const { locale, isRtl } = useTranslation();
  const copy = useMemo(() => getLandingCopy(locale), [locale]);

  return (
    <section id="use-cases" className="py-16 lg:py-20">
      <div className="rf-page-wrap">
        <div className={isRtl ? 'text-right' : 'text-left'}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
            {copy.useCases.overline}
          </p>
          <h2 className="mt-3 max-w-3xl text-3xl font-bold text-slate-950 dark:text-white sm:text-4xl">
            {copy.useCases.title}
          </h2>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {copy.useCases.items.map((item, index) => {
            const Icon = ICONS[index] || TimerReset;
            return (
              <article
                key={item.title}
                className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white/95 p-6 dark:border-slate-800 dark:bg-slate-900/85"
              >
                <div className="inline-flex w-fit rounded-xl bg-slate-100 p-2.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <Icon className="h-5 w-5" />
                </div>

                <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{item.description}</p>

                <ul className="mt-5 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  {item.bullets.map((bullet) => (
                    <li key={bullet} className={isRtl ? 'flex flex-row-reverse items-start gap-2 text-right' : 'flex items-start gap-2 text-left'}>
                      <span className="mt-[2px] text-sky-500">•</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};
