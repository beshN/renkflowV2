'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Check, Copy, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

const EASE = [0.2, 0.8, 0.2, 1] as const;

/** Section heading: display title on the left, a short paragraph on the right on wide screens. */
export function SectionHead({ title, children, id, dark = false, className }: { title: string; children?: ReactNode; id?: string; dark?: boolean; className?: string }) {
  return (
    <div id={id} className={cn('grid scroll-mt-24 gap-4 md:grid-cols-[1fr_minmax(0,420px)] md:items-end md:gap-12', className)}>
      <h2 className="x-display max-w-[18ch] text-[clamp(28px,3.4vw,42px)] leading-[1.06] [text-wrap:balance]">{title}</h2>
      {children && <p className={cn('text-[15px] leading-[1.65]', dark ? 'text-[var(--x-chrome-muted)]' : 'text-[var(--x-muted)]')}>{children}</p>}
    </div>
  );
}

/** Rises into place once, the first time it scrolls into view; instant with reduced motion. */
export function Surface({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '0px 0px -10% 0px' }} transition={reduce ? { duration: 0 } : { duration: 0.6, delay, ease: EASE }}>
      {children}
    </motion.div>
  );
}

/** Term and detail rows on hairlines; a bronze edge slides in on hover. */
export function FactList({ items, className }: { items: ReadonlyArray<{ title: string; detail: ReactNode }>; className?: string }) {
  return (
    <dl className={cn('isolate border-t border-[var(--x-line)]', className)}>
      {items.map((item) => (
        <div key={item.title} className="group relative grid gap-1 border-b border-[var(--x-line)] py-5 sm:grid-cols-[220px_1fr] sm:gap-10">
          <span aria-hidden className="absolute inset-y-1 -inset-x-4 -z-10 rounded-[var(--x-r-panel)] bg-[var(--x-surface)] opacity-0 transition-opacity duration-200 group-hover:opacity-60" />
          <span aria-hidden className="absolute inset-y-3 -left-4 w-[2px] origin-top scale-y-0 rounded-full bg-[var(--x-bronze-fill)] transition-transform duration-300 group-hover:scale-y-100" />
          <dt className="text-[14.5px] font-medium">{item.title}</dt>
          <dd className="text-[14.5px] leading-[1.7] text-[var(--x-muted)]">{item.detail}</dd>
        </div>
      ))}
    </dl>
  );
}

type RelatedLink = { href: string; title: string; detail: string };

/** "Keep reading" row that ties the public pages together. */
export function RelatedLinks({ links }: { links: readonly RelatedLink[] }) {
  return (
    <nav aria-label="İlgili sayfalar" className="mt-24">
      <p className="text-[13px] font-medium text-[var(--x-muted)]">İlgili sayfalar</p>
      <ul className="mt-4 grid border-t border-[var(--x-line)] md:grid-cols-3">
        {links.map((link) => (
          <li key={link.href} className="border-b border-[var(--x-line)] md:border-b-0 md:border-r md:pl-5 md:last:border-r-0 md:first:pl-0">
            <Link href={link.href} className="group flex h-full flex-col justify-between gap-6 py-6 pr-5">
              <span>
                <span className="flex items-center justify-between gap-3 text-[16px] font-medium">
                  <span className="x-link">{link.title}</span>
                  <ArrowUpRight size={16} className="shrink-0 text-[var(--x-faint)] transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--x-ink)]" />
                </span>
                <span className="mt-1.5 block text-[13.5px] leading-6 text-[var(--x-muted)]">{link.detail}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** The closing band shared with the home page. */
export function ClosingBand({ title = 'Kendi bir projenizle görmek ister misiniz?', detail = '30 dakikalık görüşmede örnek bir siparişinizi keşiften montaja RenkFlow’da birlikte takip ederiz.', signedIn = false }: { title?: string; detail?: string; signedIn?: boolean }) {
  return (
    <section className="x-cone text-[var(--x-chrome-fg)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-20 sm:px-8 md:flex-row md:items-end md:justify-between md:py-24">
        <div className="max-w-[560px]">
          <h2 className="x-display text-[clamp(28px,3.4vw,42px)] leading-[1.06]">{title}</h2>
          <p className="mt-4 text-[15px] leading-[1.65] text-[var(--x-chrome-muted)]">{detail}</p>
        </div>
        <div className="flex shrink-0 gap-3">
          <Link href="/contact" className="x-btn x-btn-primary">Demo talep edin</Link>
          <Link href={signedIn ? '/dashboard' : '/auth/login'} className="x-btn x-btn-ghost-dark">{signedIn ? 'Panele git' : 'Giriş yap'}</Link>
        </div>
      </div>
    </section>
  );
}

/**
 * Table of contents for long pages: the section being read is marked (the marker slides between
 * items), and the rail fills as the article is read. On small screens it folds into a disclosure.
 */
export function TocNav({ items, label = 'İçindekiler', articleId }: { items: ReadonlyArray<{ id: string; title: string }>; label?: string; articleId: string }) {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(items[0]?.id);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    }, { rootMargin: '-20% 0px -65% 0px' });
    els.forEach((el) => io.observe(el));
    const onScroll = () => {
      const article = document.getElementById(articleId);
      if (!article) return;
      const r = article.getBoundingClientRect();
      const total = r.height - window.innerHeight * 0.5;
      setProgress(Math.min(1, Math.max(0, (window.innerHeight * 0.3 - r.top) / Math.max(1, total))));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { io.disconnect(); window.removeEventListener('scroll', onScroll); };
  }, [items, articleId]);

  const list = (
    <ol className="relative mt-3 border-l border-[var(--x-line)]">
      <span aria-hidden className="absolute -left-px top-0 w-px origin-top bg-[var(--x-ink-2)]" style={{ height: '100%', transform: `scaleY(${progress})`, transition: reduce ? undefined : 'transform 120ms linear' }} />
      {items.map((item) => {
        const on = item.id === active;
        return (
          <li key={item.id} className="relative">
            {on && <motion.span layoutId={`toc-${articleId}`} transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 480, damping: 40 }} className="absolute -left-[1.5px] top-1 h-[calc(100%-8px)] w-[2px] rounded-full bg-[var(--x-bronze-fill)]" />}
            <a href={`#${item.id}`} aria-current={on ? 'location' : undefined} className={cn('block py-1.5 pl-4 text-[13px] leading-5 transition-colors duration-150', on ? 'font-medium text-[var(--x-ink)]' : 'text-[var(--x-muted)] hover:text-[var(--x-ink)]')}>{item.title}</a>
          </li>
        );
      })}
    </ol>
  );
  return (
    <>
      <nav aria-label={label} className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
        <p className="text-[12.5px] font-medium text-[var(--x-muted)]">{label}</p>
        {list}
      </nav>
      <details className="group rounded-[var(--x-r-panel)] bg-[var(--x-surface)] px-4 py-3 shadow-[var(--x-shadow-raise)] lg:hidden [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between text-[13.5px] font-medium">{label}<Plus size={15} className="text-[var(--x-muted)] transition-transform duration-200 group-open:rotate-45" aria-hidden /></summary>
        <div className="pb-1">{list}</div>
      </details>
    </>
  );
}

