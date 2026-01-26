'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';

export const DetailedFeatures: React.FC = () => {
  return (
    <section className="py-24 md:py-32">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <motion.div 
               initial={{ opacity: 0, x: -20 }}
               whileInView={{ opacity: 1, x: 0 }}
               viewport={{ once: true }}
               className="flex items-start space-x-6"
            >
              <div className="bg-blue-50 dark:bg-blue-600/10 text-blue-600 w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0">
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
              <div className="bg-blue-50 dark:bg-blue-600/10 text-blue-600 w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0">
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
              <div className="bg-blue-50 dark:bg-blue-600/10 text-blue-600 w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0">
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
            className="p-2 bg-white dark:bg-slate-800/50 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700"
          >
            <Image 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAvJDrdlgOwZq0gD7XOVJlVf69Yhqk1lgjeiswgVQL5vBhXrQHTlo4p2Fp6lgonsyyhu0msF395XtqB0dj16AYx2PfBLSCydbhkmeZ7EBmjFksFmZEf-knvrvQwVTF-wW0FC5RxljmSwxq7AfJG7itxY9maEtkUgEaSoKleKvV1ACFzjj_frI0PeHeWhzPtzIBM1mm_MEeoEouMozdyNp3tQcjIRwRRr28krjTo1lpwEyvwOJs75xaynmcCN1DZYrHnpNwnvT2W5me0" 
                alt="Detailed dashboard view" 
                width={800}
                height={600}
                className="rounded-2xl"
                unoptimized
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
};
