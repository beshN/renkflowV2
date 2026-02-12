'use client';

import { memo, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, Moon, Sun, X } from 'lucide-react';
import { useTheme } from 'next-themes';

import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { PRIMARY_NAV_CTA, PRIMARY_NAV_ITEMS } from '@/lib/config/primary-navigation';
import { cn } from '@/lib/utils';

interface UnifiedNavbarProps {
  largeLogo?: boolean;
  transparent?: boolean;
}

const MOBILE_QUICK_LINKS = [
  { label: 'Sign in', href: '/auth/login' },
  { label: 'Create account', href: '/signup' },
];

export const UnifiedNavbar = memo(({ largeLogo = false, transparent = false }: UnifiedNavbarProps) => {
  const pathname = usePathname();
  const { setTheme, resolvedTheme } = useTheme();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  const isItemActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
          isScrolled
            ? 'rf-topbar shadow-[0_18px_35px_-28px_rgba(27,21,14,0.5)]'
            : transparent
              ? 'bg-transparent'
              : 'bg-[color-mix(in_srgb,var(--rf-surface)_72%,transparent)] backdrop-blur-xl border-b border-[color-mix(in_srgb,var(--rf-border)_74%,transparent)]'
        )}
      >
        <div className="rf-page-wrap">
          <div className="flex h-20 items-center justify-between gap-4">
            <Link
              href="/"
              className={cn(
                'inline-flex items-center',
                largeLogo && 'absolute top-4 left-6 md:top-6 md:left-12 z-[60]'
              )}
            >
              <Image
                src="/email-assets/header-logo.png"
                alt="RenkFlow"
                width={442}
                height={88}
                sizes={largeLogo ? '(max-width: 768px) 150px, 190px' : '(max-width: 768px) 150px, 180px'}
                className="h-8 w-auto object-contain md:h-9"
                priority
              />
            </Link>

            <nav className="hidden lg:flex items-center gap-2">
              {PRIMARY_NAV_ITEMS.map((item) => {
                const active = isItemActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'rounded-xl px-4 py-2 text-[15px] font-medium transition-colors',
                      active
                        ? 'text-[var(--rf-text)] bg-[color-mix(in_srgb,var(--rf-surface-soft)_78%,transparent)]'
                        : 'text-[var(--rf-text-muted)] hover:text-[var(--rf-text)]'
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="hidden lg:flex items-center gap-2">
              <LanguageSelector variant="dropdown" showLabel={false} />
              {mounted && (
                <button
                  onClick={toggleTheme}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-[color-mix(in_srgb,var(--rf-border)_86%,transparent)] text-[var(--rf-text-muted)] hover:text-[var(--rf-text)] hover:bg-[color-mix(in_srgb,var(--rf-surface-soft)_76%,transparent)] transition-colors"
                  aria-label="Toggle theme"
                >
                  {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>
              )}
              <Link
                href={PRIMARY_NAV_CTA.href}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-[color-mix(in_srgb,var(--rf-border)_94%,transparent)] bg-[color-mix(in_srgb,var(--rf-surface)_96%,transparent)] px-6 text-[15px] font-semibold text-[var(--rf-text)] shadow-[0_12px_32px_-26px_rgba(27,21,14,0.6)] transition-all hover:translate-y-[-1px] hover:shadow-[0_18px_36px_-24px_rgba(27,21,14,0.68)]"
              >
                {PRIMARY_NAV_CTA.label}
              </Link>
            </div>

            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[color-mix(in_srgb,var(--rf-border)_86%,transparent)] bg-[color-mix(in_srgb,var(--rf-surface)_88%,transparent)] text-[var(--rf-text)]"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
              aria-label="Close menu backdrop"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 280, damping: 30 }}
              className="fixed right-0 top-0 bottom-0 z-[70] w-[320px] border-l border-[color-mix(in_srgb,var(--rf-border)_88%,transparent)] bg-[color-mix(in_srgb,var(--rf-surface)_96%,transparent)] p-6 backdrop-blur-xl"
            >
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-[var(--rf-text)]">Navigation</span>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[color-mix(in_srgb,var(--rf-border)_86%,transparent)] text-[var(--rf-text-muted)]"
                  aria-label="Close menu"
                >
                  <X size={18} />
                </button>
              </div>

              <nav className="mt-8 space-y-2">
                {PRIMARY_NAV_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'block rounded-xl px-3 py-2.5 text-base font-medium transition-colors',
                      isItemActive(item.href)
                        ? 'bg-[color-mix(in_srgb,var(--rf-surface-soft)_80%,transparent)] text-[var(--rf-text)]'
                        : 'text-[var(--rf-text-muted)] hover:text-[var(--rf-text)]'
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              <div className="mt-6 grid grid-cols-2 gap-2">
                {MOBILE_QUICK_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-[color-mix(in_srgb,var(--rf-border)_88%,transparent)] text-sm font-medium text-[var(--rf-text-muted)]"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              <Link
                href={PRIMARY_NAV_CTA.href}
                className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-2xl border border-[color-mix(in_srgb,var(--rf-border)_94%,transparent)] bg-[color-mix(in_srgb,var(--rf-surface)_96%,transparent)] px-4 text-sm font-semibold text-[var(--rf-text)]"
              >
                {PRIMARY_NAV_CTA.label}
              </Link>

              <div className="mt-6 flex items-center justify-between rounded-2xl border border-[color-mix(in_srgb,var(--rf-border)_88%,transparent)] px-3 py-2.5">
                <LanguageSelector variant="dropdown" showLabel={false} />
                {mounted ? (
                  <button
                    onClick={toggleTheme}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[color-mix(in_srgb,var(--rf-border)_86%,transparent)] text-[var(--rf-text-muted)]"
                    aria-label="Toggle theme"
                  >
                    {resolvedTheme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
                  </button>
                ) : (
                  <div className="h-9 w-9" />
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
});

UnifiedNavbar.displayName = 'UnifiedNavbar';
