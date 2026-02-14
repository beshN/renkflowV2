import Link from 'next/link';
import { notFound } from 'next/navigation';

import { MarketingShell } from '@/components/app-core/MarketingShell';
import { blogPosts } from '@/lib/core/marketing-content';

export default async function BlogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = blogPosts.find((item) => item.id === id);

  if (!post) {
    notFound();
  }

  return (
    <MarketingShell
      badge={post.category}
      title={post.title}
      description={post.summary}
      actions={[
        { href: '/blog', label: 'Blog Listesi' },
        { href: '/signup', label: 'Demo Ortamı Aç', variant: 'secondary' },
      ]}
      spotlight={[
        { label: 'Yazar', value: post.author },
        { label: 'Yayın Tarihi', value: post.date },
        { label: 'Yayın Tipi', value: post.category },
      ]}
    >
      <article className="rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
        {post.content.map((paragraph) => (
          <p key={paragraph} className="mt-4 first:mt-0">
            {paragraph}
          </p>
        ))}
      </article>
      <div className="mt-4">
        <Link href="/blog" className="text-sm font-semibold text-slate-900 hover:underline dark:text-slate-100">
          Blog listesine geri dön
        </Link>
      </div>
    </MarketingShell>
  );
}
