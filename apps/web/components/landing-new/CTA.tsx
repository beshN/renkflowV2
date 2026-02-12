'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export const CTA = () => {
  return (
    <section className="bg-transparent py-20">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-12"
        >
          <h2 className="text-3xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white md:text-4xl">
            RenkFlow ile operasyonlarinizi tek merkezden yonetin
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 dark:text-slate-300">
            Hesabiniza girerek urun ekranlarini gorebilir, ekibimizle iletisime gecerek demo planlayabilirsiniz.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/auth/login"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-6 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Giris Yap
            </Link>
            <Link
              href="/contact"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-6 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Demo Talep Et
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
