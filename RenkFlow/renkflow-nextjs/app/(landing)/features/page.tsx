'use client';

import { Features } from '@/components/landing-new/Features';
import { FeaturesDashboardPreview } from '@/components/landing-new/FeaturesDashboardPreview';
import { motion } from 'framer-motion';

export const dynamic = 'force-dynamic';

export default function FeaturesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#f7f8fb] dark:bg-slate-950 relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(14,165,233,0.12),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.12),transparent_40%)]"
      />
      
      <div className="pt-32 pb-20 px-6 md:px-12 max-w-[1400px] mx-auto text-center relative z-10">
            <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:bg-sky-500/10 dark:text-sky-300">
                Özellikler
            </span>
            <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 text-4xl sm:text-5xl font-bold text-foreground mb-6"
            >
                Özellikleri Keşfedin
            </motion.h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                İşletmenizin her adımını optimize etmek için tasarlandı.
            </p>
      </div>

      <div className="flex justify-center px-4 -mt-8 mb-20 relative z-20">
        <div className="w-full max-w-5xl">
            <FeaturesDashboardPreview />
        </div>
      </div>

      <Features />
      
      {/* Additional Detail Section could go here */}

    </div>
  );
}
