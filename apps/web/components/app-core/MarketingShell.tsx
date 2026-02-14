import Link from 'next/link';
import type { ReactNode } from 'react';

type ShellAction = {
  href: string;
  label: string;
  variant?: 'primary' | 'secondary';
};

type MarketingShellProps = {
  badge?: string;
  title: string;
  description: string;
  actions?: ShellAction[];
  spotlight?: Array<{ label: string; value: string }>;
  children?: ReactNode;
};

export function MarketingShell({
  badge,
  title,
  description,
  actions = [],
  spotlight = [],
  children,
}: MarketingShellProps) {
  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_10%,rgba(180,83,9,0.18),transparent_40%),radial-gradient(circle_at_15%_75%,rgba(15,23,42,0.08),transparent_45%)]" />

      <section className="relative mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white/90 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
          <div className="grid gap-6 p-6 md:grid-cols-[1.35fr_0.65fr] md:p-10">
            <div>
              {badge ? (
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300">
                  {badge}
                </p>
              ) : null}

              <h1 className="mt-3 text-3xl font-bold leading-tight text-slate-900 sm:text-4xl dark:text-slate-100">
                {title}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
                {description}
              </p>

              {actions.length > 0 ? (
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  {actions.map((action) => (
                    <Link
                      key={`${action.href}-${action.label}`}
                      href={action.href}
                      className={
                        action.variant === 'secondary'
                          ? 'inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900'
                          : 'inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400'
                      }
                    >
                      {action.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>

            <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/40">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Operasyon Spotu</p>
              {spotlight.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {spotlight.map((item) => (
                    <div key={`${item.label}-${item.value}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{item.value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                  Ürün metinleri ve sayfa hiyerarşisi merkezi içerik modeliyle yönetilir.
                </p>
              )}
            </aside>
          </div>
        </div>

        {children ? <div className="mt-6">{children}</div> : null}
      </section>
    </div>
  );
}
