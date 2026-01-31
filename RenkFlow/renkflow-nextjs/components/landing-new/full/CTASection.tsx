'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';

export const CTASection: React.FC = () => {
  return (
    <section className="relative my-24 md:my-32 py-20 px-8 text-center max-w-[1400px] mx-auto overflow-hidden rounded-3xl">
      
      {/* Animated Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 animate-gradient-xy z-0"></div>
      
      {/* Overlay Pattern */}
      <div className="absolute inset-0 opacity-10 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] z-0 pointer-events-none mix-blend-overlay"></div>

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
           className="mt-6 text-lg text-blue-100 max-w-2xl mx-auto"
        >
          Binlerce ekibe katılın ve iş akışınızı Renkflow ile bir sonraki seviyeye taşıyın. Kredi kartı gerekmez.
        </motion.p>
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           whileInView={{ opacity: 1, y: 0 }}
           viewport={{ once: true }}
           transition={{ delay: 0.2 }}
        >
            <Link href="/signup" className="mt-10 inline-block bg-white text-blue-600 font-bold py-4 px-10 rounded-full transition-all hover:scale-105 hover:bg-blue-50 shadow-2xl shadow-blue-900/40 text-lg">
              Hemen Ücretsiz Başlayın
            </Link>
        </motion.div>
      </div>
    </section>
  );
};
