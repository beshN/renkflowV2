'use client';

import React, { useState, useEffect } from 'react';
import LandingNav from '@/components/landing/LandingNav';
import { Pricing } from '@/components/landing-new/Pricing';
import { Footer } from '@/components/landing-new/Footer';
import { useTheme } from '@/lib/context/ThemeContext';
import { motion } from 'framer-motion';

export default function PricingPage() {
  const [mounted, setMounted] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <LandingNav />
      
      <div className="pt-32 pb-10 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto text-center">
            <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-4xl sm:text-5xl font-bold text-foreground mb-6"
            >
                Planlar ve Fiyatlandırma
            </motion.h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                30 gün ücretsiz deneyin. Kredi kartı gerekmez.
            </p>
      </div>

      <Pricing />
      
      <Footer />
    </div>
  );
}
