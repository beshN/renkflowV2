'use client';

import React from 'react';
import { Moon, Sun } from 'lucide-react';
import Image from 'next/image';
import { useTheme } from '@/lib/context/ThemeContext';

interface NavbarProps {
  isDark: boolean;
  toggleTheme: () => void;
}

// Since we are moving into Next.js app directory with existing ThemeContext, 
// we might want to use that instead of prop drilling, but sticking to the design
// we will adapt it to use our ThemeContext or passed props if we handle state in page.tsx.
// For now, let's assume we pass props to keep it simple as per original design.

export const Navbar: React.FC<NavbarProps> = ({ isDark, toggleTheme }) => {
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/70 backdrop-blur-xl">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          
          {/* Logo Section */}
          <div className="flex-shrink-0 flex items-center gap-3 cursor-pointer" onClick={() => window.location.reload()}>
            <div className="relative h-10 w-32 flex items-center">
                <Image 
                  src="/logo-full.png" 
                  alt="RenkFlow" 
                  fill
                  className="object-contain"
                />
            </div>
          </div>

          {/* Desktop Navigation - Hidden for Coming Soon page to keep focus */}
          <div className="hidden md:flex items-center space-x-8 opacity-50 pointer-events-none select-none grayscale">
            <span className="text-sm font-medium text-muted-foreground cursor-not-allowed">Özellikler</span>
            <span className="text-sm font-medium text-muted-foreground cursor-not-allowed">Çözümler</span>
            <span className="text-sm font-medium text-muted-foreground cursor-not-allowed">Fiyatlandırma</span>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-full bg-secondary hover:bg-secondary/80 transition-all text-muted-foreground border border-border"
              aria-label="Toggle Dark Mode"
            >
              {isDark ? (
                <Sun className="w-5 h-5 text-amber-400" />
              ) : (
                <Moon className="w-5 h-5 text-primary" />
              )}
            </button>
            
            <div className="hidden sm:flex px-4 py-2 rounded-lg bg-secondary text-muted-foreground text-xs font-medium border border-border">
              v1.0 (Beta)
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};
