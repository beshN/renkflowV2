import { notFound } from 'next/navigation';

import { MarketingShell } from '@/components/app-core/MarketingShell';
import { marketingPages, type MarketingPageKey } from '@/lib/core/marketing-content';

type MarketingStandardPageProps = {
  pageKey: MarketingPageKey;
};

export function MarketingStandardPage({ pageKey }: MarketingStandardPageProps) {
  const page = marketingPages[pageKey];

  if (!page) {
    notFound();
  }

  return (
    <MarketingShell
      badge={page.badge}
      title={page.title}
      description={page.description}
      actions={[
        { href: page.primaryCta.href, label: page.primaryCta.label },
        { href: page.secondaryCta.href, label: page.secondaryCta.label, variant: 'secondary' },
      ]}
      spotlight={[
        { label: 'Sayfa', value: pageKey },
        { label: 'Dil', value: 'Kurumsal Türkçe' },
        { label: 'Yapı', value: 'Merkezi İçerik Sözlüğü' },
      ]}
    >
      <div className="grid gap-4 md:grid-cols-3">
        {page.highlights.map((item) => (
          <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{item.detail}</p>
          </article>
        ))}
      </div>
    </MarketingShell>
  );
}
