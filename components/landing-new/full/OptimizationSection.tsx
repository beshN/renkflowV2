'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';

export const OptimizationSection: React.FC = () => {
  return (
    <section className="py-24 md:py-32">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white"
          >
            İş Akışınızı Optimize Edin
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-xl text-blue-600 font-semibold"
          >
            Verimliliği %50'ye Kadar Artırın
          </motion.p>
        </div>
        <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-16 bg-blue-50 dark:bg-blue-600/10 p-8 md:p-12 rounded-3xl border border-blue-100 dark:border-blue-600/20"
        >
          <Image 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuA8xcb_5ay_Dg7O_K8tRw9sIy4zkyfjB1B7FDu7iEydQ7AuOWqP8UXjZ5rmELVbveOOUwx3aPnlv0IugOdKickucfBH7hlXtxAjzYVHI6cUFl9bMrxhe2YoDfJN2ZVkA1kE-bOcvQBVgLNtqbwhvIpJ5NgIE3G01K9crbl8zrxp9XB38F3GSqyxPiDTam76hMwU7GkyZP9qVPcYTakG_DVDMehfSrRKeAG286_Op4BruH5raEKq1H3wRD0TaB28qalc1MTZxBXcNijY" 
            alt="Optimization diagram" 
            width={1200}
            height={600}
            className="w-full h-auto rounded-xl"
            unoptimized
          />
        </motion.div>
      </div>
    </section>
  );
};
