'use client';

import { useTheme } from 'next-themes';
import { useState, useEffect, useRef } from 'react';
import { Search, Sun, Moon, Bell, LogOut, User, Settings, Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { PRIMARY_NAV_CTA, PRIMARY_NAV_ITEMS } from '@/lib/config/primary-navigation';
import { cn } from '@/lib/utils';

interface NavbarProps {
  title: string;
  showSearch?: boolean;
  onSearch?: (term: string) => void;
  showPrimaryNav?: boolean;
  showCta?: boolean;
  compactTitleRow?: boolean;
}

export function Navbar({
  title,
  showSearch = true,
  onSearch,
  showPrimaryNav = true,
  showCta = true,
  compactTitleRow = true,
}: NavbarProps) {
  const pathname = usePathname();
  const { setTheme, resolvedTheme } = useTheme();
  const { user } = useAuth();
  const [searchValue, setSearchValue] = useState('');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobilePrimaryNavOpen, setIsMobilePrimaryNavOpen] = useState(false);
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setIsMobilePrimaryNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = isMobilePrimaryNavOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobilePrimaryNavOpen]);

  const handleLogout = () => {
    signOut({ callbackUrl: '/auth/login' });
  };

  const isPrimaryNavActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const SearchField = (
    <div className="relative group w-full">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--rf-text-muted)]/80 w-4 h-4 transition-colors group-focus-within:text-[var(--rf-text)]" />
      <input
        type="text"
        placeholder="Search..."
        aria-label={`${title} içinde ara`}
        value={searchValue}
        onChange={(event) => setSearchValue(event.target.value)}
        className="w-full rounded-xl pl-10 pr-4 py-2.5 text-sm bg-[color-mix(in_srgb,var(--rf-surface)_95%,transparent)] border border-[color-mix(in_srgb,var(--rf-border)_86%,transparent)] focus:bg-[color-mix(in_srgb,var(--rf-surface)_100%,transparent)] focus:border-[color-mix(in_srgb,var(--rf-border)_100%,var(--rf-accent)_30%)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--rf-accent)_14%,transparent)] transition-all outline-none placeholder:text-[var(--rf-text-muted)]/70"
      />
    </div>
  );

  return (
    <>
      <header
        role="banner"
        className="rf-topbar sticky top-0 z-40 border-b border-[color-mix(in_srgb,var(--rf-border)_85%,transparent)] shadow-[0_14px_30px_-28px_rgba(27,21,14,0.62)] transition-all duration-300"
      >
        <div className="rf-page-wrap" role="navigation" aria-label="Primary navigation">
          <div className="flex h-16 items-center gap-3">
            <div className="flex items-center gap-2">
              {showPrimaryNav && (
                <button
                  onClick={() => setIsMobilePrimaryNavOpen(true)}
                  className="xl:hidden flex size-10 items-center justify-center rounded-xl border border-[color-mix(in_srgb,var(--rf-border)_86%,transparent)] text-[var(--rf-text-muted)] hover:text-[var(--rf-text)] hover:bg-[color-mix(in_srgb,var(--rf-surface-soft)_78%,transparent)] transition-colors"
                  aria-label="Open primary navigation"
                >
                  <Menu size={18} />
                </button>
              )}

              <Link href="/dashboard" className="inline-flex items-center rounded-xl py-1 pl-1 pr-2">
                <Image
                  src="/email-assets/header-logo.png"
                  alt="RenkFlow"
                  width={442}
                  height={88}
                  sizes="(max-width: 768px) 130px, 160px"
                  className="h-7 w-auto object-contain"
                  priority
                />
              </Link>
            </div>

            {showPrimaryNav && (
              <nav className="hidden xl:flex items-center gap-1 flex-1 min-w-0">
                {PRIMARY_NAV_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                      isPrimaryNavActive(item.href)
                        ? 'text-[var(--rf-text)] bg-[color-mix(in_srgb,var(--rf-surface-soft)_80%,transparent)]'
                        : 'text-[var(--rf-text-muted)] hover:text-[var(--rf-text)]'
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            )}

            <div className="flex-1" />

            <div className="flex items-center gap-2 sm:gap-3">
              <LanguageSelector variant="dropdown" showLabel={false} showFlag={true} className="mr-1" />

              <button
                onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                className="flex size-9 items-center justify-center rounded-xl text-[var(--rf-text-muted)] hover:text-[var(--rf-text)] hover:bg-[color-mix(in_srgb,var(--rf-surface-soft)_78%,transparent)] border border-[color-mix(in_srgb,var(--rf-border)_84%,transparent)] transition-colors"
                aria-label="Toggle dark mode"
              >
                {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              <button
                className="relative flex size-9 items-center justify-center rounded-xl text-[var(--rf-text-muted)] hover:text-[var(--rf-text)] hover:bg-[color-mix(in_srgb,var(--rf-surface-soft)_78%,transparent)] border border-[color-mix(in_srgb,var(--rf-border)_84%,transparent)] transition-colors"
                aria-label="Notifications"
              >
                <Bell size={18} />
                <span className="absolute top-2 right-2 size-2 rounded-full bg-[var(--rf-accent)] ring-2 ring-[var(--rf-surface)]"></span>
              </button>

              {showCta && (
                <Link
                  href={PRIMARY_NAV_CTA.href}
                  className="hidden md:inline-flex h-10 items-center justify-center rounded-2xl border border-[color-mix(in_srgb,var(--rf-border)_94%,transparent)] bg-[color-mix(in_srgb,var(--rf-surface)_96%,transparent)] px-4 text-sm font-semibold text-[var(--rf-text)] shadow-[0_12px_30px_-24px_rgba(27,21,14,0.6)] transition-all hover:translate-y-[-1px] hover:shadow-[0_16px_34px_-22px_rgba(27,21,14,0.65)]"
                >
                  {PRIMARY_NAV_CTA.label}
                </Link>
              )}

              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--rf-border)_88%,transparent)] bg-[color-mix(in_srgb,var(--rf-surface)_92%,transparent)] pl-1 pr-3 py-1 shadow-[0_8px_24px_-18px_rgba(27,21,14,0.52)] hover:shadow-[0_14px_28px_-18px_rgba(27,21,14,0.58)] transition-all group"
                >
                  <div className="relative size-7 rounded-full overflow-hidden ring-2 ring-[var(--rf-surface)] shrink-0">
                    {user?.avatar ? (
                      <Image
                        src={user.avatar}
                        alt={user.name || 'User'}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[var(--rf-accent)] to-[var(--rf-accent-strong)] flex items-center justify-center text-white text-xs font-bold">
                        {(user?.name || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="text-sm font-medium text-[var(--rf-text)] max-w-[120px] truncate hidden sm:block">
                    {user?.name || 'Kullanıcı'}
                  </span>
                </button>

                {isProfileOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-[color-mix(in_srgb,var(--rf-surface)_97%,transparent)] border border-[color-mix(in_srgb,var(--rf-border)_88%,transparent)] shadow-[0_22px_38px_-22px_rgba(20,12,7,0.64)] overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                    <div className="p-3 border-b border-[color-mix(in_srgb,var(--rf-border)_66%,transparent)]">
                      <p className="text-sm font-semibold text-[var(--rf-text)] truncate">{user?.name}</p>
                      <p className="text-xs text-[var(--rf-text-muted)] truncate">{user?.email}</p>
                    </div>
                    <div className="p-1">
                      <Link
                        href="/settings"
                        onClick={() => setIsProfileOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--rf-text-muted)] hover:bg-[color-mix(in_srgb,var(--rf-surface-soft)_72%,transparent)] rounded-lg transition-colors"
                      >
                        <User size={16} />
                        Profilim
                      </Link>
                      <Link
                        href="/settings"
                        onClick={() => setIsProfileOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--rf-text-muted)] hover:bg-[color-mix(in_srgb,var(--rf-surface-soft)_72%,transparent)] rounded-lg transition-colors"
                      >
                        <Settings size={16} />
                        Ayarlar
                      </Link>
                    </div>
                    <div className="p-1 border-t border-[color-mix(in_srgb,var(--rf-border)_66%,transparent)]">
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50/80 dark:hover:bg-red-950/25 rounded-lg transition-colors"
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

          {compactTitleRow && (
            <div className="flex min-h-14 items-center gap-3 border-t border-[color-mix(in_srgb,var(--rf-border)_68%,transparent)] py-2">
              <h1 className="text-xl md:text-2xl font-semibold text-[var(--rf-text)] font-display tracking-[-0.03em] whitespace-nowrap">
                {title}
              </h1>
              {showSearch ? (
                <div className="w-full max-w-xl ml-auto">
                  {SearchField}
                </div>
              ) : (
                <div className="flex-1" />
              )}
            </div>
          )}

          {!compactTitleRow && showSearch && (
            <div className="pb-3">
              {SearchField}
            </div>
          )}
        </div>
      </header>

      {showPrimaryNav && isMobilePrimaryNavOpen && (
        <div className="xl:hidden fixed inset-0 z-[70]">
          <button
            onClick={() => setIsMobilePrimaryNavOpen(false)}
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            aria-label="Close primary navigation backdrop"
          />
          <aside className="absolute left-0 top-0 bottom-0 w-[320px] max-w-[88vw] border-r border-[color-mix(in_srgb,var(--rf-border)_88%,transparent)] bg-[color-mix(in_srgb,var(--rf-surface)_97%,transparent)] p-5 shadow-[0_20px_40px_-18px_rgba(17,12,8,0.6)]">
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold text-[var(--rf-text)]">Navigation</span>
              <button
                onClick={() => setIsMobilePrimaryNavOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[color-mix(in_srgb,var(--rf-border)_86%,transparent)] text-[var(--rf-text-muted)]"
                aria-label="Close primary navigation"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="mt-6 space-y-2">
              {PRIMARY_NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'block rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                    isPrimaryNavActive(item.href)
                      ? 'bg-[color-mix(in_srgb,var(--rf-surface-soft)_80%,transparent)] text-[var(--rf-text)]'
                      : 'text-[var(--rf-text-muted)]'
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {showCta && (
              <Link
                href={PRIMARY_NAV_CTA.href}
                className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-2xl border border-[color-mix(in_srgb,var(--rf-border)_94%,transparent)] bg-[color-mix(in_srgb,var(--rf-surface)_96%,transparent)] px-4 text-sm font-semibold text-[var(--rf-text)]"
              >
                {PRIMARY_NAV_CTA.label}
              </Link>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
