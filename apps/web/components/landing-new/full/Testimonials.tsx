'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Boxes,
  ClipboardCheck,
  Network,
  PackageCheck,
  ScanLine,
  UsersRound,
} from 'lucide-react';

const featureCards = [
  {
    title: 'Production Tracking',
    description:
      'Track each order by production stage, identify blocked jobs early, and see delay risk before deadlines slip.',
    icon: ClipboardCheck,
  },
  {
    title: 'Inventory Management',
    description:
      'Follow material movement in real time, prevent stockouts on critical lines, and align purchasing with live demand.',
    icon: Boxes,
  },
  {
    title: 'Team Collaboration',
    description:
      'Keep planners, operators, quality and finance on the same workflow with shared status and role-based updates.',
    icon: UsersRound,
  },
  {
    title: 'Shift Handover Log',
    description:
      'Capture open issues, pending actions and machine notes at shift change to avoid repeated context loss.',
    icon: Network,
  },
  {
    title: 'Quality Gate Control',
    description:
      'Attach checks and approvals to stages so defects are contained before they move further down the line.',
    icon: PackageCheck,
  },
  {
    title: 'Traceable Operations',
    description:
      'Record who changed what and when across orders, inventory and scheduling for audit-ready process history.',
    icon: ScanLine,
  },
];

export const Testimonials: React.FC = () => {
  return (
    <section className="relative overflow-hidden py-24 md:py-32">
      <div className="absolute left-0 top-0 -z-10 h-full w-full bg-slate-50/50 dark:bg-slate-900/30" />
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300"
          >
            Core Features
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-6 text-4xl font-bold text-slate-900 dark:text-white md:text-5xl"
          >
            Built for real factory operations
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-lg text-slate-600 dark:text-slate-400"
          >
            RenkFlow replaces spreadsheets and disconnected tools with one system for production speed, visibility
            and control.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {featureCards.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.article
                key={feature.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.06 }}
                className="rounded-3xl border border-slate-200/75 bg-white/90 p-7 shadow-[0_20px_42px_-34px_rgba(15,23,42,0.4)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/70"
              >
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300">
                  <Icon size={22} />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{feature.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{feature.description}</p>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
};
