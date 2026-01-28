'use client';

import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';
import LandingNav from '@/components/landing/LandingNav';
import { Footer } from '@/components/landing-new/Footer';

interface JobPosition {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  description: string;
}

const openPositions: JobPosition[] = [
  {
    id: '1',
    title: 'Senior Full-Stack Developer',
    department: 'Mühendislik',
    location: 'İstanbul / Uzaktan',
    type: 'Tam Zamanlı',
    description: 'React, Next.js ve Node.js teknolojileri ile ürün geliştirme ekibimize katılın.'
  },
  {
    id: '2',
    title: 'Product Designer',
    department: 'Tasarım',
    location: 'İstanbul / Uzaktan',
    type: 'Tam Zamanlı',
    description: 'Kullanıcı deneyimini şekillendiren, yenilikçi tasarım çözümleri üretin.'
  },
  {
    id: '3',
    title: 'DevOps Engineer',
    department: 'Mühendislik',
    location: 'Uzaktan',
    type: 'Tam Zamanlı',
    description: 'Cloud altyapımızı yönetin ve CI/CD süreçlerimizi optimize edin.'
  },
  {
    id: '4',
    title: 'Customer Success Manager',
    department: 'Müşteri Başarısı',
    location: 'İstanbul',
    type: 'Tam Zamanlı',
    description: 'Müşterilerimizin başarılı olmalarını sağlayın ve uzun vadeli ilişkiler kurun.'
  },
  {
    id: '5',
    title: 'Content Marketing Specialist',
    department: 'Pazarlama',
    location: 'Uzaktan',
    type: 'Tam Zamanlı',
    description: 'Blog yazıları, e-kitaplar ve sosyal medya içerikleri ile marka bilinirliğimizi artırın.'
  }
];

const benefits = [
  { icon: 'home', title: 'Esnek Çalışma', desc: 'Ofis veya evden çalışma seçeneği' },
  { icon: 'flight', title: 'Sınırsız İzin', desc: 'Sorumlu bir şekilde kullanılan sınırsız yıllık izin' },
  { icon: 'health_and_safety', title: 'Sağlık Sigortası', desc: 'Kapsamlı özel sağlık sigortası' },
  { icon: 'school', title: 'Eğitim Bütçesi', desc: 'Yıllık kişisel gelişim bütçesi' },
  { icon: 'devices', title: 'En İyi Ekipman', desc: 'İstediğiniz MacBook veya PC' },
  { icon: 'celebration', title: 'Şirket Etkinlikleri', desc: 'Düzenli takım buluşmaları ve aktiviteler' }
];

const values = [
  { icon: 'diversity_3', title: 'Çeşitlilik ve Dahil Edicilik', desc: 'Her sesin duyulduğu, farklı perspektiflerin değer gördüğü bir çalışma ortamı.' },
  { icon: 'rocket_launch', title: 'Sürekli Büyüme', desc: 'Öğrenmeye ve gelişmeye adanmış bir ekip. Hatalardan ders çıkarır, başarıları kutlarız.' },
  { icon: 'handshake', title: 'Şeffaflık', desc: 'Açık iletişim ve dürüstlük değerlerimizin temelini oluşturur.' },
  { icon: 'psychology', title: 'Kullanıcı Odaklılık', desc: 'Her kararımızda kullanıcılarımızın ihtiyaçlarını ön planda tutarız.' }
];

function JobCard({ position, index }: { position: JobPosition; index: number }) {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      className="bg-white dark:bg-gray-800/50 rounded-xl p-6 border border-border-light dark:border-border-dark hover:border-primary/50 hover:shadow-lg transition-all group"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-1 rounded">
              {position.department}
            </span>
            <span className="text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded">
              {position.type}
            </span>
          </div>
          <h3 className="text-xl font-bold text-text-light dark:text-text-dark mb-2 group-hover:text-primary transition-colors">
            {position.title}
          </h3>
          <p className="text-subtle-light dark:text-subtle-dark text-sm mb-2">
            {position.description}
          </p>
          <div className="flex items-center gap-2 text-sm text-subtle-light dark:text-subtle-dark">
            <span className="material-symbols-outlined text-lg">location_on</span>
            <span>{position.location}</span>
          </div>
        </div>
        <Link href={`/careers/${position.id}`}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-primary text-white font-bold py-3 px-6 rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap"
          >
            Başvur
          </motion.button>
        </Link>
      </div>
    </motion.div>
  );
}

