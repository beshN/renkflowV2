'use client';

import React from 'react';
import { motion } from 'framer-motion';

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
    <section id="features" className="py-24 md:py-32">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-6"
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
        <div className="mt-16 grid md:grid-cols-3 gap-8">
            {features.map((feature, i) => (
                <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 + 0.2 }}
                    className="group bg-white dark:bg-slate-800/50 p-8 rounded-3xl shadow-sm hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] hover:-translate-y-2 transition-all duration-300 border border-gray-100 dark:border-gray-800 relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity duration-300 transform translate-x-4 -translate-y-4">
                        <span className="material-symbols-outlined !text-9xl text-blue-500">{feature.icon}</span>
                    </div>
                    
                    <div className="bg-blue-50 dark:bg-blue-600/10 text-blue-600 w-14 h-14 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 relative z-10">
                        <span className="material-symbols-outlined !text-3xl">{feature.icon}</span>
                    </div>
                    <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white relative z-10">{feature.title}</h3>
                    <p className="text-slate-600 dark:text-slate-400 mb-6 relative z-10">{feature.desc}</p>
                    <a className="font-semibold text-blue-600 hover:underline flex items-center cursor-pointer relative z-10">
                        Daha Fazla Bilgi <span className="material-symbols-outlined ml-1 group-hover:translate-x-1 transition-transform">arrow_forward</span>
                    </a>
                </motion.div>
            ))}
        </div>
      </div>
    </section>
  );
};
