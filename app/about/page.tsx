'use client';

import { motion } from 'framer-motion';
import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 }
};

export default function About() {
  const values = [
    { icon: 'groups', title: 'İşbirliği', desc: 'Birlikte daha iyi olduğumuza inanıyoruz.' },
    { icon: 'lightbulb', title: 'Yenilik', desc: 'Sürekli olarak gelişmenin ve iyile şmenin yollarını arıyoruz.' },
    { icon: 'verified_user', title: 'Şeffaflık', desc: 'Açık iletişim ve dürüstlükle güven inşa ediyoruz.' },
    { icon: 'sentiment_satisfied', title: 'Kullanıcı Odaklılık', desc: 'Kullanıcılarımız kararlarımızın merkezindedir.' },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <LandingNav />

      <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {/* Hero */}
        <section className="py-20 lg:py-32 container mx-auto px-4 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black mb-6">
              Ekiplerin Birlikte Çalışma Şeklini Değiştiriyoruz
            </h1>
            <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Yenilikçi verimlilik platformumuzun ardındaki hikaye, misyon ve tutkulu ekip hakkında daha fazla bilgi edinin.
            </p>
          </motion.div>
        </section>

        {/* Story */}
        <section className="py-16 lg:py-24 bg-gray-50 dark:bg-gray-900/50">
          <div className="container mx-auto px-4 max-w-5xl">
            <motion.div
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              variants={{ animate: { transition: { staggerChildren: 0.2 } } }}
              className="flex flex-col md:flex-row items-center gap-12"
            >
              <motion.div variants={fadeIn} className="flex-1">
                <h2 className="text-3xl font-bold mb-4">Yolculuğumuz ve Hikayemiz</h2>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  Renkflow basit bir fikirden doğdu: proje yönetimi bir angarya değil, sezgisel, görsel ve işbirlikçi olmalıdır. Ekiplerin aşırı karmaşık araçlarla mücadele ettiğini gördük ve iş akışlarını kolaylaştıran, iletişimi teşvik eden ve her üyenin en iyi işlerini zahmetsizce başarmasını sağlayan bir plat form oluşturmak için yola çıktık.
                </p>
              </motion.div>
              <motion.div variants={fadeIn} className="flex-1">
                <div className="aspect-video w-full rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 dark:from-primary/30 dark:to-primary/10"></div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Values */}
        <section className="py-16 lg:py-24">
          <div className="container mx-auto px-4 max-w-5xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl font-bold mb-2">Temel Değerlerimiz</h2>
              <p className="text-gray-600 dark:text-gray-400">Yaptığımız her şeye rehberlik eden prensipler.</p>
            </motion.div>

            <motion.div
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              variants={{ animate: { transition: { staggerChildren: 0.1 } } }}
              className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8"
            >
              {values.map((value, i) => (
                <motion.div
                  key={i}
                  variants={fadeIn}
                  whileHover={{ y: -5 }}
                  className="flex flex-col items-center text-center"
                >
                  <div className="w-16 h-16 rounded-full bg-primary/20 dark:bg-primary/30 text-primary flex items-center justify-center mb-4">
                    <span className="material-symbols-outlined text-3xl">{value.icon}</span>
                  </div>
                  <h4 className="font-bold mb-2">{value.title}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{value.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 lg:py-24 bg-primary text-white">
          <div className="container mx-auto px-4 max-w-4xl text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Renkflow Topluluğuna Katılın</h2>
              <p className="text-white/80 mb-8 max-w-2xl mx-auto">
                İş akışınızı iyileştirmeye ve ekibinizin potansiyelini en üst düzeye çıkarmaya bugün başlayın.
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-white text-primary font-bold py-3 px-8 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Hemen Başlayın
              </motion.button>
            </motion.div>
          </div>
        </section>
      </motion.main>

      <LandingFooter />
    </div>
  );
}
