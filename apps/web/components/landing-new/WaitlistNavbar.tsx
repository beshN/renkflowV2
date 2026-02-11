'use client';

import React, { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useTranslation } from '@/lib/i18n/client';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { Button } from '@/components/ui/Button';

export const WaitlistNavbar = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const { locale } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const isDark = resolvedTheme === 'dark';
  const [scrolled, setScrolled] = useState(false);
  const uiLocale = mounted ? locale : 'tr';

  const labels = {
    tr: {
      soon: 'Çok Yakında',
      notify: 'Haberdar Ol',
      toggleTheme: 'Temayı Değiştir',
    },
    en: {
      soon: 'Coming Soon',
      notify: 'Notify Me',
      toggleTheme: 'Toggle Theme',
    },
    ar: {
      soon: 'قريباً',
      notify: 'أخبرني',
      toggleTheme: 'تبديل المظهر',
    },
  } as const;
  const text = labels[uiLocale as keyof typeof labels] ?? labels.tr;

  // Update scrolled state for conditional styling
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'rf-topbar h-16'
          : 'bg-transparent h-20'
      }`}
    >
      <div className="rf-page-wrap h-full flex items-center justify-between">
        {/* Brand Logo */}
        <Link
          href="/"
          className="group inline-flex items-center rounded-xl py-1 pl-2 sm:pl-3 transition-opacity hover:opacity-90"
        >
          <Image
            src="/email-assets/header-logo.png"
            alt="RenkFlow"
            width={442}
            height={88}
            className="h-7 w-auto sm:h-8 md:h-9 object-contain"
            priority
          />
        </Link>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSelector variant="dropdown" showLabel={false} />
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-secondary/50 text-secondary-foreground border border-border/50 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            {text.soon}
          </span>

          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className="w-9 h-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
              aria-label={text.toggleTheme}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </Button>
          )}

           <Button
            size="sm"
            className="h-9 px-3 sm:px-4 text-xs font-medium rounded-lg shadow-sm hover:shadow-md transition-all duration-300 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' })}
          >
            {text.notify}
          </Button>
        </div>
      </div>
    </nav>
  );
};
