'use client';

import React, { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useTheme } from '@/lib/context/ThemeContext';
import { motion, useScroll, useTransform } from 'framer-motion';

interface NavbarProps {
  isDark: boolean;
  toggleTheme: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ isDark, toggleTheme }) => {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);

  // Update scrolled state for conditional styling
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <motion.nav 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6 }}
      className={`fixed top-0 z-50 w-full transition-all duration-300 ${
        scrolled 
          ? 'bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-sm' 
          : 'bg-transparent border-transparent'
      }`}
    >
      <div className="w-full px-6 md:px-12">
        <div className="flex justify-between items-center h-24">
          
          {/* Logo Section */}
          <Link href="/" className="flex-shrink-0 flex items-center gap-3 cursor-pointer group">
            <div className="relative h-28 w-[400px] flex items-center justify-start overflow-visible -ml-16 md:-ml-12">
                <Image 
                  src="/logo-full.png" 
                  alt="RenkFlow" 
                  fill
                  className="object-contain scale-150 origin-left"
                  priority
                />
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1 lg:space-x-2">
             <a href="#features" className="relative px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-500 cursor-pointer transition-colors select-none group">
                Özellikler
             </a>
             <a href="#pricing" className="relative px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-500 cursor-pointer transition-colors select-none group">
                Fiyatlandırma
             </a>
             <a href="#integrations" className="relative px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-500 cursor-pointer transition-colors select-none group">
                Entegrasyonlar
             </a>
             <a href="#contact" className="relative px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-500 cursor-pointer transition-colors select-none group">
                İletişim
             </a>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
             <Link href="/auth/login" className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-500 transition-colors hidden sm:block">
                Giriş Yap
             </Link>
             <Link href="/signup" className="bg-blue-600 text-white font-semibold py-2.5 px-6 rounded-full shadow-sm hover:bg-blue-700 transition-all flex items-center gap-2">
                <span>Ücretsiz Başlayın</span>
             </Link>

        </div>
        </div>
      </div>
    </motion.nav>
  );
};
