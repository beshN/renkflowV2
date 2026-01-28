'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';

interface AuthLayoutProps {
  children: React.ReactNode;
  showHomeLink?: boolean;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, showHomeLink = true }) => {
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-background p-4">
      
      {/* Aurora Background Effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-blue-500/20 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-purple-500/20 blur-[120px] animate-pulse" style={{ animationDuration: '10s', animationDelay: '1s' }} />
        
        {/* Grid Pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
          style={{
            backgroundImage: 'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            maskImage: 'radial-gradient(circle at center, black, transparent 80%)'
          }}
        />
      </div>

      {/* Main Glass Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-2xl rounded-3xl overflow-hidden"
      >
        {/* Header Logo */}
        <div className="flex flex-col items-center pt-8 pb-4">
            <Link href="/" className="relative h-32 w-112 hover:opacity-80 transition-opacity">
                <Image 
                  src="/logo-full.png" 
                  alt="RenkFlow" 
                  fill
                  className="object-contain"
                  priority
                />
            </Link>
        </div>

        {/* Content */}
        <div className="px-8 pb-8 pt-2">
            {children}
        </div>

        {/* Footer/Back Link */}
        {showHomeLink && (
            <div className="px-8 py-4 bg-slate-50/50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 text-center">
                <Link href="/" className="text-xs text-slate-500 hover:text-blue-600 transition-colors">
                    ← Ana Sayfaya Dön
                </Link>
            </div>
        )}
      </motion.div>
    </div>
  );
};
