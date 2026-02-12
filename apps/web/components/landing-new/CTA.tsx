'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export const CTA = () => {
  return (
    <section className="py-24 bg-transparent relative overflow-hidden">
      
      {/* Animated Background */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl animate-blob" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white rounded-full blur-3xl animate-blob animation-delay-4000" />
      </div>
      
      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff10_1px,transparent_1px),linear-gradient(to_bottom,#ffffff10_1px,transparent_1px)] bg-[size:32px_32px]" />
      
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="rounded-[36px] bg-gradient-to-r from-sky-600 via-blue-600 to-emerald-500 p-8 md:p-16 text-center shadow-[0_40px_90px_-60px_rgba(184,116,68,0.7)] relative"
        >
          <h2 className="text-3xl font-bold leading-tight tracking-tight text-white md:text-4xl lg:text-5xl">
            RenkFlow Early Access Program
          </h2>
          <p className="mt-6 mx-auto max-w-2xl text-lg text-white/90">
            Uretim operasyonlarinizi tek bir platformda yonetmek icin erken erisim listesine katilin.
            Pilot firmalarla kademeli onboarding yapiyoruz.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/#waitlist">
              <motion.div whileHover={{ scale: 1.05, boxShadow: "0 20px 60px rgba(255,255,255,0.25)" }} whileTap={{ scale: 0.95 }}>
                <Button variant="ghost" size="lg" className="bg-white text-slate-900 hover:bg-slate-100 rounded-xl px-8 py-4 text-lg">
                  Join Waitlist
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </Button>
              </motion.div>
            </Link>
            <Link href="/contact">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button variant="outline" size="lg" className="border-white/70 text-white hover:bg-white/10 rounded-xl px-8 py-4 text-lg">
                  Satış Ekibiyle Görüş
                </Button>
              </motion.div>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
