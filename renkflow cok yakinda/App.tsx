import React, { useState, useEffect } from 'react';
import { Hero } from './components/Hero';
import { Footer } from './components/Footer';
import { Navbar } from './components/Navbar';

export default function App() {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Removed auto-dark mode to default to white background as requested
    // Checks if the user has manually set a preference before, or defaults to light
    if (document.documentElement.classList.contains('dark')) {
        setIsDark(true);
    }
  }, []);

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    if (newIsDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-white dark:bg-[#050b14] transition-colors duration-500">
      
      {/* Background Ambience tailored to Logo Colors */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Deep Blue Orb */}
        <div className="absolute top-[-20%] left-[10%] w-[50vw] h-[50vw] bg-brand-primary/10 dark:bg-brand-primary/20 rounded-full blur-[120px] opacity-60 animate-pulse-slow"></div>
        {/* Cyan/Turquoise Orb */}
        <div className="absolute bottom-[-10%] right-[10%] w-[40vw] h-[40vw] bg-brand-accent/10 dark:bg-brand-accent/15 rounded-full blur-[100px] opacity-50"></div>
        {/* Noise Texture */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02] dark:opacity-[0.04]"></div>
      </div>

      <Navbar isDark={isDark} toggleTheme={toggleTheme} />

      <main className="flex-grow flex items-center justify-center relative z-10 w-full">
        <Hero />
      </main>

      <Footer />
    </div>
  );
}