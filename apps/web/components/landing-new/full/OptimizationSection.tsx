'use client';

import { useMemo } from 'react';
import { useTranslation } from '@/lib/i18n/client';
import { getLandingCopy } from './copy';

function stateClass(state: string): string {
  if (state === 'critical') {
    return 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300';
  }
  if (state === 'warning') {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
  }
  return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
}

export const OptimizationSection: React.FC = () => {
  const { locale, isRtl } = useTranslation();
  const copy = useMemo(() => getLandingCopy(locale), [locale]);
  const labels = useMemo(() => {
    if (locale === 'ar') {
      return {
        stage: 'المرحلة',
        plan: 'الخطة',
        actual: 'الفعلي',
        status: 'الحالة',
        critical: 'حرج',
        warning: 'تحذير',
        ok: 'طبيعي',
      };
    }
    if (locale === 'en') {
      return {
        stage: 'Stage',
        plan: 'Plan',
        actual: 'Actual',
        status: 'Status',
        critical: 'Critical',
        warning: 'Warning',
        ok: 'OK',
      };
    }
    return {
      stage: 'Aşama',
      plan: 'Plan',
      actual: 'Gerçekleşen',
      status: 'Durum',
      critical: 'Kritik',
      warning: 'Uyarı',
      ok: 'Normal',
    };
  }, [locale]);

  return (
    <section className="py-16 lg:py-20">
      <div className="rf-page-wrap">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div className={isRtl ? 'text-right' : 'text-left'}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700 dark:text-indigo-300">
              {copy.timeline.overline}
            </p>
            <h2 className="mt-3 text-3xl font-bold text-slate-950 dark:text-white sm:text-4xl">{copy.timeline.title}</h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-300 sm:text-lg">
              {copy.timeline.description}
            </p>
            <p className="mt-6 rounded-xl border border-slate-200 bg-white/85 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300">
              {copy.timeline.footer}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-[0_16px_35px_-30px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-900/85 sm:p-6">
            <div className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr] items-center gap-2 border-b border-slate-200 pb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <span>{labels.stage}</span>
              <span className="text-center">{labels.plan}</span>
              <span className="text-center">{labels.actual}</span>
              <span className="text-center">{labels.status}</span>
            </div>

            <div className="space-y-2 pt-3">
              {copy.timeline.rows.map((row) => (
                <div
                  key={row.stage}
                  className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr] items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3 text-sm dark:border-slate-800 dark:bg-slate-950/50"
                >
                  <span className="font-medium text-slate-900 dark:text-slate-100">{row.stage}</span>
                  <span className="text-center text-slate-600 dark:text-slate-300">{row.planned}</span>
                  <span className="text-center text-slate-900 dark:text-slate-100">{row.actual}</span>
                  <span className="flex justify-center">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${stateClass(row.state)}`}>
                      {row.state === 'critical'
                        ? labels.critical
                        : row.state === 'warning'
                          ? labels.warning
                          : labels.ok}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
