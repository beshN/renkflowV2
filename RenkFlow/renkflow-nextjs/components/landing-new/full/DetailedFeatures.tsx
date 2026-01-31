'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';

export const DetailedFeatures: React.FC = () => {
  return (
    <section className="py-24 md:py-32 relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(16,185,129,0.08),transparent_55%),radial-gradient(circle_at_90%_20%,rgba(14,165,233,0.08),transparent_50%)]"
      />
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-16 items-center relative z-10">
          <div className="space-y-8">
            <div className="space-y-4">
              <p className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                Akıllı görünüm
              </p>
              <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white">
                Her detay ekibiniz için net.
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400">
                Tek bir ekranda planlama, takip ve raporlama. Ekiplerin aynı tabloyu görmesini sağlayın.
              </p>
            </div>
            <motion.div 
               initial={{ opacity: 0, x: -20 }}
               whileInView={{ opacity: 1, x: 0 }}
               viewport={{ once: true }}
               className="flex items-start space-x-6"
            >
              <div className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined">grid_view</span>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">Özelleştirilebilir Panolar</h3>
                <p className="text-slate-600 dark:text-slate-400">İş akışınıza mükemmel şekilde uyan panolar, listeler ve kartlarla her projeyi kendinize göre şekillendirin.</p>
              </div>
            </motion.div>
            
            <motion.div 
               initial={{ opacity: 0, x: -20 }}
               whileInView={{ opacity: 1, x: 0 }}
               viewport={{ once: true }}
               transition={{ delay: 0.1 }}
               className="flex items-start space-x-6"
            >
              <div className="bg-sky-50 dark:bg-sky-500/10 text-sky-600 w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined">bolt</span>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">Güçlü Otomasyon</h3>
                <p className="text-slate-600 dark:text-slate-400">Tekrarlayan görevleri otomatize ederek zaman kazanın ve ekibinizin önemli işlere odaklanmasını sağlayın.</p>
              </div>
            </motion.div>

            <motion.div 
               initial={{ opacity: 0, x: -20 }}
               whileInView={{ opacity: 1, x: 0 }}
               viewport={{ once: true }}
               transition={{ delay: 0.2 }}
               className="flex items-start space-x-6"
            >
              <div className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined">insights</span>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">Gelişmiş Raporlama</h3>
                <p className="text-slate-600 dark:text-slate-400">Proje performansını ve ekip verimliliğini anlamak için derinlemesine analizler ve görsel raporlar alın.</p>
              </div>
            </motion.div>
          </div>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="p-[2px] rounded-[32px] bg-gradient-to-br from-emerald-200 via-sky-200 to-white shadow-[0_40px_80px_-50px_rgba(16,185,129,0.6)]"
          >
            <div className="bg-white dark:bg-slate-900/80 rounded-[30px] border border-slate-200/70 dark:border-slate-700/60 p-3 backdrop-blur">
              <Image 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAvJDrdlgOwZq0gD7XOVJlVf69Yhqk1lgjeiswgVQL5vBhXrQHTlo4p2Fp6lgonsyyhu0msF395XtqB0dj16AYx2PfBLSCydbhkmeZ7EBmjFksFmZEf-knvrvQwVTF-wW0FC5RxljmSwxq7AfJG7itxY9maEtkUgEaSoKleKvV1ACFzjj_frI0PeHeWhzPtzIBM1mm_MEeoEouMozdyNp3tQcjIRwRRr28krjTo1lpwEyvwOJs75xaynmcCN1DZYrHnpNwnvT2W5me0" 
                  alt="Detailed dashboard view" 
                  width={800}
                  height={600}
                  className="rounded-2xl"
                  unoptimized
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
