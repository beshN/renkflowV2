'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';

export const Testimonials: React.FC = () => {
  return (
    <section className="py-24 md:py-32 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden -z-10 bg-slate-50/60 dark:bg-slate-900/30">
         <div className="absolute top-[10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-sky-500/10 blur-[120px]" />
         <div className="absolute bottom-[0%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/10 blur-[120px]" />
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-16 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300"
          >
            Referanslar
          </motion.p>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-6 text-4xl md:text-5xl font-bold text-slate-900 dark:text-white"
          >
            Müşterilerimiz Ne Diyor?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-lg text-slate-600 dark:text-slate-400"
          >
            Ekiplerin karar alma hızını artıran, netlik sağlayan ve işleri sadeleştiren bir deneyim.
          </motion.p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            whileHover={{ y: -5 }}
            className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-lg p-8 rounded-3xl shadow-[0_20px_45px_-35px_rgba(15,23,42,0.4)] border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between"
          >
            <div className="mb-6">
                <div className="flex gap-1 mb-4 text-amber-400 text-sm">
                    {'★★★★★'}
                </div>
                <p className="text-lg text-slate-800 dark:text-slate-200">&quot;Renkflow, ekibimizin proje teslim hızını iki katına çıkardı. Artık her şey daha organize ve şeffaf.&quot;</p>
            </div>
            <div className="flex items-center mt-auto">
              <Image 
                src="https://ui-avatars.com/api/?name=Azse+V&background=0284c7&color=fff" 
                alt="Azse V." 
                width={48} 
                height={48} 
                className="rounded-full mr-4 object-cover border border-slate-200 dark:border-slate-700"
                unoptimized
              />
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Azse V.</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Proje Müdürü, X97 Corp.</p>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            whileHover={{ scale: 1.05 }}
            className="bg-gradient-to-br from-sky-600 via-blue-600 to-emerald-600 text-white p-8 rounded-3xl shadow-2xl shadow-sky-500/20 flex flex-col justify-between scale-100 md:scale-105 relative overflow-hidden"
          >
             {/* Shine effect */}
             <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-white opacity-10 blur-3xl rounded-full pointer-events-none"></div>

            <div className="mb-6 relative z-10">
                <div className="flex gap-1 mb-4 text-yellow-300 text-sm">
                    {'★★★★★'}
                </div>
                <p className="text-lg">&quot;Daha önce kullandığımız tüm araçları tek bir platformda birleştirdi. Verimliliğimizdeki artış inanılmaz.&quot;</p>
            </div>
            <div className="flex items-center mt-auto relative z-10">
              <Image 
                src="https://ui-avatars.com/api/?name=Soma+N&background=10b981&color=fff" 
                alt="Soma N." 
                width={48} 
                height={48} 
                className="rounded-full mr-4 border-2 border-white/30 object-cover"
                unoptimized
              />
              <div>
                <p className="font-bold">Soma N.</p>
                <p className="text-sm opacity-80">CEO, S12 Corp.</p>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            whileHover={{ y: -5 }}
            className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-lg p-8 rounded-3xl shadow-[0_20px_45px_-35px_rgba(15,23,42,0.4)] border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between"
          >
             <div className="mb-6">
                <div className="flex gap-1 mb-4 text-amber-400 text-sm">
                    {'★★★★★'}
                </div>
                <p className="text-lg text-slate-800 dark:text-slate-200">&quot;Yaratıcı ekibimiz için mükemmel bir araç. Fikir paylaşımı ve geri bildirim süreci hiç bu kadar kolay olmamıştı.&quot;</p>
             </div>
            <div className="flex items-center mt-auto">
              <Image 
                src="https://ui-avatars.com/api/?name=Lama+L&background=7c3aed&color=fff" 
                alt="Lama L." 
                width={48} 
                height={48} 
                className="rounded-full mr-4 object-cover border border-slate-200 dark:border-slate-700"
                unoptimized
              />
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Lama L.</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Tasarım Lideri, 017 Companies</p>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
};
