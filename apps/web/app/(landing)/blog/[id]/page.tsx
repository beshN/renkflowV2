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
    <MarketingShell badge={`${post.category} · ${post.date}`} title={post.title} description={post.summary}>
      <article className="max-w-2xl text-[16px] leading-8 text-foreground/90">
        {post.content.map((paragraph) => (
          <p key={paragraph} className="mt-6 first:mt-0">{paragraph}</p>
        ))}
        <p className="mt-10 text-[13px] text-muted-foreground">{post.author}</p>
      </article>
      <Link href="/blog" className="mt-12 inline-flex items-center gap-1.5 text-[14px] font-medium hover:underline">
        <ArrowLeft size={15} /> Tüm yazılar
      </Link>
    </MarketingShell>
  );
}
