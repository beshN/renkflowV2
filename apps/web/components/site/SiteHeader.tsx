'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowRight, Menu, Moon, Sun, X } from 'lucide-react';
import { BrandMark } from '@/components/brand/BrandMark';
import { cn } from '@/lib/utils';

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
    <button type="button" aria-label="Temayı değiştir" onClick={() => setTheme(dark ? 'light' : 'dark')} className="rf-icon-button inline-flex h-8 w-8 items-center justify-center text-muted-foreground">
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

/** Public site header: hairline appears once the page scrolls. */
export function SiteHeader() {
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
  // Pages that open on the dark blueprint hero get a light-on-dark header until scrolled.
  const overDark = pathname === '/' && !scrolled;

  return (
    <header className={cn('sticky top-0 z-50 transition-[background-color,border-color,color] duration-200', scrolled ? 'border-b border-border bg-background/80 backdrop-blur-md' : 'border-b border-transparent', overDark && 'rf-on-dark dark text-white')}>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-5 sm:px-8">
        <BrandMark href="/" tone={overDark ? 'light' : 'auto'} />
        <nav aria-label="Ana menü" className="hidden items-center gap-1 md:flex">
          {SITE_NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={cn('rounded-md px-3 py-1.5 text-[13.5px] transition-colors', active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Link href="/auth/login" className="hidden rounded-md px-3 py-1.5 text-[13.5px] text-muted-foreground transition-colors hover:text-foreground sm:block">Giriş yap</Link>
          <Link href="/contact" className="rf-ink-button group h-8 whitespace-nowrap px-3.5 text-[13px] max-sm:!hidden">
            Demo talep edin <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
              <button type="button" aria-label="Menüyü aç" className="rf-icon-button inline-flex h-8 w-8 items-center justify-center md:hidden"><Menu size={18} /></button>
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
                  <Link href="/auth/login" className="rf-secondary-button h-10">Giriş yap</Link>
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
