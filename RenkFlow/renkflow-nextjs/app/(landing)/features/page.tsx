'use client';

import React, { useState, useEffect } from 'react';
import { Features } from '@/components/landing-new/Features';
import { useTheme } from '@/lib/context/ThemeContext';
import { motion } from 'framer-motion';

export default function FeaturesPage() {
  const [mounted, setMounted] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      
      <div className="pt-32 pb-20 px-6 md:px-12 max-w-[1400px] mx-auto text-center">
            <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-4xl sm:text-5xl font-bold text-foreground mb-6"
            >
                Özellikleri Keşfedin
            </motion.h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                İşletmenizin her adımını optimize etmek için tasarlandı.
            </p>
      </div>

      <Features />
      
      {/* Additional Detail Section could go here */}

    </div>
  );
}
