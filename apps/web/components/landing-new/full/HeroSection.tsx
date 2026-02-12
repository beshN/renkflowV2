'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { DashboardPreview } from '../DashboardPreview';

export const HeroSection: React.FC = () => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <main className="relative flex min-h-[calc(100svh-4.5rem)] items-center overflow-hidden pb-16 pt-24 md:pt-28 lg:pb-20 lg:pt-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-gradient-to-br from-sky-400/30 via-cyan-400/10 to-transparent blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-10 h-80 w-80 translate-x-1/4 rounded-full bg-gradient-to-br from-emerald-300/25 via-sky-400/10 to-transparent blur-3xl"
      />
      <div className="rf-page-wrap">
        <div className="rf-hero-grid">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="relative z-10 text-center md:text-left"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/70 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 shadow-sm shadow-sky-200/40 backdrop-blur dark:border-sky-500/20 dark:bg-slate-900/70 dark:text-slate-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Currently in Private Beta
            </div>

            <h1 className="mt-6 text-balance text-5xl font-bold leading-[1.03] tracking-[-0.03em] text-slate-900 dark:text-white md:text-6xl lg:text-7xl">
              RenkFlow: The Operating System for Modern Production.
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-lg text-slate-600 dark:text-slate-400 md:mx-0 md:text-xl">
              Streamline your production workflows, track inventory, and manage teams in one visual platform.
              The flexibility of Trello, built for manufacturers.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4 md:justify-start">
              <Link
                href="#waitlist"
                className="rounded-full bg-slate-900 px-10 py-4 text-lg font-semibold text-white shadow-[0_20px_45px_-18px_rgba(15,23,42,0.6)] transition-transform hover:scale-[1.03]"
              >
                Join Waitlist
              </Link>
              <Link
                href="#waitlist"
                className="font-semibold text-slate-700 transition-colors hover:text-emerald-500 dark:text-slate-300 dark:hover:text-emerald-400"
              >
                Request Early Access
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative flex items-center justify-end perspective-[2000px] lg:-mr-[2.5vw]"
          >
            <div
              className="absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_50%_50%,rgba(184,116,68,0.18),transparent_65%)] dark:bg-[radial-gradient(circle_at_50%_50%,rgba(214,168,133,0.25),transparent_70%)]"
              style={{ animationDuration: '4s' }}
            />
            <div className="w-full max-w-[900px] lg:w-[min(58vw,900px)]">
              <DashboardPreview isDark={isDark} />
            </div>
          </motion.div>
        </div>
      </div>
    </main>
  );
};
