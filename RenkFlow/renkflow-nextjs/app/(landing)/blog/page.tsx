'use client';

import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  date: string;
  readTime: string;
  image: string;
  featured?: boolean;
}

const blogPosts: BlogPost[] = [
  {
    id: '1',
    title: 'Proje Yönetiminde Kanban Metodolojisinin Gücü',
    excerpt: 'Kanban metodolojisi, iş akışınızı görselleştirerek takımınızın verimliliğini artırmanın en etkili yollarından biridir. Bu yazıda Kanban\'ın temellerini ve nasıl uygulanacağını keşfedin.',
    category: 'Verimlilik',
    author: 'Elif Yılmaz',
    date: '10 Aralık 2024',
    readTime: '5 dk',
    image: '/feature-project-mgmt.png',
    featured: true
  },
  {
    id: '2',
    title: 'Uzaktan Çalışan Ekipler İçin 10 İletişim İpucu',
    excerpt: 'Uzaktan çalışma düzeninde etkili iletişim kurmak zorlu olabilir. İşte takımınızın bağlantıda kalmasını sağlayacak 10 pratik ipucu.',
    category: 'Uzaktan Çalışma',
    author: 'Ahmet Kaya',
    date: '5 Aralık 2024',
    readTime: '7 dk',
    image: '/team-collaboration.png'
  },
  {
    id: '3',
    title: 'Agile vs Waterfall: Hangi Metodoloji Size Uygun?',
    excerpt: 'Proje yönetim metodolojileri arasında seçim yapmak zor olabilir. Bu kapsamlı karşılaştırma, doğru kararı vermenize yardımcı olacak.',
    category: 'Metodoloji',
    author: 'Zeynep Demir',
    date: '28 Kasım 2024',
    readTime: '10 dk',
    image: '/feature-agile.png'
  },
  {
    id: '4',
    title: 'Yaratıcı Ekiplerde İş Birliği Araçları',
    excerpt: 'Tasarım ve yaratıcı ekipler için en iyi iş birliği araçlarını ve bunları nasıl etkili kullanacağınızı keşfedin.',
    category: 'Araçlar',
    author: 'Elif Yılmaz',
    date: '20 Kasım 2024',
    readTime: '6 dk',
    image: '/feature-creative.png'
  },
  {
    id: '5',
    title: 'Sprint Planlaması: Başarılı Bir Sprint İçin Rehber',
    excerpt: 'Etkili sprint planlaması, Agile takımların başarısının anahtarıdır. Sprint planning toplantılarınızı nasıl optimize edebileceğinizi öğrenin.',
    category: 'Agile',
    author: 'Ahmet Kaya',
    date: '15 Kasım 2024',
    readTime: '8 dk',
    image: '/dashboard-preview.png'
  },
  {
    id: '6',
    title: 'Otomasyon ile Zaman Kazanmanın Yolları',
    excerpt: 'Tekrarlayan görevleri otomatize ederek takımınızın değerli zamanını nasıl geri kazanabileceğinizi keşfedin.',
    category: 'Verimlilik',
    author: 'Zeynep Demir',
    date: '8 Kasım 2024',
    readTime: '5 dk',
    image: '/feature-project-mgmt.png'
  }
];

const categories = ['Tümü', 'Verimlilik', 'Uzaktan Çalışma', 'Metodoloji', 'Araçlar', 'Agile'];

