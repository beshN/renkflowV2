'use client';

import React, { useState, useEffect } from 'react';
import { motion, useInView } from 'framer-motion';
import { Zap, Shield, Users, Layers, Workflow, BarChart3 } from 'lucide-react';
import { useRef } from 'react';

const CountUp = ({ end, duration = 2 }: { end: number; duration?: number }) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    
    let startTime: number;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / (duration * 1000), 1);
      
      setCount(Math.floor(progress * end));
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration, isInView]);

  return <span ref={ref}>{count.toLocaleString()}</span>;
};

export const Features: React.FC<{ showStats?: boolean }> = ({ showStats = true }) => {
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
    <section className="py-24 relative overflow-hidden" id="features">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-slate-300/70 dark:via-slate-700 to-transparent opacity-60" />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Stats Bar */}
        {showStats && (
          <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-20 p-8 rounded-3xl bg-white/90 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.4)]"
          >
              <div className="text-center">
                  <div className="text-3xl font-bold text-sky-600 mb-1">
                      <CountUp end={500} />+
                  </div>
                  <div className="text-sm text-muted-foreground">Aktif Kullanıcı</div>
              </div>
              <div className="text-center">
                  <div className="text-3xl font-bold text-emerald-600 mb-1">
                      <CountUp end={10000} />+
                  </div>
                  <div className="text-sm text-muted-foreground">Tamamlanan Sipariş</div>
              </div>
              <div className="text-center">
                  <div className="text-3xl font-bold text-indigo-600 mb-1">
                      <CountUp end={98} />%
                  </div>
                  <div className="text-sm text-muted-foreground">Müşteri Memnuniyeti</div>
              </div>
              <div className="text-center">
                  <div className="text-3xl font-bold text-amber-500 mb-1">
                      <CountUp end={24} />/7
                  </div>
                  <div className="text-sm text-muted-foreground">Destek Hizmeti</div>
              </div>
          </motion.div>
        )}

        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
            <motion.p
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:bg-sky-500/10 dark:text-sky-300"
            >
                Ürün Özellikleri
            </motion.p>
            <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="mt-6 text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4"
            >
                İşinizi büyütmek için gereken <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-600 to-emerald-500">tüm özellikler tek platformda.</span>
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
                    className="p-8 rounded-3xl bg-white/90 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.4)] hover:shadow-[0_30px_60px_-40px_rgba(15,23,42,0.55)] hover:-translate-y-2 hover:border-sky-300/80 transition-all duration-300 group relative overflow-hidden"
                >
                    {/* Hover Gradient Effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-sky-500/8 to-emerald-500/8 opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    <div className="relative">
                        <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-500/10 flex items-center justify-center text-sky-600 mb-6 group-hover:bg-sky-600 group-hover:text-white group-hover:scale-110 transition-all">
                            <feature.icon size={24} />
                        </div>
                        <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-3 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                            {feature.title}
                        </h3>
                        <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                            {feature.desc}
                        </p>
                    </div>
                </motion.div>
            ))}
        </div>

      </div>
    </section>
  );
};
