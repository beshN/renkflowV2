'use client';

import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Image from 'next/image';
import Link from 'next/link';
import LandingNav from '@/components/landing/LandingNav';
import { Footer } from '@/components/landing-new/Footer';

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
        <div className={`bg-white dark:bg-gray-800/50 rounded-2xl overflow-hidden border border-border-light dark:border-border-dark shadow-sm hover:shadow-xl transition-all duration-300 ${post.featured ? 'md:flex' : ''}`}>
          <div className={`relative ${post.featured ? 'md:w-1/2 h-64 md:h-auto' : 'h-48'} overflow-hidden`}>
            <Image
              src={post.image}
              alt={post.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute top-4 left-4">
              <span className="bg-primary text-white text-xs font-bold px-3 py-1 rounded-full">
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

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-display">
      <LandingNav />
      
      <main className="pt-32 pb-20 container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-black mb-4 text-text-light dark:text-text-dark">
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
              className="px-5 py-2 rounded-full text-sm font-medium bg-surface-light dark:bg-surface-dark text-subtle-light dark:text-subtle-dark hover:bg-primary hover:text-white transition-all"
            >
              {category}
            </button>
          ))}
        </motion.div>

        {/* Blog Grid */}
        <div ref={ref} className="grid md:grid-cols-2 gap-8">
          {blogPosts.map((post, index) => (
            <BlogCard key={post.id} post={post} index={index} />
          ))}
        </div>

        {/* Load More */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="text-center mt-12"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="border border-border-light dark:border-border-dark font-bold py-3 px-8 rounded-full hover:bg-surface-light dark:hover:bg-surface-dark transition-colors inline-flex items-center gap-2"
          >
            <span>Daha Fazla Yükle</span>
            <span className="material-symbols-outlined">expand_more</span>
          </motion.button>
        </motion.div>

        {/* Newsletter CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mt-20 bg-gradient-to-r from-primary to-primary/80 rounded-2xl p-10 text-center text-white"
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            Her Hafta En Yeni İçerikler
          </h2>
          <p className="text-white/80 mb-6 max-w-xl mx-auto">
            Bültenimize abone olun ve proje yönetimi dünyasındaki en güncel trendleri kaçırmayın.
          </p>
          <form className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
            <input
              type="email"
              placeholder="E-posta adresiniz"
              className="flex-1 px-5 py-3 rounded-full text-text-light focus:outline-none focus:ring-2 focus:ring-white/50"
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="submit"
              className="bg-white text-primary font-bold py-3 px-8 rounded-full hover:bg-gray-100 transition-colors"
            >
              Abone Ol
            </motion.button>
          </form>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