function BlogCard({ post, index }: { post: BlogPost; index: number }) {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <motion.article
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      className={`group ${post.featured ? 'md:col-span-2' : ''}`}
    >
      <Link href={`/blog/${post.id}`} className="block">
        <div className={`bg-white/90 dark:bg-slate-900/70 rounded-3xl overflow-hidden border border-slate-200/70 dark:border-slate-800 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.4)] hover:shadow-[0_30px_60px_-40px_rgba(15,23,42,0.55)] transition-all duration-300 ${post.featured ? 'md:flex' : ''}`}>
          <div className={`relative ${post.featured ? 'md:w-1/2 h-64 md:h-auto' : 'h-48'} overflow-hidden`}>
            <Image
              src={post.image}
              alt={post.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute top-4 left-4">
              <span className="bg-slate-900/90 text-white text-xs font-bold px-3 py-1 rounded-full">
                {post.category}
              </span>
            </div>
          </div>
          
          <div className={`p-6 ${post.featured ? 'md:w-1/2 md:p-8 flex flex-col justify-center' : ''}`}>
            <h2 className={`font-bold text-text-light dark:text-text-dark mb-3 group-hover:text-primary transition-colors ${post.featured ? 'text-2xl md:text-3xl' : 'text-xl'}`}>
              {post.title}
            </h2>
            <p className="text-subtle-light dark:text-subtle-dark mb-4 line-clamp-2">
              {post.excerpt}
            </p>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                  {post.author[0]}
                </div>
                <span className="text-subtle-light dark:text-subtle-dark">{post.author}</span>
              </div>
              <div className="flex items-center gap-3 text-subtle-light dark:text-subtle-dark">
                <span>{post.date}</span>
                <span>•</span>
                <span>{post.readTime}</span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}

export default function BlogPage() {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });
  const [activeCategory, setActiveCategory] = useState('Tümü');
  const [visibleCount, setVisibleCount] = useState(4);

  const filteredPosts = useMemo(() => (
    activeCategory === 'Tümü'
      ? blogPosts
      : blogPosts.filter((post) => post.category === activeCategory)
  ), [activeCategory]);

  useEffect(() => {
    setVisibleCount(4);
  }, [activeCategory]);

  const handleLoadMore = () => {
    setVisibleCount((prev) => Math.min(prev + 4, filteredPosts.length));
  };

  const handleSubscribe = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') || '').trim();
    if (!email) return;

    const params = new URLSearchParams({
      subject: 'Renkflow Blog Bülteni',
      body: `Merhaba,\n\nBlog bültenine abone olmak istiyorum.\nE-posta: ${email}\n`,
    });
    window.location.href = `mailto:newsletter@renkflow.com?${params.toString()}`;
    event.currentTarget.reset();
  };

  return (
    <div className="min-h-screen bg-[#f7f8fb] dark:bg-slate-950 font-display relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(14,165,233,0.12),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.12),transparent_40%)]"
      />
      
      <main className="pt-32 pb-20 container mx-auto px-6 md:px-12 max-w-6xl relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
            İçerikler
          </span>
          <h1 className="mt-6 text-4xl md:text-5xl font-black mb-4 text-text-light dark:text-text-dark">
            Blog
          </h1>
          <p className="text-lg text-subtle-light dark:text-subtle-dark max-w-2xl mx-auto">
            Proje yönetimi, verimlilik ve ekip iş birliği hakkında en güncel içerikleri keşfedin.
          </p>
        </motion.div>

        {/* Category Navigation */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="flex flex-wrap justify-center gap-2 mb-12"
        >
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                activeCategory === category
                  ? 'bg-primary text-white shadow-md'
                  : 'bg-surface-light dark:bg-surface-dark text-subtle-light dark:text-subtle-dark hover:bg-primary hover:text-white'
              }`}
            >
              {category}
            </button>
          ))}
        </motion.div>

        {/* Blog Grid */}
        <div ref={ref} className="grid md:grid-cols-2 gap-8">
          {filteredPosts.slice(0, visibleCount).map((post, index) => (
            <BlogCard key={post.id} post={post} index={index} />
          ))}
        </div>

        {/* Load More */}
        {visibleCount < filteredPosts.length && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="text-center mt-12"
          >
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="inline-block">
              <Button variant="outline" size="lg" onClick={handleLoadMore}>
                Daha Fazla Yükle
                <span className="material-symbols-outlined">expand_more</span>
              </Button>
            </motion.div>
          </motion.div>
        )}

        {/* Newsletter CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mt-20 bg-gradient-to-r from-primary to-primary/80 rounded-2xl p-10 text-center text-white"
          id="newsletter"
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            Her Hafta En Yeni İçerikler
          </h2>
          <p className="text-white/80 mb-6 max-w-xl mx-auto">
            Bültenimize abone olun ve proje yönetimi dünyasındaki en güncel trendleri kaçırmayın.
          </p>
          <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
            <Input
              type="email"
              name="email"
              placeholder="E-posta adresiniz"
              className="flex-1 rounded-full bg-white/95 text-slate-900 placeholder:text-slate-500 focus-visible:ring-white/40"
            />
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button type="submit" variant="ghost" size="lg" className="rounded-full bg-white text-primary hover:bg-slate-100">
                Abone Ol
              </Button>
            </motion.div>
          </form>
        </motion.div>
      </main>

    </div>
  );
}
