'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';

export const OptimizationSection: React.FC = () => {
  return (
    <section className="py-24 md:py-32 overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto relative z-10">
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
            className="mt-4 text-xl text-blue-600 font-semibold inline-block py-1 px-3 bg-blue-50 dark:bg-blue-900/30 rounded-full"
          >
            ⚡️ Verimliliği %50'ye Kadar Artırın
          </motion.p>
        </div>
        
        <div className="relative mt-16 group perspective-[1000px]">
             {/* Floating Badge Example */}
             <motion.div 
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
                className="absolute top-[10%] left-[5%] md:left-[10%] z-20 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 flex items-center gap-3 animate-bounce shadow-blue-500/20"
                style={{ animationDuration: '3s' }}
             >
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600">
                    <span className="material-symbols-outlined">trending_up</span>
                </div>
                <div>
                    <p className="text-xs text-slate-500">Büyüme</p>
                    <p className="font-bold text-slate-900 dark:text-white">+%125</p>
                </div>
             </motion.div>

            <motion.div 
                initial={{ opacity: 0, y: 30, rotateX: 10 }}
                whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="bg-blue-50 dark:bg-blue-600/10 p-4 md:p-8 rounded-3xl border border-blue-100 dark:border-blue-600/20 shadow-2xl relative z-10 transform transition-transform group-hover:scale-[1.01]"
            >
            <Image 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuA8xcb_5ay_Dg7O_K8tRw9sIy4zkyfjB1B7FDu7iEydQ7AuOWqP8UXjZ5rmELVbveOOUwx3aPnlv0IugOdKickucfBH7hlXtxAjzYVHI6cUFl9bMrxhe2YoDfJN2ZVkA1kE-bOcvQBVgLNtqbwhvIpJ5NgIE3G01K9crbl8zrxp9XB38F3GSqyxPiDTam76hMwU7GkyZP9qVPcYTakG_DVDMehfSrRKeAG286_Op4BruH5raEKq1H3wRD0TaB28qalc1MTZxBXcNijY" 
                alt="Optimization diagram" 
                width={1200}
                height={600}
                className="w-full h-auto rounded-xl shadow-lg"
                unoptimized
            />
            </motion.div>
            
            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[50%] bg-blue-500/20 blur-[100px] rounded-full -z-10" />
        </div>
      </div>
    </section>
  );
};
