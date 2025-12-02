'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { useInView } from 'react-intersection-observer';
import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';

export default function Pricing() {
  const [billingCycle, setBillingCycle] = useState('monthly');
  
  const [ref1, inView1] = useInView({ triggerOnce: true, threshold: 0.1 });
  const [ref2, inView2] = useInView({ triggerOnce: true, threshold: 0.1 });

  const plans = [
    {
      name: 'Bireysel',
      price: '0 TL',
      period: '/aylık',
      features: [
        'Sınırsız kart',
        '10 adede kadar pano',
        'Temel entegrasyonlar'
      ],
      cta: 'Başlayın',
      popular: false
    },
    {
      name: 'Takım',
      price: '150 TL',
      period: '/kullanıcı/aylık',
      features: [
        'Sınırsız pano',
        'Gelişmiş kontrol listeleri',
        'Zaman çizelgesi görünümü',
        'Misafir erişimi'
      ],
      cta: 'Planı Seç',
      popular: true
    },
    {
      name: 'Kurumsal',
      price: '300 TL',
      period: '/kullanıcı/aylık',
      features: [
        'Tüm Takım özellikleri',
        'Gelişmiş güvenlik',
        'Yönetici kontrolleri',
        'Öncelikli destek'
      ],
      cta: 'Bize Ulaşın',
      popular: false
    }
  ];

  const comparisonFeatures = [
    { feature: 'Panolar', free: '10', team: 'Sınırsız', enterprise: 'Sınırsız' },
    { feature: 'Misafir Erişimi', free: false, team: true, enterprise: true },
    { feature: 'Zaman Çizelgesi Görünümü', free: false, team: true, enterprise: true },
    { feature: 'Öncelikli Destek', free: false, team: false, enterprise: true },
  ];

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-display text-text-light dark:text-text-dark">
      <LandingNav />

      <main className="py-20 container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center max-w-2xl mx-auto mb-12"
        >
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black mb-6 text-text-light dark:text-text-dark">
            Her Takım İçin Uygun Bir Plan
          </h1>
          <p className="text-lg text-text-muted-light dark:text-text-muted-dark">
            Renkflow için şeffaf, karşılaştırılabilir ve farklı kullanıcı ihtiyaçlarına hitap eden fiyatlandırma planlarını keşfedin.
          </p>
        </motion.div>

        {/* Billing Toggle */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="flex w-full max-w-sm mx-auto justify-center py-8"
        >
          <div className="flex h-10 w-full items-center justify-center rounded-lg bg-border-light dark:bg-border-dark p-1">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`flex h-full flex-1 items-center justify-center rounded-md px-2 text-sm font-medium transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-card-light dark:bg-card-dark text-text-light dark:text-text-dark shadow-sm'
                  : 'text-text-muted-light dark:text-text-muted-dark'
              }`}
            >
              Aylık
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`flex h-full flex-1 items-center justify-center rounded-md px-2 text-sm font-medium transition-all ${
                billingCycle === 'yearly'
                  ? 'bg-card-light dark:bg-card-dark text-text-light dark:text-text-dark shadow-sm'
                  : 'text-text-muted-light dark:text-text-muted-dark'
              }`}
            >
              Yıllık (%15 İndirimli)
            </button>
          </div>
        </motion.div>

        {/* Pricing Cards */}
        <motion.div
          ref={ref1}
          className="grid md:grid-cols-3 gap-6"
        >
          {plans.map((plan, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              animate={inView1 ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.15, duration: 0.6 }}
              whileHover={{ y: -8, scale: 1.02 }}
              className={`flex flex-col gap-6 rounded-xl p-6 shadow-sm transition-all ${
                plan.popular
                  ? 'border-2 border-primary bg-card-light dark:bg-card-dark shadow-xl'
                  : 'border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark'
              }`}
            >
              <div className="flex flex-col gap-2">
                {plan.popular && (
                  <p className="rounded-full bg-primary/20 px-3 py-1 text-center text-xs font-medium text-primary self-start">
                    En Popüler
                  </p>
                )}
                <h3 className="text-lg font-bold text-text-light dark:text-text-dark">{plan.name}</h3>
                <p className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-text-light dark:text-text-dark">{plan.price}</span>
                  <span className="text-base font-bold text-text-muted-light dark:text-text-muted-dark">{plan.period}</span>
                </p>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`h-11 w-full rounded-lg px-4 text-sm font-bold transition-colors ${
                  plan.popular
                    ? 'bg-primary text-white hover:bg-primary/90'
                    : 'bg-border-light dark:bg-border-dark text-text-light dark:text-text-dark hover:bg-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                {plan.cta}
              </motion.button>

              <div className="flex flex-col gap-3 border-t border-border-light dark:border-border-dark pt-6">
                {plan.features.map((feature, j) => (
                  <div key={j} className="flex items-center gap-3 text-[13px] text-text-light dark:text-text-dark">
                    <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
                    {feature}
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Comparison Table */}
        <motion.div
          ref={ref2}
          initial={{ opacity: 0, y: 40 }}
          animate={inView2 ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="w-full pt-20"
        >
          <h4 className="py-4 text-center text-sm font-bold uppercase leading-normal tracking-widest text-text-muted-light dark:text-text-muted-dark">
            Planları Karşılaştırın
          </h4>
          
          <div className="mt-4 w-full overflow-x-auto rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark shadow-sm">
            <table className="w-full min-w-[600px] table-fixed text-left text-sm">
              <thead>
                <tr className="border-b border-border-light dark:border-border-dark">
                  <th className="w-2/5 p-4 font-bold text-text-light dark:text-text-dark sm:w-1/3">Özellikler</th>
                  <th className="p-4 text-center font-medium text-text-light dark:text-text-dark">Bireysel</th>
                  <th className="p-4 text-center font-medium text-text-light dark:text-text-dark">Takım</th>
                  <th className="p-4 text-center font-medium text-text-light dark:text-text-dark">Kurumsal</th>
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((item, i) => (
                  <tr key={i} className="border-b border-border-light dark:border-border-dark last:border-0">
                    <td className="p-4 text-text-muted-light dark:text-text-muted-dark">{item.feature}</td>
                    <td className="p-4 text-center text-text-light dark:text-text-dark">
                      {typeof item.free === 'boolean' ? (
                        item.free ? (
                          <span className="material-symbols-outlined text-primary">check</span>
                        ) : (
                          <span className="material-symbols-outlined text-text-muted-light dark:text-text-muted-dark">horizontal_rule</span>
                        )
                      ) : (
                        item.free
                      )}
                    </td>
                    <td className="p-4 text-center text-text-light dark:text-text-dark">
                      {typeof item.team === 'boolean' ? (
                        item.team ? (
                          <span className="material-symbols-outlined text-primary">check</span>
                        ) : (
                          <span className="material-symbols-outlined text-text-muted-light dark:text-text-muted-dark">horizontal_rule</span>
                        )
                      ) : (
                        item.team
                      )}
                    </td>
                    <td className="p-4 text-center text-text-light dark:text-text-dark">
                      {typeof item.enterprise === 'boolean' ? (
                        item.enterprise ? (
                          <span className="material-symbols-outlined text-primary">check</span>
                        ) : (
                          <span className="material-symbols-outlined text-text-muted-light dark:text-text-muted-dark">horizontal_rule</span>
                        )
                      ) : (
                        item.enterprise
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </main>

      <LandingFooter />
    </div>
  );
}
