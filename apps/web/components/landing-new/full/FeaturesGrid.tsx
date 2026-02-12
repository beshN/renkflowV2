'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Boxes, ClipboardCheck, UsersRound } from 'lucide-react';

export const FeaturesGrid: React.FC = () => {
  const features = [
    {
      icon: <ClipboardCheck className="h-8 w-8" />,
      title: 'Production Tracking',
      desc: 'Follow every work order by stage and detect bottlenecks with live stage-level visibility.'
    },
    {
      icon: <Boxes className="h-8 w-8" />,
      title: 'Inventory Management',
      desc: 'Track materials and components in real time to prevent line stoppages and emergency purchasing.'
    },
    {
      icon: <UsersRound className="h-8 w-8" />,
      title: 'Team Collaboration',
      desc: 'Keep planners, operators and supervisors aligned with shared updates, comments and assignments.'
    }
  ];

  return (
    <section id="features" className="py-24 md:py-32 relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(184,116,68,0.08),transparent_50%),radial-gradient(circle_at_85%_0%,rgba(16,185,129,0.08),transparent_45%)]"
      />
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <div className="text-center max-w-3xl mx-auto">
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:bg-sky-500/10 dark:text-sky-300"
          >
            Platform
          </motion.p>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-6 text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-6"
          >
            Built for production teams, not generic task boards
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-slate-600 dark:text-slate-400"
          >
            RenkFlow helps manufacturers control production speed, inventory risk and cross-team execution from one system.
          </motion.p>
        </div>
        <div className="mt-16 grid md:grid-cols-3 gap-8 relative z-10">
            {features.map((feature, i) => (
                <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 + 0.2 }}
                    className="group bg-white/90 dark:bg-slate-900/70 p-8 rounded-3xl shadow-[0_20px_40px_-30px_rgba(15,23,42,0.3)] hover:shadow-[0_35px_60px_-35px_rgba(184,116,68,0.45)] hover:-translate-y-2 transition-all duration-300 border border-slate-200/80 dark:border-slate-800 relative overflow-hidden"
                >
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-400 via-blue-500 to-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                    
                    <div className="bg-sky-50 dark:bg-sky-500/10 text-sky-600 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 relative z-10">
                        {feature.icon}
                    </div>
                    <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white relative z-10">{feature.title}</h3>
                    <p className="text-slate-600 dark:text-slate-400 mb-6 relative z-10">{feature.desc}</p>
                    <Link href="/features" className="relative z-10 flex cursor-pointer items-center font-semibold text-sky-600 transition-colors hover:text-emerald-500">
                        Learn more <span className="material-symbols-outlined ml-1 transition-transform group-hover:translate-x-1">arrow_forward</span>
                    </Link>
                </motion.div>
            ))}
        </div>
      </div>
    </section>
  );
};
