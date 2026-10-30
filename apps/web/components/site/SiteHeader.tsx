'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowRight, Menu, Moon, Sun, X } from 'lucide-react';
import { switchThemeWithReveal } from '@/lib/shared/utils/theme-reveal';
import { BrandMark } from '@/components/brand/BrandMark';
import { cn } from '@/lib/utils';

/** RAL 9016, 9006, 7016 and 8017, then the accent colour, the brand strip shared with the workspace menu. */
const RAL_STRIP = ['#f1f0ea', '#a5a8a6', '#4a5256', '#6b4a3a', 'var(--acc-chrome)'];
const EASE = [0.2, 0.8, 0.2, 1] as const;

export const SITE_NAV = [
  { label: 'Özellikler', href: '/features' },
  { label: 'Entegrasyonlar', href: '/integrations' },
  { label: 'Güvenlik', href: '/security' },
  { label: 'Fiyatlandırma', href: '/pricing' },
  { label: 'İletişim', href: '/contact' },
];

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === 'dark';
  return (
    <button type="button" aria-label="Temayı değiştir" onClick={(event) => switchThemeWithReveal(dark ? 'light' : 'dark', setTheme, event.currentTarget)} className="relative grid h-8 w-8 place-items-center overflow-hidden rounded-[var(--x-r-control)] text-[var(--x-chrome-muted)] transition-colors hover:bg-white/[0.07] hover:text-[var(--x-chrome-fg)]">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={dark ? 'sun' : 'moon'} initial={{ y: 10, opacity: 0, rotate: -30 }} animate={{ y: 0, opacity: 1, rotate: 0 }} exit={{ y: -10, opacity: 0, rotate: 30 }} transition={{ duration: 0.2, ease: EASE }}>
          {dark ? <Sun size={15} /> : <Moon size={15} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

/**
 * Public site header. The hover highlight follows the pointer across the links, the current page
 * carries a bronze rule, and the bar turns translucent once the page scrolls.
 */
export function SiteHeader({ signedIn = false }: { signedIn?: boolean }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header data-scrolled={scrolled} className="x-header rf-site-header sticky top-0 z-50 text-[var(--x-chrome-fg)]">
      <div aria-hidden className="rf-ral-strip">{RAL_STRIP.map((c) => <span key={c} style={{ background: c }} />)}</div>
      <div className="mx-auto flex h-[60px] max-w-6xl items-center gap-6 px-5 sm:px-8">
        <BrandMark href="/" tone="light" />
        <nav aria-label="Ana menü" className="hidden md:block" onMouseLeave={() => setHover(null)}>
          <LayoutGroup id="site-nav">
            <ul className="flex items-center">
              {SITE_NAV.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href} className="relative">
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      onMouseEnter={() => setHover(item.href)}
                      onFocus={() => setHover(item.href)}
                      className={cn('relative block px-3 py-1.5 text-[13.5px] transition-colors duration-150', active ? 'text-[var(--x-chrome-fg)]' : 'text-[var(--x-chrome-muted)] hover:text-[var(--x-chrome-fg)]')}
                    >
                      {hover === item.href && <motion.span layoutId="site-nav-hover" transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 40 }} className="absolute inset-0 rounded-[var(--x-r-control)] bg-white/[0.07]" />}
                      <span className="relative">{item.label}</span>
                      {active && <motion.span layoutId="site-nav-active" transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 36 }} className="absolute inset-x-3 -bottom-[13px] h-[2px] rounded-full bg-[var(--x-bronze-fill)]" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </LayoutGroup>
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          <Link href={signedIn ? '/dashboard' : '/auth/login'} className="hidden rounded-[var(--x-r-control)] px-3 py-1.5 text-[13.5px] text-[var(--x-chrome-muted)] transition-colors hover:bg-white/[0.07] hover:text-[var(--x-chrome-fg)] sm:block">{signedIn ? 'Panele git' : 'Giriş yap'}</Link>
          <Link href="/contact" className="x-btn x-btn-primary !h-8 !px-3.5 !text-[13px] max-sm:!hidden">Demo talep edin</Link>
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
              <button type="button" aria-label="Menüyü aç" className="grid h-9 w-9 place-items-center rounded-[var(--x-r-control)] text-[var(--x-chrome-fg)] hover:bg-white/[0.07] md:hidden"><Menu size={18} /></button>
            </Dialog.Trigger>
            <AnimatePresence>
              {open && (
                <Dialog.Portal forceMount>
                  <Dialog.Overlay asChild forceMount>
                    <motion.div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-[2px] md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
                  </Dialog.Overlay>
                  <Dialog.Content asChild forceMount>
                    <motion.div className="rfx fixed inset-x-0 top-0 z-[71] rounded-b-[16px] !bg-[var(--x-chrome)] px-5 pb-6 pt-4 !text-[var(--x-chrome-fg)] shadow-[0_24px_48px_-16px_rgb(0_0_0/0.6)] outline-none md:hidden" initial={{ y: '-100%' }} animate={{ y: 0 }} exit={{ y: '-100%' }} transition={reduce ? { duration: 0 } : { duration: 0.32, ease: EASE }}>
                      <div className="flex items-center justify-between">
                        <Dialog.Title asChild><span><BrandMark href="/" tone="light" /></span></Dialog.Title>
                        <Dialog.Close aria-label="Menüyü kapat" className="grid h-9 w-9 place-items-center rounded-[var(--x-r-control)] hover:bg-white/[0.07]"><X size={18} /></Dialog.Close>
                      </div>
                      <Dialog.Description className="sr-only">Site bağlantıları</Dialog.Description>
                      <nav aria-label="Mobil menü" className="mt-4">
                        <ul>
                          {SITE_NAV.map((item, i) => (
                            <motion.li key={item.href} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={reduce ? { duration: 0 } : { duration: 0.28, delay: 0.06 + i * 0.035, ease: EASE }}>
                              <Link href={item.href} aria-current={pathname === item.href ? 'page' : undefined} className="flex items-center justify-between border-b border-[var(--x-chrome-line)] py-3.5 text-[16px]">
                                <span className="flex items-center gap-2.5">{pathname === item.href && <span className="h-1.5 w-1.5 rounded-full bg-[var(--x-bronze-fill)]" />}{item.label}</span>
                                <ArrowRight size={15} className="text-[var(--x-chrome-muted)]" />
                              </Link>
                            </motion.li>
                          ))}
                        </ul>
                      </nav>
                      <div className="mt-5 grid grid-cols-2 gap-2">
                        <Link href={signedIn ? '/dashboard' : '/auth/login'} className="x-btn x-btn-ghost-dark">{signedIn ? 'Panele git' : 'Giriş yap'}</Link>
                        <Link href="/contact" className="x-btn x-btn-primary">Demo talep edin</Link>
                      </div>
                    </motion.div>
                  </Dialog.Content>
                </Dialog.Portal>
              )}
            </AnimatePresence>
          </Dialog.Root>
        </div>
      </div>
    </header>
  );
}
