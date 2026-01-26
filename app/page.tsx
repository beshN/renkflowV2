'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/landing-new/Navbar';
import { Hero } from '@/components/landing-new/Hero';
import { Features } from '@/components/landing-new/Features';
import { Pricing } from '@/components/landing-new/Pricing';
import { Footer } from '@/components/landing-new/Footer';
import { useTheme } from '@/lib/context/ThemeContext';

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  const { theme, toggleTheme } = useTheme();
  
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar isDark={theme === 'dark'} toggleTheme={toggleTheme} />
      <Hero />
      <Features />
      <Pricing />
      <Footer />
    </div>
  );
}
