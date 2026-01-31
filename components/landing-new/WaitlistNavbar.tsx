'use client';

import React, { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useTheme } from '@/lib/context/ThemeContext';
import { motion } from 'framer-motion';

export const WaitlistNavbar = () => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const [scrolled, setScrolled] = useState(false);

  // Update scrolled state for conditional styling
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav 
      className={`fixed top-0 z-50 w-full transition-all duration-300 ${
        scrolled 
          ? 'bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-sm' 
          : 'bg-transparent border-transparent'
      }`}
    >
      {/* 
        Navbar container: h-24 (96px) compact height
        The logo container uses negative margins and overflow-visible to 
        allow the large logo to extend beyond the navbar bounds
      */}
      <div className="w-full px-4 md:px-12">
        <div className="flex justify-end items-center h-16 md:h-24">
          
          {/* 
            Logo Section - Large logo that overflows the navbar
            - h-40 (160px) for the logo image
            - w-[600px] for width to maintain aspect ratio
            - -my-8 to extend vertically beyond the h-24 navbar
            - overflow-visible to prevent clipping
          */}
          {/* 
            Logo Section - Optimized for visual balance without layout shifts
          */}
          <Link href="/" className="absolute top-2 left-4 md:top-4 md:left-12 z-[60] group">
            <div className="relative h-24 w-72 md:h-44 md:w-[480px] transition-all duration-500 group-hover:scale-105">
                <Image 
                  src="/logo-full.png" 
                  alt="RenkFlow" 
                  fill
                  sizes="(max-width: 768px) 70vw, 480px"
                  className="object-contain object-left"
                  priority
                />
            </div>
          </Link>

          {/* Empty div for spacing (no navigation links on waitlist page) */}
          <div className="hidden md:flex items-center space-x-1 lg:space-x-2"></div>

          {/* Right Actions - Theme Toggle Only */}
          <div className="flex items-center gap-4">
             {/* Theme Toggle */}
             <button
                onClick={toggleTheme}
                className="p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Temayı Değiştir"
              >
                {isDark ? <Sun size={20} /> : <Moon size={20} />}
              </button>
          </div>
        </div>
      </div>
    </nav>
  );
};
