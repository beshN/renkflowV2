'use client';

import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';

export default function Features() {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  const allFeatures = [
    { icon: 'grid_view', title: 'Özelleştirilebilir Panolar', desc: 'İş akışınıza mükemmel şekilde uyan panolar, listeler ve kartlarla her projeyi kendinize göre şekillendirin.' },
    { icon: 'bolt', title: 'Güçlü Otomasyon', desc: 'Tekrarlayan görevleri otomatize ederek zaman kazanın ve ekibinizin önemli işlere odaklanmasını sağlayın.' },
    { icon: 'insights', title: 'Gelişmiş Raporlama', desc: 'Proje performansını ve ekip verimliliğini anlamak için derinlemesine analizler ve görsel raporlar alın.' },
    { icon: 'groups', title: 'Ekip İşbirliği', desc: 'Gerçek zamanlı güncellemeler ve yorumlarla ekip üyelerinizle sorunsuz iletişim kurun.' },
    { icon: 'cloud_sync', title: 'Bulut Senkronizasyonu', desc: 'Tüm verileriniz otomatik olarak bulutta senkronize edilir, her yerden erişin.' },
    { icon: 'security', title: 'Kurumsal Güvenlik', desc: 'Verileriniz en yüksek güvenlik standartlarıyla korunur. SOC 2 ve GDPR uyumlu.' },
    { icon: 'integration_instructions', title: 'Entegrasyonlar', desc: 'Favori araçlarınızla sorunsuz entegrasyon. Slack, GitHub, Jira ve daha fazlası.' },
    { icon: 'mobile_friendly', title: 'Mobil Uyum', desc: 'iOS ve Android uygulamalarımızla her yerden çalışın ve ekibinizle senkronizede kalın.' },
    { icon: 'support_agent', title: '7/24 Destek', desc: '24 saat canlı destek ekibimiz her zaman yanınızda. Hızlı ve etkili çözümler.' },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <LandingNav />

      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="py-20 container mx-auto px-4 sm:px-6 lg:px-8"
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black mb-6">
            İhtiyacınız Olan Her Şey
          </h1>
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400">
            Ekibinizi daha verimli hale getiren güçlü özellikler
          </p>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          ref={ref}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {allFeatures.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.1, duration: 0.6 }}
              whileHover={{ y: -8, boxShadow: "0 20px 50px -10px rgba(0,0,0,0.15)" }}
              className="bg-white dark:bg-gray-800/50 p-8 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm"
            >
              <div className="w-14 h-14 rounded-xl bg-primary/10 dark:bg-primary/20 text-primary flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-3xl">{feature.icon}</span>
              </div>
              <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mt-24 bg-primary/10 dark:bg-primary/20 rounded-2xl py-16 px-8 text-center"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Daha Fazlasını Keşfetmeye Hazır Mısınız?</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
            Renkflow&apos;un tüm özelliklerini keşfetmek için hemen ücretsiz deneme başlatın.
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-primary text-white font-bold py-4 px-10 rounded-full shadow-lg hover:shadow-xl transition-shadow"
          >
            Ücretsiz Deneyin
          </motion.button>
        </motion.div>
      </motion.main>

      <LandingFooter />
    </div>
  );
}
