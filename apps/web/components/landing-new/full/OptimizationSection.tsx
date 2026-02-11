'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { TrendingUp } from 'lucide-react';

export const OptimizationSection: React.FC = () => {
  return (
    <section className="py-24 md:py-32 overflow-hidden relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(14,165,233,0.1),transparent_55%),radial-gradient(circle_at_20%_60%,rgba(16,185,129,0.1),transparent_55%)]"
      />
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 relative z-10">
        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-16 items-center">
          <div className="space-y-6">
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:bg-sky-500/10 dark:text-sky-300"
            >
              Akış hızlandırıcı
            </motion.p>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white"
            >
              İş akışınızı görünür, ölçülebilir ve hızlı hale getirin.
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-lg text-slate-600 dark:text-slate-400"
            >
              RenkFlow ile süreçlerinizdeki tıkanma noktalarını keşfedin, ekiplerinizi doğru zamanda doğru işe yönlendirin.
            </motion.p>
            <div className="grid sm:grid-cols-2 gap-4 pt-2">
              {[
                { title: 'Gerçek zamanlı görünürlük', desc: 'Her ekip aynı veriyi görür.' },
                { title: 'Akıllı önceliklendirme', desc: 'Kritik işler öne çıkar.' },
                { title: 'Süreç şeffaflığı', desc: 'Her adım netleşir.' },
                { title: 'Hızlı geri bildirim', desc: 'Kararlar gecikmez.' },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-slate-200/70 bg-white/90 px-4 py-3 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/60">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
          
          <div className="relative group perspective-[1000px]">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="absolute top-[8%] left-[6%] z-20 bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 flex items-center gap-3"
            >
              <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600">
                <TrendingUp size={20} />
              </div>
              <div>
                <p className="text-xs text-slate-500">Takip</p>
                <p className="font-bold text-slate-900 dark:text-white">Canlı Akış</p>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 30, rotateX: 10 }}
              whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="rounded-[32px] bg-gradient-to-br from-sky-200 via-emerald-200 to-white p-[2px] shadow-[0_45px_90px_-60px_rgba(14,165,233,0.7)] transform transition-transform group-hover:scale-[1.01]"
            >
              <div className="bg-white dark:bg-slate-900/80 p-4 md:p-6 rounded-[30px] border border-slate-200/70 dark:border-slate-700/60 backdrop-blur">
                <Image 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuA8xcb_5ay_Dg7O_K8tRw9sIy4zkyfjB1B7FDu7iEydQ7AuOWqP8UXjZ5rmELVbveOOUwx3aPnlv0IugOdKickucfBH7hlXtxAjzYVHI6cUFl9bMrxhe2YoDfJN2ZVkA1kE-bOcvQBVgLNtqbwhvIpJ5NgIE3G01K9crbl8zrxp9XB38F3GSqyxPiDTam76hMwU7GkyZP9qVPcYTakG_DVDMehfSrRKeAG286_Op4BruH5raEKq1H3wRD0TaB28qalc1MTZxBXcNijY" 
                  alt="Optimization diagram" 
                  width={1200}
                  height={600}
                  className="w-full h-auto rounded-2xl shadow-lg"
                  unoptimized
                />
              </div>
            </motion.div>
            
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] h-[55%] bg-sky-500/20 blur-[120px] rounded-full -z-10" />
          </div>
        </div>
      </div>
    </section>
  );
};
