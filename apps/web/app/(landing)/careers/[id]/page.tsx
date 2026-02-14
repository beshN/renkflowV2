import Link from 'next/link';
import { notFound } from 'next/navigation';

import { MarketingShell } from '@/components/app-core/MarketingShell';
import { careers } from '@/lib/core/marketing-content';

export default async function CareerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = careers.find((item) => item.id === id);

  if (!job) {
    notFound();
  }

  return (
    <MarketingShell
      badge="Açık Pozisyon"
      title={job.title}
      description={job.summary}
      actions={[
        { href: '/contact', label: 'Bu Role Başvur' },
        { href: '/careers', label: 'Tüm Pozisyonlar', variant: 'secondary' },
      ]}
      spotlight={[
        { label: 'Takım', value: job.team },
        { label: 'Lokasyon', value: job.location },
        { label: 'Model', value: job.mode },
      ]}
    >
      <article className="rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Sorumluluklar</h2>
        <ul className="mt-3 space-y-2">
          {job.responsibilities.map((item) => (
            <li key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
              {item}
            </li>
          ))}
        </ul>
      </article>
      <div className="mt-4">
        <Link href="/careers" className="text-sm font-semibold text-slate-900 hover:underline dark:text-slate-100">
          Kariyer listesine geri dön
        </Link>
      </div>
    </MarketingShell>
  );
}
