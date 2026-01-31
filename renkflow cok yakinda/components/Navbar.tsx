import React from 'react';
import { Moon, Sun } from 'lucide-react';

interface NavbarProps {
  isDark: boolean;
  toggleTheme: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ isDark, toggleTheme }) => {
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-gray-100/50 dark:border-gray-800/50 bg-white/70 dark:bg-[#0B1120]/70 backdrop-blur-xl">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          
          {/* Logo Section */}
          <div className="flex-shrink-0 flex items-center gap-3 cursor-pointer" onClick={() => window.location.reload()}>
            <div className="relative h-10 w-auto flex items-center">
                <img 
                src="/renkflow_logo.svg" 
                alt="RenkFlow" 
                className="h-10 w-auto object-contain"
                />
            </div>
          </div>

          {/* Desktop Navigation - Hidden for Coming Soon page to keep focus */}
          <div className="hidden md:flex items-center space-x-8 opacity-50 pointer-events-none select-none grayscale">
            <span className="text-sm font-medium text-gray-400 dark:text-gray-600 cursor-not-allowed">Özellikler</span>
            <span className="text-sm font-medium text-gray-400 dark:text-gray-600 cursor-not-allowed">Çözümler</span>
            <span className="text-sm font-medium text-gray-400 dark:text-gray-600 cursor-not-allowed">Fiyatlandırma</span>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-full bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
              aria-label="Toggle Dark Mode"
            >
              {isDark ? (
                <Sun className="w-5 h-5 text-amber-400" />
              ) : (
                <Moon className="w-5 h-5 text-brand-primary" />
              )}
            </button>
            
            <div className="hidden sm:flex px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 text-xs font-medium border border-gray-200 dark:border-gray-700">
              v1.0 (Beta)
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};