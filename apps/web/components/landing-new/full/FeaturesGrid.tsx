'use client';

import { Boxes, Factory, Users2 } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from '@/lib/i18n/client';
import { getLandingCopy } from './copy';

const ICONS = [Factory, Boxes, Users2] as const;

export const FeaturesGrid: React.FC = () => {
  const { locale, isRtl } = useTranslation();
  const copy = useMemo(() => getLandingCopy(locale), [locale]);

  return (
    <section id="features" className="py-16 lg:py-20">
      <div className="rf-page-wrap">
        <div className={isRtl ? 'text-right' : 'text-left'}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">
            {copy.features.overline}
          </p>
          <h2 className="mt-3 max-w-3xl text-3xl font-bold text-slate-950 dark:text-white sm:text-4xl">
            {copy.features.title}
          </h2>
          <p className="mt-4 max-w-3xl text-base text-slate-600 dark:text-slate-300 sm:text-lg">
            {copy.features.description}
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {copy.features.cards.map((feature, index) => {
            const Icon = ICONS[index] || Factory;
            return (
              <article
                key={feature.title}
                className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-[0_16px_35px_-30px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-900/80"
              >
                <div className="mb-4 inline-flex rounded-xl bg-sky-50 p-2.5 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{feature.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {feature.description}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};
