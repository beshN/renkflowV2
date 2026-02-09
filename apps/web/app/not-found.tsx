'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { ArrowLeft, HelpCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#f7f8fb] dark:bg-slate-950 font-display flex flex-col relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-400/20 dark:bg-blue-600/10 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob" />
            <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] bg-purple-400/20 dark:bg-purple-600/10 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000" />
            <div className="absolute bottom-[-10%] left-[20%] w-[50%] h-[50%] bg-emerald-400/20 dark:bg-emerald-600/10 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-4000" />
        </div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50">
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-16 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <div className="relative h-10 w-32">
              <Image
                src="/renkflow-logo-new.png"
                alt="Renkflow"
                fill
                className="object-contain object-left"
                priority
              />
            </div>
          </Link>
        </div>
      </header>
      
      <main className="flex-1 flex items-center justify-center px-6 relative z-10">
        <div className="w-full max-w-4xl grid md:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <motion.div 
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
                className="text-center md:text-left order-2 md:order-1"
            >
                 <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-red-600 dark:bg-red-900/20 dark:text-red-300 mb-6">
                    404 Hata
                </span>
                <h1 className="text-4xl md:text-6xl font-black mb-6 text-slate-900 dark:text-white leading-tight">
                    Aradığınız sayfayı <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">bulamadık.</span>
                </h1>
                
                <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 max-w-md mx-auto md:mx-0 leading-relaxed">
                    Ulaşmaya çalıştığınız sayfa silinmiş, adı değiştirilmiş veya geçici olarak servis dışı kalmış olabilir.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                    <Link href="/">
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold py-3.5 px-8 rounded-full shadow-lg hover:shadow-xl transition-all"
                    >
                        <ArrowLeft size={18} />
                        Ana Sayfa
                    </motion.button>
                    </Link>
                    
                    <Link href="/contact">
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex items-center gap-2 border border-slate-200 dark:border-slate-800 font-bold py-3.5 px-8 rounded-full hover:bg-white dark:hover:bg-slate-900 transition-colors text-slate-700 dark:text-slate-300 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm"
                    >
                        <HelpCircle size={18} />
                        Destek
                    </motion.button>
                    </Link>
                </div>
            </motion.div>

            {/* Right Visual (Glass Card) */}
            <motion.div 
                 initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
                 animate={{ opacity: 1, scale: 1, rotate: 0 }}
                 transition={{ duration: 0.8, type: "spring" }}
                 className="order-1 md:order-2 flex justify-center perspective-[1000px]"
            >
                <div className="relative w-full max-w-sm aspect-square bg-gradient-to-br from-white/40 to-white/10 dark:from-slate-800/40 dark:to-slate-900/10 backdrop-blur-2xl border border-white/50 dark:border-white/10 rounded-[3rem] shadow-[0_45px_100px_-30px_rgba(0,0,0,0.15)] p-8 flex flex-col items-center justify-center transform hover:rotate-2 transition-transform duration-500 group">
                    <div className="absolute inset-0 rounded-[3rem] bg-gradient-to-br from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    
                    <span className="text-[140px] font-black text-transparent bg-clip-text bg-gradient-to-br from-slate-900/20 to-slate-900/5 dark:from-white/20 dark:to-white/5 select-none leading-none">
                        404
                    </span>
                    <div className="w-16 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mt-4" />
                </div>
            </motion.div>
        </div>
      </main>
      
      <footer className="py-8 text-center text-sm text-slate-400 relative z-10">
        © {new Date().getFullYear()} RenkFlow. Tüm hakları saklıdır.
      </footer>
    </div>
  );
}
