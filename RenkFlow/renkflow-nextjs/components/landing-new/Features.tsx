'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Shield, Users, Layers, Workflow, BarChart3 } from 'lucide-react';

export const Features: React.FC = () => {
  const features = [
    {
      icon: Layers,
      title: 'Kanban & Liste Görünümü',
      desc: 'İşlerinizi görselleştirin. Sürükle-bırak Kanban panoları veya detaylı liste görünümleri ile esnek çalışın.'
    },
    {
      icon: Workflow,
      title: 'Güçlü Otomasyonlar',
      desc: 'Tekrarlayan işleri otomatiğe bağlayın. "Sipariş Tamamlandı" ise "Fatura Kes" gibi kurallar tanımlayın.'
    },
    {
      icon: Users,
      title: 'Ekip İşbirliği',
      desc: 'Gerçek zamanlı yorumlar, etiketler ve bildirimler ile ekibinizi senkronize tutun. E-posta trafiğini azaltın.'
    },
    {
      icon: BarChart3,
      title: 'Gelişmiş Raporlama',
      desc: 'Hangi ünite ne kadar üretti? Hangi personel daha verimli? Detaylı grafiklerle işinizi analiz edin.'
    },
    {
      icon: Shield,
      title: 'Kurumsal Güvenlik',
      desc: 'Verileriniz endüstri standardı şifreleme ile korunur. Rol tabanlı yetkilendirme ile kontrol sizde.'
    },
    {
      icon: Zap,
      title: 'Hızlı Entegrasyon',
      desc: 'Muhasebe, CRM ve 3. parti araçlarınıza kolayca bağlanın. API desteği ile sınırları kaldırın.'
    }
  ];

  return (
    <section className="py-24 bg-slate-50 dark:bg-slate-900/50 relative overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-700 to-transparent opacity-50" />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
            <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4"
            >
                İşinizi büyütmek için gereken <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">tüm özellikler tek platformda.</span>
            </motion.h2>
            <motion.p 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="text-lg text-slate-600 dark:text-slate-400"
            >
                Karmaşık süreçleri yönetmek hiç bu kadar kolay olmamıştı. RenkFlow, üretimden satışa yanınızda.
            </motion.p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, i) => (
                <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="p-8 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
                >
                    <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <feature.icon size={24} />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">
                        {feature.title}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                        {feature.desc}
                    </p>
                </motion.div>
            ))}
        </div>

      </div>
    </section>
  );
};
