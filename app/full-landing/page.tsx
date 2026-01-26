'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/landing-new/Navbar';
import { Hero } from '@/components/landing-new/Hero';
import { Features } from '@/components/landing-new/Features';
import { Pricing } from '@/components/landing-new/Pricing';
import { Testimonials } from '@/components/landing-new/Testimonials';
import { FAQ } from '@/components/landing-new/FAQ';
import { Footer } from '@/components/landing-new/Footer';
import { useTheme } from '@/lib/context/ThemeContext';

export default function FullLandingPage() {
  const [mounted, setMounted] = useState(false);
  const { theme, toggleTheme } = useTheme();
  
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar isDark={theme === 'dark'} toggleTheme={toggleTheme} />
      <Hero />
      <Features />
      <Testimonials />
      <Pricing />
      <FAQ />
      <Footer />
    </div>
  );
}
