'use client';

import React, { useState, useEffect } from 'react';
import { WaitlistNavbar } from '@/components/landing-new/WaitlistNavbar';
import { Hero } from '@/components/landing-new/Hero';
import { Features } from '@/components/landing-new/Features';
import { FAQ } from '@/components/landing-new/FAQ';
import { Footer } from '@/components/landing-new/Footer';

export function LandingContainer() {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <WaitlistNavbar />
      <Hero />
      <Features />
      <FAQ />
      <div className="py-12 border-t border-border/50 text-center">
        <p className="text-subtle-light dark:text-subtle-dark font-medium">
          Renkflow 2026
        </p>
      </div>
    </div>
  );
}
