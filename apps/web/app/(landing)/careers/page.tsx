import Link from 'next/link';

import { MarketingShell } from '@/components/app-core/MarketingShell';
import { careers } from '@/lib/core/marketing-content';

export default function CareersPage() {
  return (
    <MarketingShell
      badge="Kariyer"
      title="RenkFlow ekibinde yüksek sahiplik kültürüyle çalış"
      description="Ürün, tasarım ve platform ekipleri birlikte karar alır, birlikte teslim eder. Açık pozisyonlarımız aşağıda yer alır."
      actions={[
        { href: '/contact', label: 'Başvuru Gönder' },
        { href: '/about', label: 'Kültürümüz', variant: 'secondary' },
      ]}
      spotlight={[
        { label: 'Çalışma Modeli', value: 'Hybrid + Remote' },
        { label: 'Merkez', value: 'Istanbul' },
        { label: 'Yaklaşım', value: 'Ownership' },
      ]}
    >
      <div className="grid gap-4">
        {careers.map((job) => (
          <article key={job.id} className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              {job.team} • {job.location} • {job.mode}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">{job.title}</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{job.summary}</p>
            <Link href={`/careers/${job.id}`} className="mt-4 inline-flex text-sm font-semibold text-slate-900 hover:underline dark:text-slate-100">
              Rol detaylarını gör
            </Link>
          </article>
        ))}
      </div>
    </MarketingShell>
  );
}
