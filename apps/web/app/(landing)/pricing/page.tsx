
'use client';

import { Pricing } from '@/components/landing-new/Pricing';
import { CTA } from '@/components/landing-new/CTA';
import { motion } from 'framer-motion';

export const dynamic = 'force-dynamic';

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#f7f8fb] dark:bg-slate-950 relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(184,116,68,0.12),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.12),transparent_40%)]"
      />
      
      <div className="pt-32 pb-10 w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 text-center relative z-10">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                Fiyatlandırma
            </span>
            <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 text-4xl sm:text-5xl font-bold text-foreground mb-6"
            >
                Planlar ve Fiyatlandırma
            </motion.h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                30 gün ücretsiz deneyin. Kredi kartı gerekmez.
            </p>
      </div>

      <Pricing />
      
      <CTA /> 
    </div>
  );
}
