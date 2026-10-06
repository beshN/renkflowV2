'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Boxes, ClipboardList, Factory, Home, QrCode, Receipt, Search, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

const EASE = [0.2, 0.8, 0.2, 1] as const;

/** Browser-style frame around a product preview. */
export function Frame({ children, className, label = 'renkflow.app' }: { children: React.ReactNode; className?: string; label?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgb(17_17_19/0.04),0_32px_64px_-32px_rgb(17_17_19/0.28)] dark:shadow-[0_0_0_1px_rgb(255_255_255/0.03),0_40px_80px_-40px_rgb(0_0_0/0.9)]', className)}>
      <div className="flex h-9 items-center gap-2 border-b border-border bg-muted/40 px-3.5">
        <span className="h-2.5 w-2.5 rounded-full bg-foreground/10" /><span className="h-2.5 w-2.5 rounded-full bg-foreground/10" /><span className="h-2.5 w-2.5 rounded-full bg-foreground/10" />
        <span className="mx-auto rounded-md bg-background px-3 py-0.5 font-mono text-[10.5px] text-muted-foreground">{label}</span>
        <span className="w-[42px]" />
      </div>
      {children}
    </div>
  );
}

const STATUS = {
  cut: { label: 'Kesimde', cls: 'bg-sky-500/10 text-sky-700 dark:text-sky-300' },
  press: { label: 'Pres', cls: 'bg-violet-500/10 text-violet-700 dark:text-violet-300' },
  qc: { label: 'Kalite', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  ship: { label: 'Sevkiyat', cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  new: { label: 'Yeni', cls: 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-300' },
} as const;

const ORDERS = [
  { id: 'RF-1042', customer: 'Ege Cephe Sistemleri', product: 'Sürme doğrama · 6063 T5', qty: '48', due: '14 Eki', status: 'cut' },
  { id: 'RF-1041', customer: 'Kuzey Yapı A.Ş.', product: 'Giydirme cephe profili', qty: '120', due: '16 Eki', status: 'press' },
  { id: 'RF-1040', customer: 'Atlas Mimarlık', product: 'Pencere sistemi · 70 seri', qty: '36', due: '17 Eki', status: 'qc' },
  { id: 'RF-1038', customer: 'Liman Endüstri', product: 'Kompozit panel çerçeve', qty: '64', due: '18 Eki', status: 'ship' },
  { id: 'RF-1037', customer: 'Marmara Konut', product: 'Küpeşte ve korkuluk', qty: '22', due: '21 Eki', status: 'new' },
] as const;

export function StatusPill({ status }: { status: keyof typeof STATUS }) {
  const s = STATUS[status];
  return <span className={cn('inline-flex h-5 items-center rounded-md px-1.5 text-[10.5px] font-medium', s.cls)}>{s.label}</span>;
}

/** Full workspace preview used in the hero. */
export function WorkspaceMock() {
  const reduce = useReducedMotion();
  const nav = [[Home, 'Genel bakış'], [Receipt, 'Siparişler'], [Factory, 'Üretim'], [ClipboardList, 'İş emirleri'], [Boxes, 'Depo'], [Truck, 'Sevkiyat']] as const;
  return (
    <Frame label="renkflow.app/dashboard">
      <div className="grid grid-cols-[176px_1fr] max-md:grid-cols-1">
        <aside className="border-r border-border bg-muted/30 p-3 max-md:hidden">
          <div className="mb-4 flex items-center gap-2 px-2 pt-1"><span className="rf-logo h-5 w-5 text-[9px] font-bold">R</span><span className="text-[12px] font-semibold">RenkFlow</span></div>
          {nav.map(([Icon, label], index) => (
            <div key={label} className={cn('mb-px flex h-7 items-center gap-2 rounded-md px-2 text-[11.5px]', index === 1 ? 'bg-card font-medium text-foreground shadow-[0_0_0_1px_hsl(var(--border))]' : 'text-muted-foreground')}>
              <Icon size={13} strokeWidth={1.75} className={index === 1 ? 'text-primary' : ''} />{label}
            </div>
          ))}
        </aside>
        <div className="min-w-0 p-5">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-[10.5px] text-muted-foreground">Sipariş ve üretim</p><p className="text-[17px] font-semibold tracking-[-0.03em]">Siparişler</p></div>
            <div className="flex items-center gap-2">
              <span className="hidden h-7 items-center gap-1.5 rounded-md border border-border px-2 text-[10.5px] text-muted-foreground sm:inline-flex"><Search size={11} /> Ara <kbd className="rf-kbd px-1 text-[9px]">⌘K</kbd></span>
              <span className="inline-flex h-7 items-center rounded-md bg-primary px-2.5 text-[10.5px] font-medium text-primary-foreground">Yeni sipariş</span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2 max-sm:grid-cols-2">
            {[['Aktif', '24'], ['Üretimde', '11'], ['Bu hafta sevk', '7'], ['Zamanında', '%96']].map(([label, value], index) => (
              <motion.div key={label} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.5 + index * 0.06, ease: EASE }} className="rounded-lg border border-border bg-background/60 p-2.5">
                <p className="text-[10px] text-muted-foreground">{label}</p><p className="mt-1 text-[16px] font-semibold tabular-nums tracking-[-0.03em]">{value}</p>
              </motion.div>
            ))}
          </div>
          <div className="mt-3 overflow-hidden rounded-lg border border-border">
            <div className="grid grid-cols-[72px_1fr_44px_56px_72px] gap-2 border-b border-border bg-muted/40 px-3 py-2 text-[10px] text-muted-foreground max-sm:grid-cols-[64px_1fr_72px]">
              <span>Sipariş</span><span>Müşteri / ürün</span><span className="text-right max-sm:hidden">Adet</span><span className="max-sm:hidden">Termin</span><span>Durum</span>
            </div>
            {ORDERS.map((order, index) => (
              <motion.div key={order.id} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.7 + index * 0.06 }} className="grid grid-cols-[72px_1fr_44px_56px_72px] items-center gap-2 border-b border-border px-3 py-2 last:border-0 max-sm:grid-cols-[64px_1fr_72px]">
                <span className="font-mono text-[10.5px] text-primary">{order.id}</span>
                <span className="min-w-0"><span className="block truncate text-[11.5px]">{order.customer}</span><span className="block truncate text-[10px] text-muted-foreground">{order.product}</span></span>
                <span className="text-right text-[11px] tabular-nums max-sm:hidden">{order.qty}</span>
                <span className="text-[11px] text-muted-foreground max-sm:hidden">{order.due}</span>
                <span><StatusPill status={order.status} /></span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </Frame>
  );
}

/** 6 m profile bars split into cut pieces, with the remnant marked. */
export function CuttingMock() {
  const reduce = useReducedMotion();
  const bars = [
    { profile: '70 seri kasa', cuts: [1450, 1450, 1200, 1200], },
    { profile: '70 seri kanat', cuts: [1380, 1380, 1380, 1380], },
    { profile: 'Orta kayıt', cuts: [2100, 2100, 1250], },
  ];
  return (
    <Frame label="Kesim planı · RF-1042">
      <div className="space-y-4 p-5">
        {bars.map((bar, row) => {
          const used = bar.cuts.reduce((a, b) => a + b, 0) + bar.cuts.length * 5;
          const rest = 6000 - used;
          return (
            <div key={bar.profile}>
              <div className="mb-1.5 flex justify-between text-[11px]"><span className="font-medium">{bar.profile}</span><span className="font-mono text-muted-foreground">6000 mm · fire {rest} mm</span></div>
              <div className="flex h-7 gap-[2px] overflow-hidden rounded-md bg-muted">
                {bar.cuts.map((cut, index) => (
                  <motion.div key={index} className="flex items-center justify-center bg-primary/85 font-mono text-[9.5px] text-primary-foreground first:rounded-l-md" style={{ width: `${(cut / 6000) * 100}%` }} initial={reduce ? false : { scaleX: 0, originX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: row * 0.15 + index * 0.06, ease: EASE }}>
                    {cut}
                  </motion.div>
                ))}
                <div className="flex flex-1 items-center justify-center bg-[repeating-linear-gradient(135deg,transparent_0_4px,hsl(var(--foreground)/0.08)_4px_5px)] text-[9.5px] text-muted-foreground">{rest > 300 ? 'artık' : ''}</div>
              </div>
            </div>
          );
        })}
        <div className="flex items-center justify-between border-t border-border pt-3 text-[11px]"><span className="text-muted-foreground">Toplam verim</span><span className="font-mono font-medium">%93,4</span></div>
      </div>
    </Frame>
  );
}

/** Rack grid with occupied bins and a scanned location. */
export function WarehouseMock() {
  const reduce = useReducedMotion();
  const cells = Array.from({ length: 24 }, (_, index) => ({ id: index, fill: [0.9, 0.4, 0.75, 0, 0.6, 1, 0.3, 0.85][index % 8] }));
  return (
    <Frame label="Depo · A blok">
      <div className="grid gap-5 p-5 sm:grid-cols-[1fr_170px]">
        <div className="grid grid-cols-6 gap-1.5">
          {cells.map((cell) => (
            <motion.div key={cell.id} initial={reduce ? false : { opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: cell.id * 0.015 }} className={cn('relative aspect-square overflow-hidden rounded-[5px] border', cell.id === 9 ? 'border-primary ring-2 ring-primary/20' : 'border-border')}>
              <span className="absolute inset-x-0 bottom-0 bg-foreground/10" style={{ height: `${cell.fill * 100}%` }} />
              <span className="absolute left-1 top-0.5 font-mono text-[8px] text-muted-foreground">{String.fromCharCode(65 + Math.floor(cell.id / 6))}{(cell.id % 6) + 1}</span>
            </motion.div>
          ))}
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="flex items-center gap-2 text-[11px] font-medium"><QrCode size={14} /> Okutuldu</div>
          <p className="mt-3 font-mono text-[11px] text-primary">B4 · RAF-0942</p>
          <p className="mt-1 text-[11.5px]">6063 T5 · 40×40 profil</p>
          <div className="mt-3 space-y-1.5 text-[10.5px] text-muted-foreground">
            <p className="flex justify-between"><span>Bakiye</span><span className="font-mono text-foreground">186 boy</span></p>
            <p className="flex justify-between"><span>Rezerve</span><span className="font-mono text-foreground">48 boy</span></p>
            <p className="flex justify-between"><span>Son hareket</span><span>09:42</span></p>
          </div>
        </div>
      </div>
    </Frame>
  );
}

/** Weekly collected vs invoiced bars. */
export function FinanceMock() {
  const reduce = useReducedMotion();
  const weeks = [[62, 48], [70, 64], [54, 50], [82, 71], [76, 74], [90, 79]];
  return (
    <Frame label="Finans · son 6 hafta">
      <div className="p-5">
        <div className="flex items-baseline justify-between"><div><p className="text-[10.5px] text-muted-foreground">Tahsilat</p><p className="text-[20px] font-semibold tabular-nums tracking-[-0.03em]">₺1.284.600</p></div><span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">+8,2%</span></div>
        <div className="mt-5 flex h-32 items-end gap-3">
          {weeks.map(([invoiced, collected], index) => (
            <div key={index} className="flex h-full flex-1 items-end gap-1">
              <motion.span className="w-full rounded-t-[3px] bg-foreground/10 dark:bg-foreground/20" style={{ height: `${invoiced}%`, originY: 1 }} initial={reduce ? false : { scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: index * 0.06, ease: EASE }} />
              <motion.span className="w-full rounded-t-[3px] bg-primary" style={{ height: `${collected}%`, originY: 1 }} initial={reduce ? false : { scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.1 + index * 0.06, ease: EASE }} />
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-4 text-[10.5px] text-muted-foreground"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-foreground/10 dark:bg-foreground/20" />Faturalanan</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-primary" />Tahsil edilen</span></div>
      </div>
    </Frame>
  );
}
