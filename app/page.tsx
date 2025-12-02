'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Image from 'next/image';
import Link from 'next/link';
import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';

// Apple-style animation hook
function useScrollAnimation() {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  return {
    ref,
    initial: { opacity: 0, y: 60 },
    animate: inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 60 },
    transition: { duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }
  };
}

export default function Home() {
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  const section1 = useScrollAnimation();
  const section2 = useScrollAnimation();
  const section3 = useScrollAnimation();
  const section4 = useScrollAnimation();
  const section5 = useScrollAnimation();

  return (
    <div className="bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark font-display transition-colors duration-300 antialiased">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <LandingNav />

        {/* Hero Section - Exact from HTML */}
        <motion.main 
          style={{ y: heroY, opacity: heroOpacity }}
          className="py-24 md:py-32"
        >
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
              className="text-center md:text-left relative z-10"
            >
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-text-light dark:text-text-dark leading-tight">
                Zirveye Ulaşın: İş Akışınızı <span className="text-primary">Renkflow</span> ile Dönüştürün.
              </h1>
              
              <p className="mt-6 text-lg md:text-xl text-subtle-light dark:text-subtle-dark max-w-xl mx-auto md:mx-0">
                Ekibinizin en iyi işlerini, baştan sona güçlendiren görsel iş birliği aracı. Karmaşayı netliğe, fikirleri gerçeğe dönüştürün.
              </p>

              <div className="mt-10 flex items-center justify-center md:justify-start space-x-4">
                <Link href="/signup">
                  <motion.button
                    whileHover={{ scale: 1.05, boxShadow: "0px 15px 35px -5px rgba(67, 97, 238, 0.5)" }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-primary text-white font-bold py-4 px-10 rounded-full transition-transform button-glow text-lg"
                  >
                    Ücretsiz Deneyin
                  </motion.button>
                </Link>
                <Link href="/contact" className="font-semibold text-subtle-light dark:text-subtle-dark hover:text-primary dark:hover:text-primary transition-colors">
                  Demo Talep Et
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative flex justify-center items-center"
            >
              <div className="absolute inset-0 hero-gradient"></div>
              <motion.div
                whileHover={{ rotate: 0, scale: 1.05 }}
                transition={{ duration: 0.6 }}
                className="relative bg-white dark:bg-slate-800/50 p-4 rounded-3xl shadow-glow-primary transform rotate-3 border border-gray-200 dark:border-gray-700"
              >
                <div className="relative w-full h-auto max-w-md aspect-video">
                  <Image
                    src="/dashboard-preview.png"
                    alt="Renkflow application interface"
                    fill
                    className="rounded-2xl object-cover"
                  />
                </div>
              </motion.div>
            </motion.div>
          </div>
        </motion.main>

        {/* Trusted By Section */}
        <motion.section
          {...section1}
          className="py-12 text-center"
        >
          <p className="text-subtle-light dark:text-subtle-dark mb-8 font-medium">Sektör liderlerinin güvendiği platform:</p>
          <div className="flex flex-wrap justify-center items-center gap-x-12 sm:gap-x-16 gap-y-8">
            {['Microsoft', 'IBM', 'Spotify', 'ACME', 'Samsung', 'Oracle'].map((company, i) => (
              <motion.span
                key={company}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                whileHover={{ opacity: 1, scale: 1.1 }}
                className="text-xl font-bold grayscale hover:grayscale-0 transition-all"
              >
                {company}
              </motion.span>
            ))}
          </div>
        </motion.section>

        {/* Features Section */}
        <motion.section
          {...section2}
          className="py-24 md:py-32"
        >
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold text-text-light dark:text-text-dark mb-6">
              Her Ekip İçin Güçlü Çözümler
            </h2>
            <p className="text-lg text-subtle-light dark:text-subtle-dark">
              Renkflow, iş akışınızı ne olursa olsun, ekibinizin potansiyelini en üst düzeye çıkarmak için tasarlanmıştır. Sizin için nasıl çalıştığını keşfedin.
            </p>
          </div>

          <div className="mt-16 grid md:grid-cols-3 gap-8">
            {[
              {
                icon: 'stacks',
                title: 'Proje Yönetimi',
                desc: 'Görevleri atayın, son tarihleri belirleyin ve projelerinizin ilerlemesini tek bir yerden görsel olarak takip edin.'
              },
              {
                icon: 'cycle',
                title: 'Çevik Geliştirme',
                desc: 'Sprint planlaması, backlog yönetimi ve Kanban panoları ile çevik metodolojileri kolayca uygulayın.'
              },
              {
                icon: 'palette',
                title: 'Yaratıcı Süreçler',
                desc: 'Fikir aşamasından son tasarıma kadar tüm yaratıcı projelerinizi ve geri bildirim döngülerini yönetin.'
              }
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.6 }}
                whileHover={{ y: -8, boxShadow: "0 20px 50px -10px rgba(0,0,0,0.15)" }}
                className="bg-white dark:bg-slate-800/50 p-8 rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-800"
              >
                <div className="bg-primary-light dark:bg-primary/10 text-primary w-14 h-14 rounded-xl flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined !text-3xl">{feature.icon}</span>
                </div>
                <h3 className="text-xl font-bold mb-3 text-text-light dark:text-text-dark">{feature.title}</h3>
                <p className="text-subtle-light dark:text-subtle-dark mb-6">{feature.desc}</p>
                <Link href="/features" className="font-semibold text-primary hover:underline flex items-center group">
                  Daha Fazla Bilgi <span className="material-symbols-outlined ml-1 group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* How It Works Section with Image */}
        <motion.section
          {...section3}
          className="py-24 md:py-32"
        >
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              {[
                { icon: 'grid_view', title: 'Özelleştirilebilir Panolar', desc: 'İş akışınıza mükemmel şekilde uyan panolar, listeler ve kartlarla her projeyi kendinize göre şekillendirin.' },
                { icon: 'bolt', title: 'Güçlü Otomasyon', desc: 'Tekrarlayan görevleri otomatize ederek zaman kazanın ve ekibinizin önemli işlere odaklanmasını sağlayın.' },
                { icon: 'insights', title: 'Gelişmiş Raporlama', desc: 'Proje performansını ve ekip verimliliğini anlamak için derinlemesine analiz ler ve görsel raporlar alın.' }
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.6 }}
                  className="flex items-start space-x-6"
                >
                  <div className="bg-primary-light dark:bg-primary/10 text-primary w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined">{item.icon}</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2 text-text-light dark:text-text-dark">{item.title}</h3>
                    <p className="text-subtle-light dark:text-subtle-dark">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="p-2 bg-white dark:bg-slate-800/50 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700"
            >
              <div className="relative aspect-video rounded-2xl overflow-hidden">
                <Image
                  src="/dashboard-preview.png"
                  alt="Detailed dashboard view"
                  fill
                  className="object-cover"
                />
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* Optimize Workflow Section */}
        <motion.section
          {...section4}
          className="py-24 md:py-32"
        >
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold text-text-light dark:text-text-dark">İş Akışınızı Optimize Edin</h2>
            <p className="mt-4 text-xl text-primary font-semibold">Verimliliği %50&apos;ye Kadar Artırın</p>
          </div>
          <div className="mt-16 bg-primary-light dark:bg-primary/10 p-8 md:p-12 rounded-3xl border border-primary/10 dark:border-primary/20">
            <div className="relative aspect-[3/1] rounded-xl overflow-hidden bg-gradient-to-r from-primary/20 to-primary/5">
              {/* Placeholder for workflow diagram */}
              <div className="absolute inset-0 flex items-center justify-center text-primary/20 text-6xl font-bold">
                Workflow Diagram
              </div>
            </div>
          </div>
        </motion.section>

        {/* Testimonials Section */}
        <motion.section
          {...section5}
          className="py-24 md:py-32"
        >
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-text-light dark:text-text-dark">Müşterilerimiz Ne Diyor?</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { name: 'Azse V.', role: 'Proje Müdürü, X97 Corp.', text: '"Renkflow, ekibimizin proje teslim hızını iki katına çıkardı. Artık her şey daha organize ve şeffaf."' },
              { name: 'Soma N.', role: 'CEO, S12 Corp.', text: '"Daha önce kullandığımız tüm araçları tek bir platformda birleştirdi. Verimliliğimizdeki artış inanılmaz."', featured: true },
              { name: 'Lama L.', role: 'Tasarım Lideri, 017 Companies', text: '"Yaratıcı ekibimiz için mükemmel bir araç. Fikir paylaşımı ve geri bildirim süreci hiç bu kadar kolay olmamıştı."' }
            ].map((testimonial, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.6 }}
                className={`p-8 rounded-3xl flex flex-col justify-between ${
                  testimonial.featured 
                    ? 'bg-primary text-white shadow-xl scale-105' 
                    : 'bg-white dark:bg-slate-800/50 shadow-sm border border-gray-100 dark:border-gray-800'
                }`}
              >
                <p className={`text-lg mb-6 ${testimonial.featured ? 'text-white' : 'text-text-light dark:text-text-dark'}`}>
                  {testimonial.text}
                </p>
                <div className="flex items-center mt-auto">
                  <div className="w-12 h-12 rounded-full bg-gray-300 dark:bg-gray-600 mr-4"></div>
                  <div>
                    <p className={`font-bold ${testimonial.featured ? 'text-white' : 'text-text-light dark:text-text-dark'}`}>{testimonial.name}</p>
                    <p className={`text-sm ${testimonial.featured ? 'opacity-80' : 'text-subtle-light dark:text-subtle-dark'}`}>{testimonial.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* CTA Section */}
        <motion.section
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="bg-primary-light dark:bg-slate-800/50 rounded-3xl my-24 md:my-32 py-20 px-8 text-center"
        >
          <div className="max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold text-text-light dark:text-white">
              Verimliliğinizi Bugün Artırın
            </h2>
            <p className="mt-6 text-lg text-subtle-light dark:text-subtle-dark">
              Binlerce ekibe katılın ve iş akışınızı Renkflow ile bir sonraki seviyeye taşıyın. Kredi kartı gerekmez.
            </p>
            <Link href="/signup">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="mt-10 bg-primary text-white font-bold py-4 px-10 rounded-full transition-transform button-glow text-lg"
              >
                Hemen Ücretsiz Başlayın
              </motion.button>
            </Link>
          </div>
        </motion.section>
      </div>

      <LandingFooter />

      <style jsx global>{`
        .hero-gradient {
          background: radial-gradient(circle at 50% 50%, rgba(67, 97, 238, 0.1), transparent 70%);
        }
        .dark .hero-gradient {
          background: radial-gradient(circle at 50% 50%, rgba(67, 97, 238, 0.2), transparent 70%);
        }
        .button-glow {
          box-shadow: 0px 10px 30px -5px rgba(67, 97, 238, 0.4);
        }
        .button-glow:hover {
          box-shadow: 0px 15px 35px -5px rgba(67, 97, 238, 0.5);
        }
      `}</style>
    </div>
  );
}
