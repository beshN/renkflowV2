'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { TypeAnimation } from 'react-type-animation';
import { useTheme } from 'next-themes';

const DashboardPreview = dynamic(
  () => import('../DashboardPreview').then((mod) => ({ default: mod.DashboardPreview })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[500px] xl:h-[560px] 2xl:h-[600px] rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/70 dark:bg-slate-900/70 animate-pulse" />
    ),
  }
);

export const HeroSection: React.FC = () => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <main className="relative pt-24 md:pt-28 lg:pt-32 pb-16 lg:pb-20 overflow-hidden min-h-[calc(100svh-4.5rem)] flex items-center">
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
            className="text-center md:text-left relative z-10"
          >
            <div className="inline-flex items-center gap-3 rounded-full border border-sky-200/70 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 shadow-sm shadow-sky-200/40 backdrop-blur dark:border-sky-500/20 dark:bg-slate-900/70 dark:text-slate-300">
              Yeni nesil iş akışı
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              RenkFlow OS
            </div>
            <h1 className="mt-6 text-5xl md:text-6xl lg:text-7xl font-bold text-slate-900 dark:text-white leading-tight min-h-[160px] md:min-h-[auto]">
              <span className="block">Ekiplerinizi</span>
              <span className="block bg-gradient-to-r from-sky-500 via-blue-600 to-emerald-500 bg-clip-text text-transparent h-[1.2em]">
                <TypeAnimation
                  sequence={[
                    'İş Akışınızı',
                    2000,
                    'Projelerinizi',
                    2000,
                    'Ekibinizi',
                    2000
                  ]}
                  wrapper="span"
                  speed={50}
                  repeat={Infinity}
                />
              </span>
              <span className="block">tek merkezden yönetin.</span>
            </h1>
            <p className="mt-6 text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-xl mx-auto md:mx-0">
              Görsel planlama, otomasyon ve ekip iş birliğini aynı platformda birleştirin. Karmaşayı netliğe, fikirleri somut çıktılara çevirin.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4 md:justify-start">
              <Link href="/signup" className="bg-slate-900 text-white font-semibold py-4 px-10 rounded-full transition-transform hover:scale-[1.03] shadow-[0_20px_45px_-18px_rgba(15,23,42,0.6)] text-lg">
                Ücretsiz Deneyin
              </Link>
              <Link href="/contact" className="font-semibold text-slate-700 dark:text-slate-300 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors">
                Demo Talep Et
              </Link>
            </div>
            <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
              {[
                { title: 'Canlı panolar', desc: 'İşinizi anlık görün.' },
                { title: 'Otomasyon', desc: 'Tekrarlayan işleri azaltın.' },
                { title: 'İş birliği', desc: 'Ekip içi netlik kazanın.' },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 shadow-sm backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/60">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{item.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
          
          <motion.div 
             initial={{ opacity: 0, x: 20 }}
             animate={{ opacity: 1, x: 0 }}
             transition={{ duration: 0.8, delay: 0.2 }}
             className="relative flex justify-end items-center perspective-[2000px] lg:-mr-[2.5vw]"
          >
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(14,165,233,0.18),transparent_65%)] dark:bg-[radial-gradient(circle_at_50%_50%,rgba(56,189,248,0.25),transparent_70%)] animate-pulse" style={{ animationDuration: '4s' }}></div>
              <div className="w-full lg:w-[min(58vw,900px)] max-w-[900px]">
                <DashboardPreview isDark={isDark} />
              </div>
          </motion.div>
        </div>
      </div>
    </main>
  );
};
