'use client';

import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Image from 'next/image';
import Link from 'next/link';

export default function About() {
  const [heroRef, heroInView] = useInView({ triggerOnce: true, threshold: 0.1 });
  const [storyRef, storyInView] = useInView({ triggerOnce: true, threshold: 0.1 });
  const [valuesRef, valuesInView] = useInView({ triggerOnce: true, threshold: 0.1 });

  const values = [
    { icon: 'groups', title: 'İşbirliği', desc: 'Birlikte daha iyi olduğumuza inanıyoruz.' },
    { icon: 'lightbulb', title: 'Yenilik', desc: 'Sürekli olarak gelişmenin ve iyileşmenin yollarını arıyoruz.' },
    { icon: 'verified_user', title: 'Şeffaflık', desc: 'Açık iletişim ve dürüstlükle güven inşa ediyoruz.' },
    { icon: 'sentiment_satisfied', title: 'Kullanıcı Odaklılık', desc: 'Kullanıcılarımız kararlarımızın merkezindedir.' },
  ];

  const team = [
    { name: 'Elif Yılmaz', role: 'CEO & Kurucu Ortak' },
    { name: 'Ahmet Kaya', role: 'CTO & Kurucu Ortak' },
    { name: 'Zeynep Demir', role: 'Tasarım Lideri' },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      
      <main className="flex-grow">
        {/* Hero Section */}
        <motion.section
          ref={heroRef}
          initial={{ opacity: 0, y: 30 }}
          animate={heroInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="w-full py-20 lg:py-32"
        >
          <div className="container mx-auto max-w-5xl px-4 text-center">
            <h1 className="text-4xl font-black leading-tight tracking-tighter sm:text-5xl md:text-6xl text-text-light dark:text-text-dark">
              Ekiplerin Birlikte Çalışma Şeklini Değiştiriyoruz
            </h1>
            <p className="mx-auto max-w-2xl text-base sm:text-lg text-gray-600 dark:text-gray-400 mt-6">
              Yenilikçi verimlilik platformumuzun ardındaki hikaye, misyon ve tutkulu ekip hakkında daha fazla bilgi edinin.
            </p>
          </div>
        </motion.section>

        {/* Story Section */}
        <motion.section
          ref={storyRef}
          initial={{ opacity: 0 }}
          animate={storyInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.8 }}
          className="w-full py-16 lg:py-24 bg-white dark:bg-black/20"
        >
          <div className="container mx-auto max-w-5xl px-4">
            <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={storyInView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="flex-1"
              >
                <h2 className="text-2xl font-bold leading-tight tracking-[-0.015em] text-text-light dark:text-text-dark">
                  Yolculuğumuz ve Hikayemiz
                </h2>
                <p className="mt-4 text-base font-normal leading-relaxed text-gray-600 dark:text-gray-400">
                  Renkflow basit bir fikirden doğdu: proje yönetimi bir angarya değil, sezgisel, görsel ve işbirlikçi olmalıdır. Ekiplerin aşırı karmaşık araçlarla mücadele ettiğini gördük ve iş akışlarını kolaylaştıran, iletişimi teşvik eden ve her üyenin en iyi işlerini zahmetsizce başarmasını sağlayan bir platform oluşturmak için yola çıktık.
                </p>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={storyInView ? { opacity: 1, scale: 1 } : {}}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="flex-1 w-full"
              >
                <div className="aspect-video w-full rounded-xl overflow-hidden relative">
                  <Image
                    src="/team-collaboration.png"
                    alt="Team collaboration"
                    fill
                    className="object-cover"
                  />
                </div>
              </motion.div>
            </div>
          </div>
        </motion.section>

        {/* Mission & Vision Cards */}
        <section className="w-full py-16 lg:py-24">
          <div className="container mx-auto max-w-5xl px-4">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                whileHover={{ y: -5 }}
                className="flex flex-col gap-4 rounded-xl border border-border-light dark:border-border-dark p-6 bg-white dark:bg-black/20"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/20 text-secondary">
                    <span className="material-symbols-outlined">rocket_launch</span>
                  </div>
                  <h3 className="text-xl font-bold">Misyonumuz</h3>
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  Proje yönetimini basitleştirmek ve her yerde, her ekibin kolektif potansiyelini ortaya çıkarmak.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1, duration: 0.6 }}
                whileHover={{ y: -5 }}
                className="flex flex-col gap-4 rounded-xl border border-border-light dark:border-border-dark p-6 bg-white dark:bg-black/20"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/20 text-secondary">
                    <span className="material-symbols-outlined">visibility</span>
                  </div>
                  <h3 className="text-xl font-bold">Vizyonumuz</h3>
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  Her ekibin tam potansiyeline ulaşabildiği ve harika fikirlerin zahmetsizce gerçeğe dönüştüğü bir dünya.
                </p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Core Values */}
        <motion.section
          ref={valuesRef}
          className="w-full py-16 lg:py-24 bg-white dark:bg-black/20"
        >
          <div className="container mx-auto max-w-5xl px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={valuesInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl font-bold leading-tight tracking-[-0.015em] text-text-light dark:text-text-dark">
                Temel Değerlerimiz
              </h2>
              <p className="mt-2 text-gray-600 dark:text-gray-400">Yaptığımız her şeye rehberlik eden prensipler.</p>
            </motion.div>

            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {values.map((value, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  animate={valuesInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: i * 0.1, duration: 0.6 }}
                  whileHover={{ y: -5 }}
                  className="flex flex-col items-center text-center"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 text-primary mb-4">
                    <span className="material-symbols-outlined text-3xl">{value.icon}</span>
                  </div>
                  <h4 className="font-bold">{value.title}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{value.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Team */}
        <section className="w-full py-16 lg:py-24">
          <div className="container mx-auto max-w-5xl px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold leading-tight tracking-[-0.015em] text-text-light dark:text-text-dark">
                Ekiple Tanışın
              </h2>
              <p className="mt-2 text-gray-600 dark:text-gray-400">Renkflow&apos;u mümkün kılan tutkulu beyinler.</p>
            </div>

            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3">
              {team.map((member, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.6 }}
                  whileHover={{ y: -8 }}
                  className="text-center"
                >
                  <div className="aspect-square w-full max-w-xs mx-auto rounded-full bg-gray-300 dark:bg-gray-600 mb-4 overflow-hidden">
                    <div className="w-full h-full flex items-center justify-center text-6xl text-gray-400">
                      {member.name[0]}
                    </div>
                  </div>
                  <h4 className="font-bold text-lg">{member.name}</h4>
                  <p className="text-sm text-primary">{member.role}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="w-full py-16 lg:py-24">
          <div className="container mx-auto max-w-4xl px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="rounded-xl bg-primary text-white p-8 md:p-12 text-center"
            >
              <h2 className="text-3xl font-bold leading-tight tracking-tight">Renkflow Topluluğuna Katılın</h2>
              <p className="mt-2 mx-auto max-w-2xl text-white/80">
                İş akışınızı iyileştirmeye ve ekibinizin potansiyelini en üst düzeye çıkarmaya bugün başlayın.
              </p>
              <Link href="/signup">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="mt-8 bg-white text-primary font-bold py-3 px-8 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Hemen Başlayın
                </motion.button>
              </Link>
            </motion.div>
          </div>
        </section>
      </main>

      
    </div>
  );
}