/** Questions that open in place with a measured height; several can be open at once. */
export function Accordion({ items }: { items: ReadonlyArray<{ title: string; detail: ReactNode }> }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState<string[]>([items[0]?.title].filter(Boolean) as string[]);
  return (
    <ul className="border-t border-[var(--x-line)]">
      {items.map((item, i) => {
        const on = open.includes(item.title);
        const id = `acc-${i}`;
        return (
          <li key={item.title} className="border-b border-[var(--x-line)]">
            <h3>
              <button type="button" aria-expanded={on} aria-controls={id} onClick={() => setOpen((list) => (on ? list.filter((t) => t !== item.title) : [...list, item.title]))} className="group flex w-full items-center justify-between gap-6 py-5 text-left text-[16px] font-medium transition-colors hover:text-[var(--x-ink)]">
                <span className="x-link">{item.title}</span>
                <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-full transition-[background-color,transform] duration-300', on ? 'rotate-45 bg-[var(--x-ink)] text-[var(--x-surface)]' : 'text-[var(--x-muted)] shadow-[inset_0_0_0_1px_var(--x-line-strong)] group-hover:bg-[var(--x-surface)]')}><Plus size={14} aria-hidden /></span>
              </button>
            </h3>
            <AnimatePresence initial={false}>
              {on && (
                <motion.div id={id} key="body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={reduce ? { duration: 0 } : { duration: 0.3, ease: EASE }} className="overflow-hidden">
                  <div className="max-w-[64ch] pb-6 pr-12 text-[15px] leading-[1.7] text-[var(--x-muted)]">{item.detail}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
}

/** Copies a value and says so for a moment; the label is read out by screen readers. */
export function CopyButton({ value, label = 'Kopyala', className, dark = false }: { value: string; label?: string; className?: string; dark?: boolean }) {
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); } catch { return; }
    setDone(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setDone(false), 1600);
  };
  return (
    <button type="button" onClick={copy} aria-label={done ? 'Kopyalandı' : label} className={cn('relative inline-flex h-7 items-center gap-1.5 overflow-hidden rounded-[var(--x-r-control)] px-2 text-[12px] font-medium transition-colors', dark ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-[var(--x-muted)] hover:bg-[var(--x-surface-hover)] hover:text-[var(--x-ink)]', className)}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={done ? 'ok' : 'copy'} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }} transition={{ duration: 0.16 }} className="flex items-center gap-1.5">
          {done ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}{done ? 'Kopyalandı' : label}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
