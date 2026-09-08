'use client';

import { ReactNode, useState } from 'react';
import { useTheme } from 'next-themes';
import { Search, Bell, Sun, Moon, Command } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AppleNavbarProps {
  title: string;
  showSearch?: boolean;
  action?: ReactNode;
}

export function AppleNavbar({ title, showSearch = true, action }: AppleNavbarProps) {
  const { setTheme, theme } = useTheme();
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  return (
    <motion.header
      className={cn(
        "sticky top-0 z-40 h-16 px-6 flex items-center justify-between",
        "bg-white/70 dark:bg-black/60 backdrop-blur-2xl border-b border-black/5 dark:border-white/5",
        "transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
      )}
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
    >
      {/* Title / Breadcrumbs */}
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold tracking-tight text-foreground font-display">
          {title}
        </h1>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4">
        {action}
        {/* Search Bar */}
        {showSearch && (
          <div
            className={cn(
              "relative hidden md:flex items-center transition-all duration-300 ease-out",
              isSearchFocused ? "w-80" : "w-64"
            )}
          >
            <Search className="absolute left-3 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full h-9 pl-9 pr-4 rounded-lg bg-black/5 dark:bg-white/10 border-none outline-none text-sm focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/70"
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
            />
            <div className="absolute right-3 hidden md:flex items-center gap-1 opacity-50">
              <Command className="w-3 h-3" />
              <span className="text-[10px]">K</span>
            </div>
          </div>
        )}

        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-all"
        >
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </button>

        {/* Notifications */}
        <button className="relative w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-all">
          <Bell size={20} />
          <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-black" />
        </button>

      </div>
    </motion.header>
  );
}
