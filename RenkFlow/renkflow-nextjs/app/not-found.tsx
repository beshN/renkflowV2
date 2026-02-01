'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import Image from 'next/image';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-display flex flex-col">
      {/* Simple Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center">
          <Link href="/" className="flex items-center">
            <div className="relative h-10 w-32">
              <Image
                src="/logo-full.png"
                alt="Renkflow"
                fill
                className="object-contain object-left"
                priority
              />
            </div>
          </Link>
        </div>
      </header>
      
      <main className="flex-1 flex items-center justify-center px-6 md:px-12 pt-16">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-lg"
        >
          <div className="mb-8">
            <span className="text-[150px] md:text-[200px] font-black text-sky-500/20 leading-none block">
              404
            </span>
          </div>
          
          <h1 className="text-3xl md:text-4xl font-black mb-4 text-slate-900 dark:text-white">
            Sayfa Bulunamadı
          </h1>
          
          <p className="text-lg text-slate-500 dark:text-slate-400 mb-8">
            Aradığınız sayfa mevcut değil veya taşınmış olabilir.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-gradient-to-r from-sky-600 to-blue-600 text-white font-bold py-3 px-8 rounded-full shadow-lg hover:shadow-xl transition-shadow"
              >
                Ana Sayfaya Dön
              </motion.button>
            </Link>
            
            <Link href="/contact">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="border border-slate-300 dark:border-slate-700 font-bold py-3 px-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300"
              >
                Yardım Al
              </motion.button>
            </Link>
          </div>
        </motion.div>
      </main>
      
      {/* Simple Footer */}
      <footer className="py-8 text-center text-sm text-slate-400">
        © {new Date().getFullYear()} RenkFlow. Tüm hakları saklıdır.
      </footer>
    </div>
  );
}