export default function CareersPage() {
  const [heroRef, heroInView] = useInView({ triggerOnce: true, threshold: 0.1 });
  const [valuesRef, valuesInView] = useInView({ triggerOnce: true, threshold: 0.1 });
  const [benefitsRef, benefitsInView] = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-display">
      <LandingNav />
      
      <main className="pt-32 pb-20">
        {/* Hero Section */}
        <motion.section
          ref={heroRef}
          initial={{ opacity: 0, y: 30 }}
          animate={heroInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl text-center mb-20"
        >
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black mb-6 text-text-light dark:text-text-dark">
            Geleceği Birlikte <span className="text-primary">İnşa Edelim</span>
          </h1>
          <p className="text-lg md:text-xl text-subtle-light dark:text-subtle-dark max-w-3xl mx-auto">
            Renkflow&apos;ta, her gün milyonlarca insanın çalışma şeklini değiştiriyoruz. 
            Tutkulu, yaratıcı ve işbirlikçi ekibimize katılın.
          </p>
        </motion.section>

        {/* Values Section */}
        <section className="bg-surface-light dark:bg-surface-dark py-20 mb-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
            <motion.div
              ref={valuesRef}
              initial={{ opacity: 0, y: 20 }}
              animate={valuesInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl font-bold text-text-light dark:text-text-dark mb-4">
                Değerlerimiz
              </h2>
              <p className="text-subtle-light dark:text-subtle-dark">
                Renkflow kültürünü şekillendiren temel prensipler
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {values.map((value, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  animate={valuesInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="bg-white dark:bg-gray-800/50 rounded-xl p-6 text-center"
                >
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <span className="material-symbols-outlined text-primary text-2xl">{value.icon}</span>
                  </div>
                  <h3 className="font-bold text-text-light dark:text-text-dark mb-2">{value.title}</h3>
                  <p className="text-sm text-subtle-light dark:text-subtle-dark">{value.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl mb-20">
          <motion.div
            ref={benefitsRef}
            initial={{ opacity: 0, y: 20 }}
            animate={benefitsInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-text-light dark:text-text-dark mb-4">
              Yan Haklar
            </h2>
            <p className="text-subtle-light dark:text-subtle-dark">
              Çalışanlarımıza sunduğumuz avantajlar
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((benefit, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                animate={benefitsInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="flex items-start gap-4 p-4"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-primary text-xl">{benefit.icon}</span>
                </div>
                <div>
                  <h3 className="font-bold text-text-light dark:text-text-dark mb-1">{benefit.title}</h3>
                  <p className="text-sm text-subtle-light dark:text-subtle-dark">{benefit.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Open Positions */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-text-light dark:text-text-dark mb-4">
              Açık Pozisyonlar
            </h2>
            <p className="text-subtle-light dark:text-subtle-dark">
              Kariyerinizin bir sonraki adımını bizimle atın
            </p>
          </div>

          <div className="space-y-4">
            {openPositions.map((position, index) => (
              <JobCard key={position.id} position={position} index={index} />
            ))}
          </div>

          {/* No Open Positions Fallback */}
          {openPositions.length === 0 && (
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <span className="material-symbols-outlined text-primary text-4xl">work_off</span>
              </div>
              <h3 className="text-xl font-bold text-text-light dark:text-text-dark mb-2">
                Şu An Açık Pozisyon Yok
              </h3>
              <p className="text-subtle-light dark:text-subtle-dark mb-6">
                Yeni pozisyonlardan haberdar olmak için bize e-posta gönderin.
              </p>
              <a href="mailto:careers@renkflow.com">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-primary text-white font-bold py-3 px-8 rounded-full"
                >
                  CV Gönder
                </motion.button>
              </a>
            </div>
          )}

          {/* Spontaneous Application CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mt-16 text-center bg-primary/10 dark:bg-primary/20 rounded-2xl p-10"
          >
            <h2 className="text-2xl font-bold mb-3 text-text-light dark:text-text-dark">
              Aradığınız pozisyon yok mu?
            </h2>
            <p className="text-subtle-light dark:text-subtle-dark mb-6 max-w-lg mx-auto">
              Yetenekli insanlarla tanışmak bizi heyecanlandırıyor. CV&apos;nizi bize gönderin, 
              uygun bir pozisyon açıldığında sizinle iletişime geçelim.
            </p>
            <a href="mailto:careers@renkflow.com">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-primary text-white font-bold py-3 px-8 rounded-full shadow-lg hover:shadow-xl transition-shadow inline-flex items-center gap-2"
              >
                <span className="material-symbols-outlined">mail</span>
                CV Gönder
              </motion.button>
            </a>
          </motion.div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
