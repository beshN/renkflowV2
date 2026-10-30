import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { MarketingShell } from '@/components/app-core/MarketingShell';
import { blogPosts } from '@/lib/core/marketing-content';

export function generateStaticParams() {
  return blogPosts.map((post) => ({ id: post.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const post = blogPosts.find((item) => item.id === id);
  if (!post) return { title: 'Yazı bulunamadı' };
  return {
    title: post.title,
    description: post.summary,
    alternates: { canonical: `/blog/${post.id}` },
    openGraph: { type: 'article', title: post.title, description: post.summary, url: `/blog/${post.id}` },
  };
}

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
    <MarketingShell badge="Blog" title={post.title} description={post.summary}>
      <article className="mx-auto max-w-[66ch]">
        <p className="text-[13px] text-[var(--x-muted)]">{post.category} · {post.date} · {post.author}</p>
        <div className="mt-8 space-y-6 text-[17px] leading-[1.8] text-[var(--x-ink-2)]">
          {post.content.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>
        <Link href="/blog" className="group mt-14 inline-flex items-center gap-1.5 text-[14px] font-medium">
          <ArrowLeft size={15} className="transition-transform duration-200 group-hover:-translate-x-0.5" /> <span className="x-link">Tüm yazılar</span>
        </Link>
      </article>
    </MarketingShell>
  );
}
