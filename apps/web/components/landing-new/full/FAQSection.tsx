'use client';

import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/client';
import { getLandingCopy } from './copy';
import { cn } from '@/lib/utils';

export const FAQSection: React.FC = () => {
  const { locale, isRtl } = useTranslation();
  const copy = useMemo(() => getLandingCopy(locale), [locale]);
  const [openIndex, setOpenIndex] = useState<number>(0);

  return (
    <section id="faq" className="py-16 lg:py-20">
      <div className="rf-page-wrap">
        <div className={isRtl ? 'text-right' : 'text-left'}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">
            {copy.faq.overline}
          </p>
          <h2 className="mt-3 text-3xl font-bold text-slate-950 dark:text-white sm:text-4xl">{copy.faq.title}</h2>
        </div>

        <div className="mt-8 space-y-3">
          {copy.faq.items.map((item, index) => {
            const open = openIndex === index;
            return (
              <article
                key={item.question}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white/95 dark:border-slate-800 dark:bg-slate-900/85"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(open ? -1 : index)}
                  className={cn(
                    'flex w-full items-center justify-between gap-4 px-5 py-4 text-sm sm:text-base',
                    isRtl && 'flex-row-reverse text-right'
                  )}
                >
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{item.question}</span>
                  <ChevronDown
                    className={cn('h-4 w-4 shrink-0 text-slate-500 transition-transform', open && 'rotate-180')}
                  />
                </button>
                {open ? (
                  <div className={cn('border-t border-slate-200 px-5 py-4 text-sm leading-relaxed text-slate-600 dark:border-slate-800 dark:text-slate-300', isRtl && 'text-right')}>
                    {item.answer}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};
