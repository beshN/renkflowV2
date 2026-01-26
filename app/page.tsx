'use client';

import React, { useState, useEffect } from 'react';
import { WaitlistNavbar } from '@/components/landing-new/WaitlistNavbar';
import { Hero } from '@/components/landing-new/Hero';
import { Features } from '@/components/landing-new/Features';

import { FAQ } from '@/components/landing-new/FAQ';
import { WaitlistFooter } from '@/components/landing-new/WaitlistFooter';
import { useTheme } from '@/lib/context/ThemeContext';

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  const { theme, toggleTheme } = useTheme();
  
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <WaitlistNavbar isDark={theme === 'dark'} toggleTheme={toggleTheme} />
      <Hero />
      <Features />

      <FAQ />
      <WaitlistFooter />
    </div>
  );
}
