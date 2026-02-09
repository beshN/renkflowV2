'use client';

import React, { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/Button';

export const WaitlistNavbar = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [scrolled, setScrolled] = useState(false);

  // Update scrolled state for conditional styling
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/80 dark:bg-[#0B0B0F]/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800/60 h-16'
          : 'bg-transparent h-20'
      }`}
    >
      <div className="w-full h-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 flex items-center justify-between">
        {/* Logo - Fixed Position & Size */}
        <Link
          href="/"
          className="group flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/70 bg-white/90 shadow-sm transition-all hover:shadow-md dark:border-slate-700/70 dark:bg-slate-900/80"
        >
          <Image
            src="/logo-r.png"
            alt="RenkFlow Logo"
            width={24}
            height={24}
            className="h-6 w-6 object-contain"
            priority
          />
        </Link>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-secondary/50 text-secondary-foreground border border-border/50 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Çok Yakında
          </span>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="w-9 h-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
            aria-label="Temayı Değiştir"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </Button>

           <Button
            size="sm"
            className="h-9 px-4 text-xs font-medium rounded-lg shadow-sm hover:shadow-md transition-all duration-300 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Haberdar Ol
          </Button>
        </div>
      </div>
    </nav>
  );
};
