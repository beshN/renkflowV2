'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';

export const HeroSection: React.FC = () => {
  return (
    <main className="py-24 md:py-32 overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center md:text-left relative z-10"
          >
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-slate-900 dark:text-white leading-tight">
              Zirveye Ulaşın: İş Akışınızı <span className="text-blue-600">Renkflow</span> ile Dönüştürün.
            </h1>
            <p className="mt-6 text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-xl mx-auto md:mx-0">
              Ekibinizin en iyi işlerini, baştan sona güçlendiren görsel iş birliği aracı. Karmaşayı netliğe, fikirleri gerçeğe dönüştürün.
            </p>
            <div className="mt-10 flex items-center justify-center md:justify-start space-x-4">
              <Link href="/signup" className="bg-blue-600 text-white font-bold py-4 px-10 rounded-full transition-transform hover:scale-105 shadow-[0_0_40px_0px_rgba(67,97,238,0.3)] hover:shadow-[0_0_50px_0px_rgba(67,97,238,0.4)] text-lg">
                Ücretsiz Deneyin
              </Link>
              <Link href="/contact" className="font-semibold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-600 transition-colors">
                Demo Talep Et
              </Link>
            </div>
          </motion.div>
          
          <motion.div 
             initial={{ opacity: 0, x: 20 }}
             animate={{ opacity: 1, x: 0 }}
             transition={{ duration: 0.8, delay: 0.2 }}
             className="relative flex justify-center items-center"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(67,97,238,0.1),transparent_70%)] dark:bg-[radial-gradient(circle_at_50%_50%,rgba(67,97,238,0.2),transparent_70%)]"></div>
            <div className="relative bg-white dark:bg-slate-800/50 p-4 rounded-3xl shadow-[0_0_40px_0px_rgba(67,97,238,0.3)] transform rotate-3 border border-gray-200 dark:border-gray-700">
               <div className="relative w-full h-auto max-w-md aspect-[4/3]">
                  <Image 
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAFfzrk7dJqlT6bazlRwmXT_B6j9QdrYZQ2iampSvdIoulZFBPwNI2LE7sS7LNYd9f8H4pW1T6fIuQ3jmMJbKO4przUketLaZz7MeWxo4007MRSah3eCtJ10qhbMFHFJrVZdlhpAn6nQ7CxAKs1gO84FD5jt7BkVfMWAoZPLmXKJmZj_UETVCVK9AcIbAFVHwkbTaIRmLrFelZzWJts1ZkXGSwaPt96TpiimQ1Ed0CRIB0rctEnZqCkOo1ymR5o_rN3Q0WRmSKt1KWv"
                    alt="Renkflow application interface"
                    width={800}
                    height={600}
                    className="rounded-2xl object-cover"
                    priority
                    unoptimized // Using external URL
                  />
               </div>
            </div>
          </motion.div>
        </div>
      </div>
    </main>
  );
};
