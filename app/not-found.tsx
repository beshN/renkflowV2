'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import LandingNav from '@/components/landing/LandingNav';
import { Footer } from '@/components/landing-new/Footer';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-display flex flex-col">
      <LandingNav />
      
      <main className="flex-1 flex items-center justify-center px-6 md:px-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-lg"
        >
          <div className="mb-8">
            <span className="text-[150px] md:text-[200px] font-black text-primary/20 leading-none block">
              404
            </span>
          </div>
          
          <h1 className="text-3xl md:text-4xl font-black mb-4 text-text-light dark:text-text-dark">
            Sayfa Bulunamadı
          </h1>
          
          <p className="text-lg text-subtle-light dark:text-subtle-dark mb-8">
            Aradığınız sayfa mevcut değil veya taşınmış olabilir. Ana sayfaya dönerek yolculuğunuza devam edebilirsiniz.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-primary text-white font-bold py-3 px-8 rounded-full shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined">home</span>
                Ana Sayfaya Dön
              </motion.button>
            </Link>
            
            <Link href="/contact">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="border border-border-light dark:border-border-dark font-bold py-3 px-8 rounded-full hover:bg-surface-light dark:hover:bg-surface-dark transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined">help</span>
                Yardım Al
              </motion.button>
            </Link>
          </div>
        </motion.div>
      </main>
      
      <Footer />
    </div>
  );
}
