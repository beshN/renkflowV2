'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/landing-new/Navbar';
import { FullLandingContent } from '@/components/landing-new/FullLandingContent';
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
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-900 font-sans">
      <link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
      <style jsx global>{`
        :root {
          --font-sora: 'Sora', sans-serif;
        }
        body {
          font-family: 'Sora', sans-serif;
        }
        .material-symbols-outlined {
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          font-family: 'Material Symbols Outlined';
          font-weight: normal;
          font-style: normal;
          font-size: 24px;
          line-height: 1;
          letter-spacing: normal;
          text-transform: none;
          display: inline-block;
          white-space: nowrap;
          word-wrap: normal;
          direction: ltr;
        }
      `}</style>

      <Navbar isDark={theme === 'dark'} toggleTheme={toggleTheme} />
      <FullLandingContent />
      <Footer />
    </div>
  );
}
