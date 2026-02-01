'use client';

import React, { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useTheme } from 'next-themes';

export const WaitlistNavbar = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
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
      className={`fixed top-0 z-50 w-full bg-transparent transition-all duration-300 ${
        scrolled 
          ? 'backdrop-blur-xl shadow-[0_10px_30px_-20px_rgba(15,23,42,0.35)]' 
          : ''
      }`}
    >
      {/* 
        Navbar container: h-24 (96px) compact height
        The logo container uses negative margins and overflow-visible to 
        allow the large logo to extend beyond the navbar bounds
      */}
      <div className="w-full px-4 md:px-12">
        <div className="flex items-center justify-between h-24 md:h-28">
          {/* Logo */}
          <Link href="/" className="group flex items-center">
            <div className="relative -mt-2 md:-mt-3 h-20 w-64 md:h-24 md:w-96 overflow-hidden transition-transform duration-300 group-hover:scale-105">
              <Image 
                src="/logo-full.png" 
                alt="RenkFlow" 
                fill
                sizes="(max-width: 768px) 256px, 384px"
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
                onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
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
