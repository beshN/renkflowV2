'use client';

import Image from 'next/image';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const posts = [
  {
    id: '1',
    title: 'Proje Yönetiminde Kanban Metodolojisinin Gücü',
    category: 'Verimlilik',
    author: 'Elif Yılmaz',
    date: '10 Aralık 2024',
    readTime: '5 dk',
    image: '/feature-project-mgmt.png',
    content: [
      'Kanban, iş akışını görünür kılan ve ekipleri daha öngörülebilir hale getiren bir yönetim yöntemidir.',
      'İşleri görselleştirerek darboğazları kolayca fark edebilir, kapasiteyi doğru yönetebilir ve teslim sürelerini kısaltabilirsiniz.',
      'RenkFlow ile Kanban panolarınızı özelleştirerek sürecinize en uygun akışı kurabilir, otomasyonlarla tekrar eden işleri azaltabilirsiniz.',
    ],
  },
  {
    id: '2',
    title: 'Uzaktan Çalışan Ekipler İçin 10 İletişim İpucu',
    category: 'Uzaktan Çalışma',
    author: 'Ahmet Kaya',
    date: '5 Aralık 2024',
    readTime: '7 dk',
    image: '/team-collaboration.png',
    content: [
      'Uzaktan ekipler için net iletişim protokolleri ve ortak görünürlük hayati önem taşır.',
      'Toplantı ritimleri, yazılı karar kayıtları ve net hedefler iletişim verimini artırır.',
      'RenkFlow ile iş akışı görünürlüğünü artırarak dağınık ekiplerin aynı sayfada kalmasını sağlayabilirsiniz.',
    ],
  },
  {
    id: '3',
    title: 'Agile vs Waterfall: Hangi Metodoloji Size Uygun?',
    category: 'Metodoloji',
    author: 'Zeynep Demir',
    date: '28 Kasım 2024',
    readTime: '10 dk',
    image: '/feature-agile.png',
    content: [
      'Agile hızlı geri bildirim döngülerine odaklanırken, Waterfall daha sabit ve planlı bir yaklaşımdır.',
      'Projenin belirsizlik düzeyi ve müşteri geri bildirimi ihtiyacı yöntemi belirlemede kritik rol oynar.',
      'RenkFlow ile her iki yönteme uygun süreçleri esnek şekilde tasarlayabilirsiniz.',
    ],
  },
  {
    id: '4',
    title: 'Yaratıcı Ekiplerde İş Birliği Araçları',
    category: 'Araçlar',
    author: 'Elif Yılmaz',
    date: '20 Kasım 2024',
    readTime: '6 dk',
    image: '/feature-creative.png',
    content: [
      'Yaratıcı ekipler için net geri bildirim ve hızlı onay akışları en kritik noktadır.',
      'Dosyaları tek yerde toplayarak bilgi kaybını önleyin ve tasarım onay süreçlerini kısaltın.',
      'RenkFlow, yaratıcı ekiplerin görsel iş birliği ihtiyaçları için güçlü araçlar sunar.',
    ],
  },
  {
    id: '5',
    title: 'Sprint Planlaması: Başarılı Bir Sprint İçin Rehber',
    category: 'Agile',
    author: 'Ahmet Kaya',
    date: '15 Kasım 2024',
    readTime: '8 dk',
    image: '/dashboard-preview.png',
    content: [
      'Sprint planlaması, öncelikleri netleştirerek takımın odaklanmasını sağlar.',
      'İyi bir sprint, net hedefler, gerçekçi kapasite planı ve görünür ilerleme sağlar.',
      'RenkFlow ile sprint planlamanızı görsel hale getirip ekip odağını artırabilirsiniz.',
    ],
  },
  {
    id: '6',
    title: 'Otomasyon ile Zaman Kazanmanın Yolları',
    category: 'Verimlilik',
    author: 'Zeynep Demir',
    date: '8 Kasım 2024',
    readTime: '5 dk',
    image: '/feature-project-mgmt.png',
    content: [
      'Otomasyon, tekrarlayan görevleri azaltarak ekiplerin yaratıcı işlere odaklanmasını sağlar.',
      'Tetikleyiciler, bildirimler ve otomatik atamalar süreç hızını artırır.',
      'RenkFlow otomasyonları ile daha az manuel iş, daha çok odak elde edebilirsiniz.',
    ],
  },
];

export default function BlogDetailPage({ params }: { params: { id: string } }) {
  const post = posts.find((item) => item.id === params.id);

  if (!post) {
    return (
      <div className="min-h-screen bg-[#f7f8fb] dark:bg-slate-950 px-6 py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Yazı bulunamadı</h1>
          <p className="mt-4 text-slate-600 dark:text-slate-400">
            Aradığınız içerik mevcut değil. Blog ana sayfasına dönebilir veya bizimle iletişime geçebilirsiniz.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/blog"
              className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Bloga Dön
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:border-sky-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
            >
              İletişime Geç
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fb] dark:bg-slate-950">
      <main className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 pb-24 pt-32">
        <Link href="/blog" className="text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
          ← Bloga geri dön
        </Link>

        <header className="mt-6 grid gap-6 md:grid-cols-[1.1fr_0.9fr] items-center">
          <div>
            <span className="inline-flex items-center rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:bg-sky-500/10 dark:text-sky-300">
              {post.category}
            </span>
            <h1 className="mt-4 text-4xl font-bold text-slate-900 dark:text-white">
              {post.title}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
              <span>{post.author}</span>
              <span>•</span>
              <span>{post.date}</span>
              <span>•</span>
              <span>{post.readTime} okuma</span>
            </div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-slate-200/70 bg-white/80 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.4)] dark:border-slate-800 dark:bg-slate-900/70">
            <Image src={post.image} alt={post.title} fill className="object-cover" />
          </div>
        </header>

        <article className="mt-10 space-y-6 text-lg leading-relaxed text-slate-600 dark:text-slate-300">
          {post.content.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </article>

        <section className="mt-16 rounded-3xl border border-slate-200/70 bg-white/80 p-8 text-center shadow-[0_20px_45px_-30px_rgba(15,23,42,0.4)] dark:border-slate-800 dark:bg-slate-900/70">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Daha fazlası için RenkFlow'u keşfedin
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            İş akışınızı optimize etmek ve ekibinizi hızlandırmak için RenkFlow çözümlerini deneyin.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-sky-600 via-blue-600 to-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_30px_-18px_rgba(184,116,68,0.7)] hover:opacity-90"
            >
              Ücretsiz Başlayın
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:border-sky-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
            >
              Demo Talep Et
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
