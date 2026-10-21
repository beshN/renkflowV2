'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { switchThemeWithReveal } from '@/lib/shared/utils/theme-reveal';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowRight, Menu, Moon, Sun, X } from 'lucide-react';
import { BrandMark } from '@/components/brand/BrandMark';
import { cn } from '@/lib/utils';

/** RAL 9016, 9006, 7016 and 8017, then the accent colour, the brand strip shared with the workspace menu. */
const RAL_STRIP = ['#f1f0ea', '#a5a8a6', '#4a5256', '#6b4a3a', 'var(--acc-chrome)'];

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
    <button type="button" aria-label="Temayı değiştir" onClick={(event) => switchThemeWithReveal(dark ? 'light' : 'dark', setTheme, event.currentTarget)} className="rf-icon-button inline-flex h-8 w-8 items-center justify-center text-muted-foreground">
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

/** Public site header: hairline appears once the page scrolls. */
export function SiteHeader({ signedIn = false }: { signedIn?: boolean }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className={cn('rf-site-header sticky top-0 z-50 transition-shadow duration-200', scrolled && 'shadow-[0_8px_24px_-16px_rgb(0_0_0/0.6)]')}>
      <div aria-hidden className="rf-ral-strip">{RAL_STRIP.map((c) => <span key={c} style={{ background: c }} />)}</div>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-5 sm:px-8">
        <BrandMark href="/" />
        <nav aria-label="Ana menü" className="hidden items-center gap-1 md:flex">
          {SITE_NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={cn('rounded-[4px] px-3 py-1.5 text-[13.5px] transition-colors', active ? 'text-[var(--chrome-fg)] shadow-[inset_0_-2px_0_var(--rf-mark)]' : 'text-[var(--chrome-muted)] hover:text-[var(--chrome-fg)]')}>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Link href={signedIn ? '/dashboard' : '/auth/login'} className="hidden rounded-[4px] px-3 py-1.5 text-[13.5px] text-[var(--chrome-muted)] transition-colors hover:text-[var(--chrome-fg)] sm:block">{signedIn ? 'Panele git' : 'Giriş yap'}</Link>
          <Link href="/contact" className="rf-accent-button h-8 whitespace-nowrap px-3.5 text-[13px] max-sm:!hidden">Demo talep edin</Link>
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
              <button type="button" aria-label="Menüyü aç" className="rf-icon-button inline-flex h-8 w-8 items-center justify-center md:!hidden"><Menu size={18} /></button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/30 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 md:hidden" />
              <Dialog.Content className="fixed inset-x-3 top-3 z-[71] rounded-xl border border-border bg-popover p-5 shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 md:hidden">
                <div className="flex items-center justify-between">
                  <Dialog.Title asChild><span><BrandMark href="/" /></span></Dialog.Title>
                  <Dialog.Close aria-label="Menüyü kapat" className="rf-icon-button inline-flex h-8 w-8 items-center justify-center"><X size={18} /></Dialog.Close>
                </div>
                <Dialog.Description className="sr-only">Site bağlantıları</Dialog.Description>
                <nav aria-label="Mobil menü" className="mt-5 grid">
                  {SITE_NAV.map((item) => (
                    <Link key={item.href} href={item.href} className="flex items-center justify-between border-b border-border py-3 text-[15px] last:border-0">
                      {item.label}<ArrowRight size={15} className="text-muted-foreground" />
                    </Link>
                  ))}
                </nav>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <Link href={signedIn ? '/dashboard' : '/auth/login'} className="rf-secondary-button h-10">{signedIn ? 'Panele git' : 'Giriş yap'}</Link>
                  <Link href="/contact" className="rf-ink-button h-10 text-[13px]">Demo talep edin</Link>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </div>
    </header>
  );
}
