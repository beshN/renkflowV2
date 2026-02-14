import Link from 'next/link';

import { MarketingShell } from '@/components/app-core/MarketingShell';
import { blogPosts } from '@/lib/core/marketing-content';

export default function BlogPage() {
  return (
    <MarketingShell
      badge="Ürün Günlüğü"
      title="RenkFlow geliştirme notları ve sahadan öğrenimler"
      description="Mimari kararları, performans kazanımlarını ve kullanıcı geri bildirimlerinden çıkan iyileştirmeleri düzenli olarak paylaşıyoruz."
      actions={[
        { href: '/changelog', label: 'Sürüm Notları' },
        { href: '/docs', label: 'Dokümantasyon', variant: 'secondary' },
      ]}
      spotlight={[
        { label: 'Yayın Frekansı', value: 'Haftalık' },
        { label: 'Kapsam', value: 'Ürün + Altyapı' },
        { label: 'Biçim', value: 'Operasyon Odaklı' },
      ]}
    >
      <div className="grid gap-4">
        {blogPosts.map((post) => (
          <article key={post.id} className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              {post.category} • {post.date} • {post.author}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">{post.title}</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{post.summary}</p>
            <Link href={`/blog/${post.id}`} className="mt-4 inline-flex text-sm font-semibold text-slate-900 hover:underline dark:text-slate-100">
              Detay yazıyı aç
            </Link>
          </article>
        ))}
      </div>
    </MarketingShell>
  );
}
