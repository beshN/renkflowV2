'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';

export const FeaturesGrid: React.FC = () => {
  const features = [
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
  ];

  return (
    <section id="features" className="py-24 md:py-32 relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(14,165,233,0.08),transparent_50%),radial-gradient(circle_at_85%_0%,rgba(16,185,129,0.08),transparent_45%)]"
      />
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:bg-sky-500/10 dark:text-sky-300"
          >
            Çözümler
          </motion.p>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-6 text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-6"
          >
            Her Ekip İçin Güçlü Çözümler
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-slate-600 dark:text-slate-400"
          >
            Renkflow, iş akışınızı ne olursa olsun, ekibinizin potansiyelini en üst düzeye çıkarmak için tasarlanmıştır. Sizin için nasıl çalıştığını keşfedin.
          </motion.p>
        </div>
        <div className="mt-16 grid md:grid-cols-3 gap-8 relative z-10">
            {features.map((feature, i) => (
                <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 + 0.2 }}
                    className="group bg-white/90 dark:bg-slate-900/70 p-8 rounded-3xl shadow-[0_20px_40px_-30px_rgba(15,23,42,0.3)] hover:shadow-[0_35px_60px_-35px_rgba(14,165,233,0.45)] hover:-translate-y-2 transition-all duration-300 border border-slate-200/80 dark:border-slate-800 relative overflow-hidden"
                >
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-400 via-blue-500 to-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                    
                    <div className="bg-sky-50 dark:bg-sky-500/10 text-sky-600 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 relative z-10">
                        <span className="material-symbols-outlined !text-3xl">{feature.icon}</span>
                    </div>
                    <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white relative z-10">{feature.title}</h3>
                    <p className="text-slate-600 dark:text-slate-400 mb-6 relative z-10">{feature.desc}</p>
                    <Link href="/features" className="font-semibold text-sky-600 hover:text-emerald-500 flex items-center cursor-pointer relative z-10 transition-colors">
                        Daha Fazla Bilgi <span className="material-symbols-outlined ml-1 group-hover:translate-x-1 transition-transform">arrow_forward</span>
                    </Link>
                </motion.div>
            ))}
        </div>
      </div>
    </section>
  );
};
