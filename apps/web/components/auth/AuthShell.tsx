'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { QrCode, ShieldCheck, Warehouse, Workflow } from 'lucide-react';
import { BrandMark } from '@/components/brand/BrandMark';
import { ProfileDrawing } from '@/components/brand/ProfileDrawing';
import { Magnifier } from '@/components/spells/Magnifier';

const EASE = [0.2, 0.8, 0.2, 1] as const;

const EVENTS = [
  ['09:41', 'RF-1042', 'Kesim tamamlandı', 'İstasyon K-02'],
  ['09:42', 'RF-1040', 'Kalite onayı verildi', 'QC-1'],
  ['09:44', 'RAF-0942', 'Stok girişi · 48 boy', 'A blok · B4'],
  ['09:46', 'RF-1038', 'Sevkiyata hazır', 'Rampa 3'],
] as const;

const POINTS = [
  { icon: Workflow, label: 'Siparişten sevkiyata tek akış' },
  { icon: QrCode, label: 'QR ile parça izlenebilirliği' },
  { icon: Warehouse, label: 'Raf bazında gerçek stok' },
];

/** Monospace event log that advances like a plant terminal. */
function EventLog() {
  const reduce = useReducedMotion();
  const [count, setCount] = useState(reduce ? EVENTS.length : 1);
  useEffect(() => {
    if (reduce) return;
    const timer = setInterval(() => setCount((value) => (value >= EVENTS.length ? 1 : value + 1)), 1800);
    return () => clearInterval(timer);
  }, [reduce]);
  return (
    <ol className="space-y-1.5 font-mono text-[11px]" aria-label="Örnek operasyon akışı">
      {EVENTS.slice(0, count).map(([time, ref, text, where], index) => (
        <motion.li key={ref + index} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, ease: EASE }} className="grid grid-cols-[42px_74px_1fr_auto] gap-3 text-zinc-500">
          <span>{time}</span><span className="text-zinc-300">{ref}</span><span className="truncate text-zinc-200">{text}</span><span className="hidden xl:inline">{where}</span>
        </motion.li>
      ))}
      <li className="text-zinc-600"><span className="rf-blink">▍</span></li>
    </ol>
  );
}

function Showcase() {
  return (
    <aside className="rf-on-dark rf-blueprint relative hidden min-h-screen flex-col overflow-hidden border-r border-white/[0.06] px-12 py-10 text-zinc-100 lg:flex xl:px-16">
      <div className="relative z-10 flex items-center justify-between">
        <BrandMark href="/" tone="light" size="lg" />
        <span className="rf-mono-label text-zinc-500">Sayfa 01 / 01</span>
      </div>
      <div className="relative z-10 my-auto max-w-[520px] py-12">
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="rf-mono-label text-[hsl(var(--primary))]">Renk Alüminyum · Operasyon platformu</motion.p>
        <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.05, ease: EASE }} className="mt-5 text-[46px] font-semibold leading-[1.02] tracking-[-0.05em] text-white xl:text-[54px]">
          Hassas üretim, <span className="text-zinc-500">tek bir çalışma alanında.</span>
        </motion.h1>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.15, ease: EASE }} className="rf-corners mt-12 border border-white/10 bg-black/30 backdrop-blur-[2px]">
          <span className="rf-corner tl" /><span className="rf-corner tr" /><span className="rf-corner bl" /><span className="rf-corner br" />
          <Magnifier className="px-8 pb-4 pt-8 text-zinc-300" lens={<div className="px-8 pb-4 pt-8 text-zinc-200"><ProfileDrawing instant /></div>}><ProfileDrawing delay={0.5} /></Magnifier>
          <div className="grid grid-cols-4 border-t border-white/10 text-[10.5px]">
            {[['Proje', 'RF-70 Kasa'], ['Kesit', 'A–A'], ['Ölçek', '1:2'], ['Rev.', '03']].map(([label, value]) => (
              <div key={label} className="border-r border-white/10 px-3 py-2.5 last:border-r-0"><p className="rf-mono-label !text-[9px] text-zinc-500">{label}</p><p className="mt-1 font-mono text-zinc-200">{value}</p></div>
            ))}
          </div>
        </motion.div>

        <div className="mt-8"><EventLog /></div>
      </div>
      <ul className="relative z-10 grid grid-cols-3 gap-6 border-t border-white/10 pt-6">
        {POINTS.map(({ icon: Icon, label }) => (
          <li key={label} className="flex items-start gap-2.5 text-[12px] leading-5 text-zinc-400"><Icon size={14} strokeWidth={1.75} className="mt-0.5 shrink-0 text-zinc-300" />{label}</li>
        ))}
      </ul>
    </aside>
  );
}

type AuthShellProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
};

/** Split-screen layout shared by every authentication page. */
export function AuthShell({ eyebrow, title, description, icon, children, footer }: AuthShellProps) {
  return (
    <div className="rf-auth-shell grid min-h-screen lg:grid-cols-[1.08fr_1fr]">
      <Showcase />
      <main className="relative flex min-h-screen flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <BrandMark href="/" className="lg:invisible" />
          <Link href="/security" className="flex items-center gap-1.5 hover:text-foreground"><ShieldCheck size={14} /> Kurumsal erişim</Link>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="mx-auto my-auto w-full max-w-[380px] py-12"
        >
          {icon && <div className="mb-6"><span className="rf-icon-chip !h-10 !w-10 !rounded-lg !text-foreground">{icon}</span></div>}
          {eyebrow && <p className="rf-eyebrow">{eyebrow}</p>}
          <h2 className="mt-1.5 text-[28px] font-semibold leading-tight tracking-[-0.035em]">{title}</h2>
          {description && <p className="mt-2.5 text-sm leading-6 text-muted-foreground">{description}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 border-t border-border pt-6 text-[13px] leading-6 text-muted-foreground">{footer}</div>}
        </motion.div>
        <nav aria-label="Yasal" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[12px] text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground">Gizlilik</Link>
          <Link href="/terms" className="hover:text-foreground">Kullanım koşulları</Link>
          <Link href="/security" className="hover:text-foreground">Güvenlik</Link>
          <Link href="/contact" className="hover:text-foreground">Destek</Link>
        </nav>
      </main>
    </div>
  );
}
