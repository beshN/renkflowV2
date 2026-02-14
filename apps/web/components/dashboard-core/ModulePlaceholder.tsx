'use client';

import Link from 'next/link';
import { ArrowRight, Compass, Rocket } from 'lucide-react';

import { Navbar } from '@/components/layout/Navbar';
import { DASHBOARD_QUICK_LINKS } from '@/lib/core/dashboard-nav';

interface ModulePlaceholderProps {
  title: string;
  description: string;
}

export function ModulePlaceholder({ title, description }: ModulePlaceholderProps) {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-slate-50/50 dark:bg-slate-950/50">
      <Navbar title={title} showSearch={false} />

      <main className="w-full flex-1 p-4 md:p-8">
        <section className="rf-panel rounded-2xl p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">RenkFlow Modul Altyapisi</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">{description}</p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <article className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                <Compass size={16} />
                <p className="text-sm font-semibold">Bu modül ne amaçla var?</p>
              </div>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Sayfa temeli hazırlandı ve ürün diline uyumlu hale getirildi. Sonraki adımda bu alan canlı veri ve rol bazlı aksiyonlarla tamamlanacak.
              </p>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                <Rocket size={16} />
                <p className="text-sm font-semibold">Bir sonraki sprint hedefi</p>
              </div>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Bu modül, ortak tasarım tokenları ve merkezi içerik modeli ile uyumlu olduğu için yeni özellikler kontrollü ve düşük riskle genişletilebilir.
              </p>
            </article>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DASHBOARD_QUICK_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center justify-between rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-slate-100"
              >
                <span>{item.label}</span>
                <ArrowRight size={16} className="opacity-60 transition group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
