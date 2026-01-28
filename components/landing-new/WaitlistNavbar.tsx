'use client';

import React, { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useTheme } from '@/lib/context/ThemeContext';
import { motion, useScroll, useTransform } from 'framer-motion';

interface NavbarProps {
  isDark: boolean;
  toggleTheme: () => void;
}

export const WaitlistNavbar: React.FC<NavbarProps> = ({ isDark, toggleTheme }) => {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);

  // Update scrolled state for conditional styling
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <motion.nav 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6 }}
      className={`fixed top-0 z-50 w-full transition-all duration-300 ${
        scrolled 
          ? 'bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-sm' 
          : 'bg-transparent border-transparent'
      }`}
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-24">
          
          {/* Logo Section */}
          <Link href="/" className="flex-shrink-0 flex items-center gap-3 cursor-pointer group">
            <div className="relative h-28 w-96 flex items-center transition-transform group-hover:scale-105">
                <Image 
                  src="/logo-full.png" 
                  alt="RenkFlow" 
                  fill
                  className="object-contain"
                  priority
                />
            </div>
          </Link>

          {/* Desktop Navigation - Removed for Waitlist */}
          <div className="hidden md:flex items-center space-x-1 lg:space-x-2"></div>

          {/* Right Actions - Removed for Waitlist */}
          <div className="flex items-center gap-4"></div>
        </div>
      </div>
    </motion.nav>
  );
};
