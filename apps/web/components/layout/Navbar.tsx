'use client';

import { useTheme } from 'next-themes';
import { useState, useEffect, useRef } from 'react';
import { Search, Sun, Moon, Bell, LogOut, User, Settings } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { LanguageSelector } from '@/components/ui/LanguageSelector';

interface NavbarProps {
  title: string;
  showSearch?: boolean;
  onSearch?: (term: string) => void;
}

export function Navbar({ title, showSearch = true, onSearch }: NavbarProps) {
  const { setTheme, resolvedTheme } = useTheme();
  const { user } = useAuth();
  const [searchValue, setSearchValue] = useState('');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>();
  const profileRef = useRef<HTMLDivElement>(null);

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

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    signOut({ callbackUrl: '/auth/login' });
  };

  return (
    <header role="banner" className="rf-topbar sticky top-0 z-40 border-b border-white/40 dark:border-slate-800/60 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl transition-all duration-300">
      <div className="rf-page-wrap flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8" role="navigation" aria-label="Ana navigasyon">
        {/* Title */}
        <h1 className="text-[1.35rem] font-semibold text-slate-900 dark:text-white tracking-tight font-display">
          {title}
        </h1>

        {/* Search Bar */}
        {showSearch && (
          <div className="flex-1 max-w-md hidden md:block">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4 transition-colors group-focus-within:text-slate-600 dark:group-focus-within:text-slate-300" />
              <input
                type="text"
                placeholder="Ara..."
                aria-label={`${title} içinde ara`}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="w-full rounded-xl pl-10 pr-4 py-2 text-sm bg-slate-100/50 dark:bg-slate-800/50 border border-transparent focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none placeholder:text-slate-500/80"
              />
            </div>
          </div>
        )}

        <div className="flex-1"></div>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSelector variant="dropdown" showLabel={false} showFlag={true} className="mr-1" />

          {/* Dark Mode Toggle */}
          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="flex size-9 items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 border border-transparent hover:border-slate-200/60 dark:hover:border-slate-700/60 transition-all"
            aria-label="Toggle dark mode"
          >
            {resolvedTheme === 'dark' ? (
              <Sun size={18} />
            ) : (
              <Moon size={18} />
            )}
          </button>

          {/* Notifications */}
          <button
            className="relative flex size-9 items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 border border-transparent hover:border-slate-200/60 dark:hover:border-slate-700/60 transition-all"
            aria-label="Notifications"
          >
            <Bell size={18} />
            <span className="absolute top-2 right-2 size-2 rounded-full bg-indigo-500 ring-2 ring-white dark:ring-slate-900" />
          </button>

          <div className="h-6 w-px bg-slate-200/60 dark:bg-slate-800/60 mx-1 hidden sm:block"></div>

          {/* User Menu */}
          <div className="relative" ref={profileRef}>
            <button 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2 rounded-xl border border-transparent hover:border-slate-200/60 dark:hover:border-slate-700/60 bg-transparent hover:bg-slate-50/80 dark:hover:bg-slate-800/50 pl-1 pr-3 py-1 transition-all group"
            >
              <div className="relative size-8 rounded-lg overflow-hidden ring-1 ring-slate-200/60 dark:ring-slate-700/60 shrink-0 shadow-sm">
                {user?.avatar ? (
                  <Image 
                    src={user.avatar} 
                    alt={user.name || 'User'} 
                    fill 
                    className="object-cover"
                    unoptimized 
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold">
                    {(user?.name || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 max-w-[100px] truncate leading-tight">
                    {user?.name || 'Kullanıcı'}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 max-w-[100px] truncate leading-tight">
                    {user?.email || ''}
                </p>
              </div>
            </button>

            {/* Dropdown Menu */}
            {isProfileOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border border-white/20 dark:border-slate-800/50 shadow-xl shadow-slate-900/5 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right ring-1 ring-slate-900/5">
                <div className="p-3 border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/50">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{user?.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
                </div>
                <div className="p-1.5 space-y-0.5">
                  <Link 
                    href="/settings" 
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-lg transition-colors"
                  >
                    <User size={16} />
                    Profilim
                  </Link>
                  <Link 
                    href="/settings" 
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-lg transition-colors"
                  >
                    <Settings size={16} />
                    Ayarlar
                  </Link>
                </div>
                <div className="p-1.5 border-t border-slate-100 dark:border-slate-800/50">
                  <button 
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                  >
                    <LogOut size={16} />
                    Çıkış Yap
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
