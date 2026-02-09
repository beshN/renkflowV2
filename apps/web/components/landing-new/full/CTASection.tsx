'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';

export const CTASection: React.FC = () => {
  return (
    <section className="relative my-24 md:my-32 py-20 text-center w-full px-4 sm:px-6 lg:px-12 xl:px-16 overflow-hidden rounded-[36px]">
      
      {/* Animated Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-sky-600 via-blue-600 to-emerald-600 animate-gradient-xy z-0"></div>
      
      {/* Overlay Pattern */}
      <div className="absolute inset-0 opacity-15 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] z-0 pointer-events-none mix-blend-overlay"></div>

      <div className="max-w-3xl mx-auto relative z-10">
        <motion.h2 
           initial={{ opacity: 0, scale: 0.9 }}
           whileInView={{ opacity: 1, scale: 1 }}
           viewport={{ once: true }}
           className="text-4xl md:text-5xl font-bold text-white mb-6 drop-shadow-lg"
        >
          Verimliliğinizi Bugün Artırın
        </motion.h2>
        <motion.p 
           initial={{ opacity: 0, y: 10 }}
           whileInView={{ opacity: 1, y: 0 }}
           viewport={{ once: true }}
           transition={{ delay: 0.1 }}
           className="mt-6 text-lg text-sky-100 max-w-2xl mx-auto"
        >
          Binlerce ekibe katılın ve iş akışınızı Renkflow ile bir sonraki seviyeye taşıyın. Kredi kartı gerekmez.
        </motion.p>
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           whileInView={{ opacity: 1, y: 0 }}
           viewport={{ once: true }}
           transition={{ delay: 0.2 }}
           className="flex flex-wrap items-center justify-center gap-4"
        >
          <Link href="/signup" className="mt-10 inline-block bg-white text-slate-900 font-bold py-4 px-10 rounded-full transition-all hover:scale-105 hover:bg-slate-100 shadow-2xl shadow-sky-900/40 text-lg">
            Hemen Ücretsiz Başlayın
          </Link>
          <Link href="/contact" className="mt-10 inline-block border border-white/70 text-white font-semibold py-4 px-10 rounded-full transition-all hover:bg-white/10 text-lg">
            Satışla Görüş
          </Link>
        </motion.div>
      </div>
    </section>
  );
};
