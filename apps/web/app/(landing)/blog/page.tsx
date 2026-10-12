import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

import { MarketingShell } from '@/components/app-core/MarketingShell';
import { blogPosts } from '@/lib/core/marketing-content';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Ölçüye özel projelerde kesim, stok ve iş akışı üzerine sahadan öğrendiklerimiz.',
  alternates: { canonical: '/blog' },
};

export default function BlogPage() {
  return (
    <MarketingShell
      badge="Blog"
      title="Üretimden notlar."
      description="Ölçüye özel projelerde kesim, stok ve iş akışı üzerine sahadan öğrendiklerimiz."
      actions={[
        { href: '/changelog', label: 'Sürüm notları' },
        { href: '/docs', label: 'Dokümantasyon', variant: 'secondary' },
      ]}
    >
      <div className="divide-y divide-border border-y border-border">
        {blogPosts.map((post) => (
          <Link key={post.id} href={`/blog/${post.id}`} className="group grid gap-2 py-8 md:grid-cols-[180px_1fr_auto] md:gap-8">
            <p className="text-[13px] text-muted-foreground">{post.category} · {post.date}</p>
            <div>
              <h2 className="text-[19px] font-semibold tracking-[-0.025em] group-hover:underline group-hover:underline-offset-4">{post.title}</h2>
              <p className="mt-2 max-w-2xl text-[14.5px] leading-7 text-muted-foreground">{post.summary}</p>
            </div>
            <ArrowUpRight size={18} className="hidden text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 md:block" />
          </Link>
        ))}
      </div>
    </MarketingShell>
  );
}
