'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { QrCode, ShieldCheck, Warehouse, Workflow } from 'lucide-react';
import { BrandMark } from '@/components/brand/BrandMark';
import { ProfileDrawing } from '@/components/brand/ProfileDrawing';
import { Magnifier } from '@/components/spells/Magnifier';
import '@/components/site/v2/landing-v2.css';

const EASE = [0.2, 0.8, 0.2, 1] as const;

const EVENTS = [
  ['09:41', 'RF-1042', 'Pergola kesimi tamamlandı', 'Kesim K-02'],
  ['09:42', 'RF-1041', 'Boya onayı · RAL 9016', 'Boyahane'],
  ['09:44', 'PKT-0942', 'Paket girişi · 24 boy', 'A blok · B4'],
  ['09:46', 'RF-1038', 'Montaja hazır', 'Rampa 3'],
] as const;

const POINTS = [
  { icon: Workflow, label: 'Siparişten sevkiyata tek akış' },
  { icon: QrCode, label: 'Paket etiketiyle stok girişi' },
  { icon: Warehouse, label: 'Boy ve artık bazında gerçek stok' },
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
    <ol className="divide-y divide-[var(--x-chrome-line)] overflow-hidden rounded-[var(--x-r-panel)] border border-[var(--x-chrome-line)] bg-white/[0.03] text-[12.5px]" aria-label="Örnek operasyon akışı">
      {EVENTS.slice(0, count).map(([time, ref, text, where], index) => (
        <motion.li key={ref + index} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }} className="flex items-center gap-3 px-4 py-2.5">
          <span className="w-10 shrink-0 font-mono tabular-nums text-[var(--x-chrome-muted)]">{time}</span>
          <span className="w-[68px] shrink-0 font-mono font-medium text-[var(--x-bronze-fill)]">{ref}</span>
          <span className="min-w-0 flex-1 truncate">{text}</span>
          <span className="hidden shrink-0 text-[var(--x-chrome-muted)] xl:inline">{where}</span>
        </motion.li>
      ))}
    </ol>
  );
}

function Showcase() {
  return (
    <aside className="x-cone relative hidden min-h-screen flex-col overflow-hidden px-12 py-10 text-[var(--x-chrome-fg)] lg:flex xl:px-16">
      <BrandMark href="/" size="lg" tone="light" className="relative w-fit" />
      <div className="relative my-auto max-w-[500px] py-12">
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="text-[13.5px] text-[var(--x-chrome-muted)]">Renk Alüminyum operasyon platformu</motion.p>
        <motion.h1 initial={{ y: 10 }} animate={{ y: 0 }} transition={{ duration: 0.6, delay: 0.05, ease: EASE }} className="x-display mt-4 text-[36px] leading-[1.06] xl:text-[42px]">
          Ölçüye özel her proje, tek bir çalışma alanında.
        </motion.h1>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.12, ease: EASE }} className="mt-10 overflow-hidden rounded-[var(--x-r-window)] border border-[var(--x-chrome-line)] bg-white/[0.02] [--rf-drawing-accent:var(--x-bronze-fill)]">
          <Magnifier className="px-10 pb-3 pt-8 text-white/75" lens={<div className="px-10 pb-3 pt-8 text-foreground"><ProfileDrawing instant /></div>}><ProfileDrawing delay={0.4} /></Magnifier>
          <div className="grid grid-cols-4 border-t border-[var(--x-chrome-line)] text-[12px]">
            {[['Profil', '6017 · 100×150'], ['Kesit', 'A–A'], ['Ölçek', '1:1'], ['Revizyon', '03']].map(([label, value]) => (
              <div key={label} className="border-r border-[var(--x-chrome-line)] px-4 py-3 last:border-r-0"><p className="text-[11px] text-[var(--x-chrome-muted)]">{label}</p><p className="mt-0.5 whitespace-nowrap font-mono text-[11.5px] font-medium">{value}</p></div>
            ))}
          </div>
        </motion.div>

        <div className="mt-5"><EventLog /></div>
      </div>
      <ul className="relative grid grid-cols-3 gap-6 border-t border-[var(--x-chrome-line)] pt-6">
        {POINTS.map(({ icon: Icon, label }) => (
          <li key={label} className="flex items-start gap-2.5 text-[12.5px] leading-5 text-[var(--x-chrome-muted)]"><Icon size={15} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[var(--x-bronze-fill)]" />{label}</li>
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
    <div className="rf-auth-shell rfx grid min-h-screen lg:grid-cols-[1.08fr_1fr]">
      <Showcase />
      <main className="relative flex min-h-screen flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between text-[12.5px] text-[var(--x-muted)]">
          <BrandMark href="/" className="lg:invisible" />
          <Link href="/security" className="flex items-center gap-1.5 transition-colors hover:text-[var(--x-ink)]"><ShieldCheck size={14} /> Kurumsal erişim</Link>
        </div>
        {/* The form is visible in the server-rendered first paint; it only drifts into place. */}
        <motion.div
          initial={{ y: 8 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="mx-auto my-auto w-full max-w-[380px] py-12"
        >
          {icon && <div className="mb-6"><span className="rf-icon-chip !h-10 !w-10 !rounded-lg !text-foreground">{icon}</span></div>}
          {eyebrow && <p className="text-[13px] text-[var(--x-muted)]">{eyebrow}</p>}
          <h2 className="x-display mt-1.5 text-[30px] leading-tight">{title}</h2>
          {description && <p className="mt-2.5 text-[14.5px] leading-6 text-[var(--x-muted)]">{description}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 border-t border-[var(--x-line)] pt-6 text-[13px] leading-6 text-[var(--x-muted)]">{footer}</div>}
        </motion.div>
        <nav aria-label="Yasal" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[12px] text-[var(--x-muted)]">
          <Link href="/privacy" className="x-link hover:text-[var(--x-ink)]">Gizlilik</Link>
          <Link href="/terms" className="x-link hover:text-[var(--x-ink)]">Kullanım koşulları</Link>
          <Link href="/security" className="x-link hover:text-[var(--x-ink)]">Güvenlik</Link>
          <Link href="/contact" className="x-link hover:text-[var(--x-ink)]">Destek</Link>
        </nav>
      </main>
    </div>
  );
}
