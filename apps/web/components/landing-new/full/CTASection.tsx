'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';

export const CTASection: React.FC = () => {
  return (
    <section className="my-20 w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 md:my-28">
      <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-12">
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl font-bold text-slate-900 dark:text-white md:text-4xl"
        >
          Operasyonlari daha net yonetmek icin RenkFlow'a gecin
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          viewport={{ once: true }}
          className="mx-auto mt-4 max-w-2xl text-base text-slate-600 dark:text-slate-300"
        >
          Hesabiniza girip urun modullerini inceleyebilir veya ekibimizden canli demo talep edebilirsiniz.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          viewport={{ once: true }}
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
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
        </motion.div>
      </div>
    </section>
  );
};
