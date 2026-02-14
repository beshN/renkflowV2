import Link from 'next/link';

import { MarketingShell } from '@/components/app-core/MarketingShell';
import { blogPosts, careers } from '@/lib/core/marketing-content';

export default function LandingPage() {
  return (
    <MarketingShell
      badge="RenkFlow Platform"
      title="Üretim operasyonlarında dağınıklığı bitiren kurumsal kontrol katmanı"
      description="Yeni sürümde tüm sayfalar, metinler ve akışlar sıfırdan yeniden inşa edildi. Amaç: karar hızını artıran, güvenilir ve ölçeklenebilir bir iş yönetimi deneyimi."
      actions={[
        { href: '/signup', label: 'Kuruluma Başla' },
        { href: '/dashboard', label: 'Canlı Dashboard', variant: 'secondary' },
      ]}
      spotlight={[
        { label: 'Odak', value: 'Operasyon + Finans' },
        { label: 'Sürüm', value: 'Platform Reset 2026' },
        { label: 'Yaklaşım', value: 'Modüler ve Ölçeklenebilir' },
      ]}
    >
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Neden Bu Mimari?</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-400">
            <li className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
              Menü, sayfa ve modül kararları ortak bir içerik sözlüğü ile yönetilir; tutarsız metin kalmaz.
            </li>
            <li className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
              Sipariş ve finans akışları aynı veri mantığına bağlanır; kullanıcı davranışı öngörülebilir hale gelir.
            </li>
            <li className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
              Ön yüzde değişim maliyeti düşer; yeni modül eklemek daha kısa sürede ve daha az riskle tamamlanır.
            </li>
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Hızlı Erişim</h2>
          <div className="mt-4 grid gap-3 text-sm">
            <Link href="/features" className="rounded-xl border border-slate-200 px-4 py-3 font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900">
              Özellik Mimarisini Aç
            </Link>
            <Link href="/integrations" className="rounded-xl border border-slate-200 px-4 py-3 font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900">
              Entegrasyon Stratejisi
            </Link>
            <Link href="/security" className="rounded-xl border border-slate-200 px-4 py-3 font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900">
              Güvenlik Standardı
            </Link>
            <Link href="/pricing" className="rounded-xl border border-slate-200 px-4 py-3 font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900">
              Fiyatlandırma Yapısı
            </Link>
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Güncel Yazılar</h2>
            <Link href="/blog" className="text-sm font-semibold text-slate-900 hover:underline dark:text-slate-100">
              Tümünü gör
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {blogPosts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.id}`}
                className="block rounded-xl border border-slate-200 px-4 py-3 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  {post.category} • {post.date}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{post.title}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{post.summary}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Açık Pozisyonlar</h2>
            <Link href="/careers" className="text-sm font-semibold text-slate-900 hover:underline dark:text-slate-100">
              Kariyer sayfası
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {careers.map((job) => (
              <Link
                key={job.id}
                href={`/careers/${job.id}`}
                className="block rounded-xl border border-slate-200 px-4 py-3 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  {job.team} • {job.location} • {job.mode}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{job.title}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{job.summary}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </MarketingShell>
  );
}
