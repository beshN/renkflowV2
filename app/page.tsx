'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-display antialiased">
      <LandingNav />
      
      {/* Hero Section */}
      <motion.section
        initial="initial"
        animate="animate"
        variants={staggerContainer}
        className="py-24 md:py-32 container mx-auto px-4 sm:px-6 lg:px-8"
      >
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <motion.div variants={fadeIn} className="text-center md:text-left relative z-10">
            <motion.h1
              variants={fadeIn}
              className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 dark:text-white leading-tight"
            >
              Zirveye Ulaşın: İş Akışınızı <span className="text-primary">Renkflow</span> ile Dönüştürün.
            </motion.h1>
            
            <motion.p
              variants={fadeIn}
              className="mt-6 text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-xl mx-auto md:mx-0"
            >
              Ekibinizin en iyi işlerini, baştan sona güçlendiren görsel iş birliği aracı. Karmaşayı netliğe, fikirleri gerçeğe dönüştürün.
            </motion.p>

            <motion.div
              variants={fadeIn}
              className="mt-10 flex items-center justify-center md:justify-start space-x-4"
            >
              <Link href="/signup">
                <motion.button
                  whileHover={{ scale: 1.05, boxShadow: "0px 15px 35px -5px rgba(67, 97, 238, 0.5)" }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-primary text-white font-bold py-4 px-10 rounded-full transition-all shadow-lg shadow-primary/40 text-lg"
                >
                  Ücretsiz Deneyin
                </motion.button>
              </Link>
              <Link href="/contact" className="font-semibold text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors">
                Demo Talep Et
              </Link>
            </motion.div>
          </motion.div>

          <motion.div
            variants={fadeIn}
            className="relative flex justify-center items-center"
          >
            <div className="absolute inset-0 bg-gradient-radial from-primary/10 to-transparent"></div>
            <motion.div
              whileHover={{ rotate: 0, scale: 1.02 }}
              className="relative bg-white dark:bg-gray-800/50 p-4 rounded-3xl shadow-2xl shadow-primary/20 transform rotate-3 border border-gray-200 dark:border-gray-700"
            >
              <div className="rounded-2xl w-full h-auto max-w-md bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 aspect-video"></div>
            </motion.div>
          </motion.div>
        </div>
      </motion.section>

      {/* Trusted By Section */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        viewport={{ once: true }}
        className="py-12 text-center border-y border-gray-100 dark:border-gray-800"
      >
        <p className="textgray-600 dark:text-gray-400 mb-8 font-medium">Sektör liderlerinin güvendiği platform:</p>
        <div className="container mx-auto px-4 flex flex-wrap justify-center items-center gap-x-12 sm:gap-x-16 gap-y-8 opacity-60 hover:opacity-100 transition-opacity">
          {['Microsoft', 'IBM', 'Spotify', 'ACME', 'Samsung', 'Oracle'].map((company) => (
            <span key={company} className="text-xl font-bold text-gray-800 dark:text-gray-300">
              {company}
            </span>
          ))}
        </div>
      </motion.section>

      {/* Features Section */}
      <section id="features" className="py-24 md:py-32 container m x-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            Her Ekip İçin Güçlü Çözümler
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Renkflow, iş akışınızı ne olursa olsun, ekibinizin potansiyelini en üst düzeye çıkarmak için tasarlanmıştır.
          </p>
        </motion.div>

        <motion.div
          initial="initial"
          whileInView="animate"
          variants={staggerContainer}
          viewport={{ once: true }}
          className="grid md:grid-cols-3 gap-8"
        >
          {[
            { icon: 'stacks', title: 'Proje Yönetimi', desc: 'Görevleri atayın, son tarihleri belirleyin ve projelerinizin ilerlemesini tek bir yerden görsel olarak takip edin.' },
            { icon: 'cycle', title: 'Çevik Geliştirme', desc: 'Sprint planlaması, backlog yönetimi ve Kanban panoları ile çevik metodolojileri kolayca uygulayın.' },
            { icon: 'palette', title: 'Yaratıcı Süreçler', desc: 'Fikir aşamasından son tasarıma kadar tüm yaratıcı projelerinizi ve geri bildirim döngülerini yönetin.' },
          ].map((feature, i) => (
            <motion.div
              key={i}
              variants={fadeIn}
              whileHover={{ y: -8, boxShadow: "0 20px 50px -10px rgba(0,0,0,0.1)" }}
              className="bg-white dark:bg-gray-800/50 p-8 rounded-3xl shadow-sm hover:shadow-2xl transition-all duration-300 border border-gray-100 dark:border-gray-800 group"
            >
              <div className="bg-primary/10 dark:bg-primary/20 text-primary w-14 h-14 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined !text-3xl">{feature.icon}</span>
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">{feature.title}</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">{feature.desc}</p>
              <Link href="/features" className="font-semibold text-primary hover:underline flex items-center group/link">
                Daha Fazla Bilgi
                <span className="material-symbols-outlined ml-1 group-hover/link:translate-x-1 transition-transform">arrow_forward</span>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* CTA Section */}
      <motion.section
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
        className="bg-primary/10 dark:bg-primary/20 rounded-3xl my-24 md:my-32 py-20 px-8 text-center mx-4 sm:mx-6 lg:mx-8"
      >
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            Verimliliğinizi Bugün Artırın
          </h2>
          <p className="mt-6 text-lg text-gray-600 dark:text-gray-400 mb-10">
            Binlerce ekibe katılın ve iş akışınızı Renkflow ile bir sonraki seviyeye taşıyın. Kredi kartı gerekmez.
          </p>
          <Link href="/signup">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-primary text-white font-bold py-4 px-10 rounded-full transition-all shadow-lg shadow-primary/40 text-lg"
            >
              Hemen Ücretsiz Başlayın
            </motion.button>
          </Link>
        </div>
      </motion.section>

      <LandingFooter />
    </div>
  );
}
