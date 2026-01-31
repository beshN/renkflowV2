'use client';

import { useTheme } from '@/lib/context/ThemeContext';

interface NavbarProps {
  title: string;
  showSearch?: boolean;
  onSearch?: (term: string) => void;
}

export function Navbar({ title, showSearch = true, onSearch }: NavbarProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 border-b border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark">
      <div className="flex h-16 items-center gap-4 px-6">
        {/* Title */}
        <h1 className="text-2xl font-semibold text-text-light dark:text-text-dark">
          {title}
        </h1>

        {/* Search Bar */}
        {showSearch && (
          <div className="flex-1 max-w-md">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-subtle-light dark:text-subtle-dark text-[20px]">
                search
              </span>
              <input
                type="text"
                placeholder="Ara..."
                onChange={(e) => onSearch?.(e.target.value)}
                className="w-full rounded-lg border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark px-10 py-2 text-sm text-text-light dark:text-text-dark placeholder:text-subtle-light dark:placeholder:text-subtle-dark focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
        )}

        <div className="flex-1"></div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="flex size-10 items-center justify-center rounded-lg hover:bg-card-light dark:hover:bg-card-dark transition-colors"
            aria-label="Toggle dark mode"
          >
            <span className="material-symbols-outlined text-[20px] text-subtle-light dark:text-subtle-dark">
              {theme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
          </button>

          {/* Notifications */}
          <button
            className="relative flex size-10 items-center justify-center rounded-lg hover:bg-card-light dark:hover:bg-card-dark transition-colors"
            aria-label="Notifications"
          >
            <span className="material-symbols-outlined text-[20px] text-subtle-light dark:text-subtle-dark">
              notifications
            </span>
            <span className="absolute top-2 right-2 size-2 rounded-full bg-red-500"></span>
          </button>

          {/* User Menu */}
          <div className="flex items-center gap-2 rounded-lg border border-border-light dark:border-border-dark px-3 py-2">
            <div className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary">
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
