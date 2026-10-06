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

/** Short activity feed that advances every couple of seconds. */
function EventLog() {
  const reduce = useReducedMotion();
  const [count, setCount] = useState(reduce ? EVENTS.length : 1);
  useEffect(() => {
    if (reduce) return;
    const timer = setInterval(() => setCount((value) => (value >= EVENTS.length ? 1 : value + 1)), 2200);
    return () => clearInterval(timer);
  }, [reduce]);
  return (
    <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card text-[12.5px]" aria-label="Örnek operasyon akışı">
      {EVENTS.slice(0, count).map(([time, ref, text, where], index) => (
        <motion.li key={ref + index} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }} className="flex items-center gap-3 px-4 py-2.5">
          <span className="w-10 shrink-0 tabular-nums text-muted-foreground">{time}</span>
          <span className="w-[68px] shrink-0 font-medium text-primary">{ref}</span>
          <span className="min-w-0 flex-1 truncate">{text}</span>
          <span className="hidden shrink-0 text-muted-foreground xl:inline">{where}</span>
        </motion.li>
      ))}
    </ol>
  );
}

function Showcase() {
  return (
    <aside className="relative hidden min-h-screen flex-col overflow-hidden border-r border-border bg-muted/40 px-12 py-10 lg:flex xl:px-16">
      <BrandMark href="/" size="lg" className="w-fit" />
      <div className="my-auto max-w-[500px] py-12">
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="text-[13px] font-medium text-primary">Renk Alüminyum operasyon platformu</motion.p>
        <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.05, ease: EASE }} className="mt-4 text-[38px] font-semibold leading-[1.08] tracking-[-0.04em] xl:text-[44px]">
          Üretimin her adımı, <span className="text-muted-foreground">tek bir çalışma alanında.</span>
        </motion.h1>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.12, ease: EASE }} className="mt-10 overflow-hidden rounded-xl border border-border bg-card shadow-[var(--rf-shadow)]">
          <Magnifier className="px-10 pb-3 pt-8 text-foreground/70" lens={<div className="px-10 pb-3 pt-8 text-foreground"><ProfileDrawing instant /></div>}><ProfileDrawing delay={0.4} /></Magnifier>
          <div className="grid grid-cols-4 border-t border-border text-[12px]">
            {[['Proje', 'RF-70 kasa'], ['Kesit', 'A–A'], ['Ölçek', '1:2'], ['Revizyon', '03']].map(([label, value]) => (
              <div key={label} className="border-r border-border px-4 py-3 last:border-r-0"><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-0.5 font-medium">{value}</p></div>
            ))}
          </div>
        </motion.div>

        <div className="mt-5"><EventLog /></div>
      </div>
      <ul className="grid grid-cols-3 gap-6 border-t border-border pt-6">
        {POINTS.map(({ icon: Icon, label }) => (
          <li key={label} className="flex items-start gap-2.5 text-[12.5px] leading-5 text-muted-foreground"><Icon size={15} strokeWidth={1.75} className="mt-0.5 shrink-0 text-foreground" />{label}</li>
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
