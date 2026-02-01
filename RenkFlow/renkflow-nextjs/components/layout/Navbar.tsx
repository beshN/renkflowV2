'use client';

import { useTheme } from 'next-themes';
import { useState, useEffect, useRef } from 'react';
import { Search, Sun, Moon, Bell } from 'lucide-react';

interface NavbarProps {
  title: string;
  showSearch?: boolean;
  onSearch?: (term: string) => void;
}

export function Navbar({ title, showSearch = true, onSearch }: NavbarProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [searchValue, setSearchValue] = useState('');
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      onSearch?.(searchValue);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchValue, onSearch]);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 dark:border-slate-800 bg-transparent backdrop-blur-xl">
      <div className="flex h-16 items-center gap-4 px-6">
        {/* Title */}
        <h1 className="text-2xl font-semibold text-text-light dark:text-text-dark font-display">
          {title}
        </h1>

        {/* Search Bar */}
        {showSearch && (
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle-light dark:text-subtle-dark w-5 h-5" />
              <input
                type="text"
                placeholder="Ara..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="input-professional w-full rounded-xl px-10 py-2 text-sm"
              />
            </div>
          </div>
        )}

        <div className="flex-1"></div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* Dark Mode Toggle */}
          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="flex size-10 items-center justify-center rounded-xl hover:bg-slate-100/80 dark:hover:bg-slate-800/70 transition-colors"
            aria-label="Toggle dark mode"
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="text-subtle-light dark:text-subtle-dark w-5 h-5" />
            ) : (
              <Moon className="text-subtle-light dark:text-subtle-dark w-5 h-5" />
            )}
          </button>

          {/* Notifications */}
          <button
            className="relative flex size-10 items-center justify-center rounded-xl hover:bg-slate-100/80 dark:hover:bg-slate-800/70 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="text-subtle-light dark:text-subtle-dark w-5 h-5" />
            <span className="absolute top-2 right-2 size-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900"></span>
          </button>

          {/* User Menu */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 px-3 py-2 shadow-sm glass-button hover:bg-white/60">
            <div className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-sky-600 via-blue-600 to-emerald-500 shadow-sm">
              <span className="text-white text-xs font-medium">AK</span>
            </div>
            <span className="text-sm font-medium text-text-light dark:text-text-dark">
              Admin
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
