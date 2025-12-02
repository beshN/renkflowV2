'use client';

import { motion } from 'framer-motion';
import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';

export default function IntegrationsPage() {
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-display">
      <LandingNav />
      
      <main className="pt-32 pb-20 container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto text-center"
        >
          <h1 className="text-4xl md:text-5xl font-black mb-6 text-text-light dark:text-text-dark">
            Entegrasyonlar
          </h1>
          <p className="text-xl text-subtle-light dark:text-subtle-dark mb-12">
            İş akışınızı favori araçlarınızla birleştirin.
          </p>

          <div className="p-12 bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark shadow-premium">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 text-primary mb-6">
              <span className="material-symbols-outlined text-4xl">extension</span>
            </div>
            <h2 className="text-2xl font-bold mb-4">Çok Yakında</h2>
            <p className="text-subtle-light dark:text-subtle-dark max-w-lg mx-auto">
              Entegrasyon kütüphanemiz hazırlanıyor. Yakında Slack, Discord, Google Drive ve daha fazlası ile RenkFlow&apos;u bağlayabileceksiniz.
            </p>
          </div>
        </motion.div>
      </main>

      <LandingFooter />
    </div>
  );
}
