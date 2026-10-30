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
      <div className="border-t border-[var(--x-line)]">
        {blogPosts.map((post) => (
          <Link key={post.id} href={`/blog/${post.id}`} className="group relative grid gap-2 border-b border-[var(--x-line)] py-8 transition-colors duration-200 hover:bg-[var(--x-surface)]/60 md:-mx-4 md:grid-cols-[180px_1fr_auto] md:gap-8 md:px-4">
            <p className="text-[13px] text-[var(--x-muted)]">{post.category} · {post.date}</p>
            <div>
              <h2 className="x-display text-[22px] leading-snug"><span className="x-link">{post.title}</span></h2>
              <p className="mt-2 max-w-2xl text-[15px] leading-[1.7] text-[var(--x-muted)]">{post.summary}</p>
            </div>
            <ArrowUpRight size={18} className="hidden text-[var(--x-faint)] transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--x-ink)] md:block" />
          </Link>
        ))}
      </div>
    </MarketingShell>
  );
}
