'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 }
};

export default function Pricing() {
  const [cycle, setCycle] = useState('monthly');

  const plans = [
    {
      name: 'Bireysel',
      price: '0',
      period: 'aylık',
      features: ['Sınırsız kart', '10 adede kadar pano', 'Temel entegrasyonlar'],
      cta: 'Başlayın',
      popular: false,
    },
    {
      name: 'Takım',
      price: '150',
      period: 'kullanıcı/aylık',
      features: ['Sınırsız pano', 'Gelişmiş kontrol listeleri', 'Zaman çizelgesi görünümü', 'Misafir erişimi'],
      cta: 'Planı Seç',
      popular: true,
    },
    {
      name: 'Kurumsal',
      price: '300',
      period: 'kullanıcı/aylık',
      features: ['Tüm Takım özellikleri', 'Gelişmiş güvenlik', 'Yönetici kontrolleri', 'Öncelikli destek'],
      cta: 'Bize Ulaşın',
      popular: false,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <LandingNav />

      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="py-20 container mx-auto px-4 sm:px-6 lg:px-8"
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto mb- 12"
        >
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black mb-6">
            Her Takım İçin Uygun Bir Plan
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Renkflow için şeffaf, karşılaştırılabilir ve farklı kullanıcı ihtiyaçlarına hitap eden fiyatlandırma planlarını keşfedin.
          </p>
        </motion.div>

        {/* Billing Toggle */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex w-full max-w-sm mx-auto justify-center py-8"
        >
          <div className="flex h-12 w-full items-center justify-center rounded-lg bg-gray-200 dark:bg-gray-800 p-1">
            <button
              onClick={() => setCycle('monthly')}
              className={`flex h-full flex-1 items-center justify-center rounded-md px-2 text-sm font-medium transition-all ${ cycle === 'monthly' ? 'bg-white dark:bg-gray-900 shadow-sm' : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Aylık
            </button>
            <button
              onClick={() => setCycle('yearly')}
              className={`flex h-full flex-1 items-center justify-center rounded-md px-2 text-sm font-medium transition-all ${
                cycle === 'yearly' ? 'bg-white dark:bg-gray-900 shadow-sm' : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Yıllık (%15 İndirimli)
            </button>
          </div>
        </motion.div>

        {/* Pricing Cards */}
        <motion.div
          initial="initial"
          animate="animate"
          variants={{
            animate: {
              transition: { staggerChildren: 0.1 }
            }
          }}
          className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto"
        >
          {plans.map((plan, i) => (
            <motion.div
              key={i}
              variants={fadeIn}
              whileHover={{ y: -8, scale: 1.02 }}
              className={`flex flex-col gap-6 rounded-xl p-6 shadow-sm transition-all ${
                plan.popular
                  ? 'border-2 border-primary bg-white dark:bg-gray-900 shadow-xl shadow-primary/10'
                  : 'border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'
              }`}
            >
              <div className="flex flex-col gap-2">
                {plan.popular && (
                  <p className="rounded-full bg-primary/20 px-3 py-1 text-center text-xs font-medium text-primary self-start mb-2">
                    En Popüler
                  </p>
                )}
                <h3 className="text-lg font-bold">{plan.name}</h3>
                <p className="flex items-baseline gap-1">
                  <span className="text-4xl font-black">{plan.price} TL</span>
                  <span className="text-base font-bold text-gray-500 dark:text-gray-400">/{plan.period}</span>
                </p>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`h-11 w-full rounded-lg px-4 text-sm font-bold transition-colors ${
                  plan.popular
                    ? 'bg-primary text-white hover:bg-primary/90'
                    : 'bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                {plan.cta}
              </motion.button>

              <div className="flex flex-col gap-3 border-t border-gray-200 dark:border-gray-800 pt-6">
                {plan.features.map((feature, j) => (
                  <div key={j} className="flex items-center gap-3 text-[13px]">
                    <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
                    {feature}
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </motion.main>

      <LandingFooter />
    </div>
  );
}
