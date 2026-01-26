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
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          
          {/* Logo Section */}
          <Link href="/" className="flex-shrink-0 flex items-center gap-3 cursor-pointer group">
            <div className="relative h-10 w-32 flex items-center transition-transform group-hover:scale-105">
                <Image 
                  src="/logo-full.png" 
                  alt="RenkFlow" 
                  fill
                  className="object-contain"
                  priority
                />
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1 lg:space-x-2">
             {[
                'Özellikler', 
                'Çözümler', 
                'Fiyatlandırma'
             ].map((item) => (
                <div key={item} className="relative px-4 py-2 text-sm font-medium text-muted-foreground/50 cursor-not-allowed select-none group">
                    {item}
                    <span className="absolute -top-1 -right-1 flex h-1.5 w-1.5">
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-border"></span>
                    </span>
                </div>
             ))}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-full bg-secondary/50 hover:bg-secondary transition-all text-muted-foreground hover:text-foreground border border-transparent hover:border-border"
              aria-label="Toggle Dark Mode"
            >
              {isDark ? (
                <Sun className="w-5 h-5 text-amber-400" />
              ) : (
                <Moon className="w-5 h-5 text-indigo-500" />
              )}
            </button>
            
            <motion.div 
                whileHover={{ scale: 1.05 }}
                className="hidden sm:flex px-4 py-2 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20 cursor-default"
            >
              Beta v2.0
            </motion.div>
          </div>
        </div>
      </div>
    </motion.nav>
  );
};
