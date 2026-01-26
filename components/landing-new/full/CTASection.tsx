'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';

export const CTASection: React.FC = () => {
  return (
    <section className="bg-blue-50 dark:bg-slate-800/50 rounded-3xl my-24 md:my-32 py-20 px-8 text-center max-w-[1400px] mx-auto overflow-hidden">
      <div className="max-w-3xl mx-auto relative z-10">
        <motion.h2 
           initial={{ opacity: 0, scale: 0.9 }}
           whileInView={{ opacity: 1, scale: 1 }}
           viewport={{ once: true }}
           className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white"
        >
          Verimliliğinizi Bugün Artırın
        </motion.h2>
        <motion.p 
           initial={{ opacity: 0, y: 10 }}
           whileInView={{ opacity: 1, y: 0 }}
           viewport={{ once: true }}
           transition={{ delay: 0.1 }}
           className="mt-6 text-lg text-slate-600 dark:text-slate-400"
        >
          Binlerce ekibe katılın ve iş akışınızı Renkflow ile bir sonraki seviyeye taşıyın. Kredi kartı gerekmez.
        </motion.p>
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           whileInView={{ opacity: 1, y: 0 }}
           viewport={{ once: true }}
           transition={{ delay: 0.2 }}
        >
            <Link href="/signup" className="mt-10 inline-block bg-blue-600 text-white font-bold py-4 px-10 rounded-full transition-transform hover:scale-105 shadow-[0_0_40px_0px_rgba(67,97,238,0.3)] text-lg">
              Hemen Ücretsiz Başlayın
            </Link>
        </motion.div>
      </div>
    </section>
  );
};
