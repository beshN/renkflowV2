'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export const CTA = () => {
  return (
    <section className="py-16">
      <div className="rf-page-wrap">
        <div className="rounded-3xl border border-slate-200 bg-white/95 p-8 text-center shadow-[0_20px_45px_-35px_rgba(15,23,42,0.38)] dark:border-slate-800 dark:bg-slate-900/85 md:p-10">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
            Plan seçimi ve pilot kapsamı için ekibimizle konuşun
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 dark:text-slate-300">
            Tesis yapınıza uygun rollout planını birlikte belirleyelim. İletişim: info@renkflow.com
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              Satış Ekibiyle Görüş
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500"
            >
              Giriş Yap
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};
