'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon, ArrowDown, ArrowUp, CalendarDays, ClipboardList, Eye, EyeOff, Factory, FilePlus2, LayoutGrid, PackageCheck,
  RefreshCw, ScanLine, Scissors, SlidersHorizontal, Truck, Warehouse,
} from 'lucide-react';
import { useOrders } from '@/lib/hooks/useOrders';
import { useAuth } from '@/lib/context/AuthContext';
import { hasPermission } from '@/lib/auth/permissions';
import { businessDate, isOpenOrder, isOverdueOrder } from '@/lib/features/orders/workspace';
import { LIFECYCLE, lifecycleIndex, orderHealth } from '@/lib/features/orders/lifecycle';
import type { Order } from '@/lib/types';
import { cn } from '@/lib/utils';
import { SuggestionsPanel } from '@/components/features/ai/SuggestionsPanel';
import { MorningSummary } from '@/components/features/ai/MorningSummary';
import { DueActivities } from '@/components/records/DueActivities';
import { FleetHealthCard } from '@/components/fleet/FleetHealthCard';
import { Donut, EmptyState, HealthBadge, HintTip, LifecycleStrip, PageHeader, ProgressRing, Skeleton, StatCard } from '@/components/kit';
import { ColorSwatch } from '@/components/colors/ColorSwatch';
import { colorInfo } from '@/lib/features/colors/color-spec';
import { TearCalendar } from '@/components/spells/TearCalendar';
import { OccasionBadge } from '@/components/spells/OccasionBadge';

type Summary = {
  orders: { active_count: string; today_deliveries: string };
  production: { in_progress: string; open: string; blocked: string };
  criticalStock: { critical_count: string } | null;
  overdue: { overdue_count: string };
  cutting?: { waiting: string };
  trend?: Array<{ day: string; created: number; completed: number }>;
  week?: { created: number; completed: number; on_time: number };
  paint?: Array<{ color: string; jobs: number; pieces: number }>;
};

// Lifecycle colours: one cobalt ramp, the last step neutral. Each segment also has a label and a link.
const STEP_COLORS = ['#c7d2fe', '#a5b4fc', '#7c8ff0', '#2f55f4', '#1b3fa8', '#a1a1aa'];
const SECTIONS = ['morning', 'today', 'activities', 'suggestions', 'flow', 'health', 'paint', 'week'] as const;
type Section = (typeof SECTIONS)[number];
const DEFAULT_HIDDEN: Section[] = ['activities', 'flow', 'health', 'paint', 'week'];
const SECTION_LABELS: Record<Section, string> = { morning: 'Sabah özeti', today: 'Bugünün işi', activities: 'Aktiviteler', suggestions: 'Önerilenler', flow: 'Sipariş akışı', health: 'Riskteki siparişler', paint: 'Renk kuyruğu', week: 'Bu hafta' };
const LAYOUT_KEY = 'rf-dashboard-layout';

/** Card order and hidden cards, per browser. Falls back to the default when storage is unavailable. */
function useLayout() {
  // A first visit shows what needs doing today; the rest is one click away (Düzenle → göster).
  const [layout, setLayout] = useState<{ order: Section[]; hidden: Section[] }>({ order: [...SECTIONS], hidden: [...DEFAULT_HIDDEN] });
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) || 'null');
      if (saved && Array.isArray(saved.order)) {
        const order = [...saved.order.filter((s: Section) => SECTIONS.includes(s)), ...SECTIONS.filter((s) => !saved.order.includes(s))];
        setLayout({ order, hidden: (saved.hidden ?? []).filter((s: Section) => SECTIONS.includes(s)) });
      }
    } catch { /* default layout */ }
  }, []);
  const save = (next: typeof layout) => {
    setLayout(next);
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(next)); } catch { /* not persisted */ }
  };
  return [layout, save] as const;
}

function OrderMini({ order, today }: { order: Order; today: string }) {
  return (
    <Link href={'/orders/' + order.id} className="block w-60 shrink-0 space-y-2 rounded-md border border-border bg-card p-3 hover:border-primary/40">
      <span className="flex items-center justify-between gap-2">
        <span className="truncate font-mono text-xs font-semibold">{order.orderNumber}</span>
        <HealthBadge health={orderHealth(order, today)} />
      </span>
      <span className="block truncate text-sm font-medium">{order.customerName}</span>
      <LifecycleStrip status={order.status} compact />
    </Link>
  );
}

function Lane({ title, icon: Icon, tone, orders, href, today, loading }: {
  title: string; icon: typeof Truck; tone?: 'danger'; orders: Order[]; href: string; today: string; loading: boolean;
}) {
  return (
    <section aria-label={title} className="min-w-0">
      <Link href={href} className={cn('mb-2 inline-flex items-center gap-2 text-sm font-semibold hover:text-primary', tone === 'danger' && 'text-rose-700 dark:text-rose-300')}>
        <Icon size={16} aria-hidden />{title}<span className="rounded-full bg-muted px-2 text-xs tabular-nums text-foreground">{loading ? '·' : orders.length}</span>
      </Link>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {loading ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-[92px] w-60 shrink-0" />)
          : orders.length ? orders.slice(0, 8).map((o) => <OrderMini key={o.id} order={o} today={today} />)
          : <span className="grid h-[92px] w-60 shrink-0 place-items-center rounded-md border border-dashed border-border text-muted-foreground" role="img" aria-label="Boş"><PackageCheck size={20} aria-hidden /></span>}
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { orders, isLoading, error, refresh, isValidating } = useOrders();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [layout, saveLayout] = useLayout();

  const loadSummary = useCallback(async (signal?: AbortSignal) => {
    setSummaryLoading(true);
    try {
      const response = await fetch('/api/v1/dashboard/summary', { signal, cache: 'no-store' });
      if (response.ok) setSummary((await response.json()).summary);
    } catch { /* KPIs show "—" */ }
    finally { if (!signal?.aborted) setSummaryLoading(false); }
  }, []);
  useEffect(() => { const c = new AbortController(); void loadSummary(c.signal); return () => c.abort(); }, [loadSummary]);

  const today = businessDate();
  const open = useMemo(() => orders.filter(isOpenOrder), [orders]);
  const overdue = useMemo(() => orders.filter((o) => isOverdueOrder(o, today)), [orders, today]);
  const dueToday = useMemo(() => open.filter((o) => o.deliveryDate === today), [open, today]);
  const inCutting = useMemo(() => open.filter((o) => LIFECYCLE[lifecycleIndex(o.status)]?.key === 'cutting'), [open]);
  const atRisk = useMemo(() => open.map((o) => ({ o, h: orderHealth(o, today) })).filter(({ h }) => h.level === 'risk' || h.level === 'late').sort((a, b) => a.h.score - b.h.score), [open, today]);
  const steps = LIFECYCLE.map((step, i) => ({ key: step.key, label: step.label, color: STEP_COLORS[i], href: `/orders?lc=${step.key}`, value: open.filter((o) => lifecycleIndex(o.status) === i).length }));
  const trend = summary?.trend ?? [];
  const n = (v: unknown) => (v === undefined || v === null ? '—' : Number(v));
  const canCreate = user && hasPermission(user.role, 'orders.create');
  const manager = user && ['owner', 'admin', 'office'].includes(user.role);

  const shortcuts = [
    { href: '/quotations/new', label: 'Yeni teklif', icon: FilePlus2, show: canCreate },
    { href: '/calendar', label: 'Takvim', icon: CalendarDays, show: user && user.role !== 'worker' },
    { href: '/production?tab=cutting', label: 'Kesim', icon: Scissors, show: manager },
    { href: '/inventory/opening-count', label: 'Sayım', icon: ClipboardList, show: manager },
    { href: '/warehouse/scan', label: 'Tara', icon: ScanLine, show: true },
    { href: '/factory/wall', label: 'Duvar', icon: LayoutGrid, show: manager },
    { href: '/warehouse', label: 'Depo', icon: Warehouse, show: manager },
  ].filter((s) => s.show);

  const sections: Record<Section, React.ReactNode> = {
    morning: <MorningSummary />,
    today: (
      <div className="rf-panel grid gap-4 p-4 lg:grid-cols-3">
        <Lane title="Bugün teslim" icon={Truck} orders={dueToday} href="/orders?view=today" today={today} loading={isLoading} />
        <Lane title="Geciken" icon={AlertOctagon} tone="danger" orders={overdue} href="/orders?view=overdue" today={today} loading={isLoading} />
        <Lane title="Kesimde" icon={Scissors} orders={inCutting} href="/orders?lc=cutting" today={today} loading={isLoading} />
      </div>
    ),
    activities: <DueActivities />,
    suggestions: <SuggestionsPanel />,
    flow: (
      <section className="rf-panel p-4" aria-label="Sipariş akışı">
        <h2 className="rf-section-title mb-3">Sipariş akışı</h2>
        {isLoading ? <Skeleton className="h-28 w-full" /> : open.length ? <Donut segments={steps} /> : <EmptyState title="Açık sipariş yok" action={canCreate ? { label: 'Yeni teklif', href: '/quotations/new' } : undefined} />}
      </section>
    ),
    health: (
      <section className="rf-panel p-4" aria-label="Riskteki siparişler">
        <h2 className="rf-section-title mb-3 flex items-center gap-2">Riskteki siparişler <span className="rounded-full bg-muted px-2 text-xs tabular-nums">{atRisk.length}</span></h2>
        {isLoading ? <Skeleton className="h-28 w-full" /> : atRisk.length ? (
          <ul className="space-y-1.5">
            {atRisk.slice(0, 6).map(({ o, h }) => (
              <li key={o.id}>
                <Link href={'/orders/' + o.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent">
                  <span className="font-mono text-xs font-semibold">{o.orderNumber}</span>
                  <LifecycleStrip status={o.status} compact />
                  <HealthBadge health={h} />
                </Link>
              </li>
            ))}
          </ul>
        ) : <EmptyState title="Risk yok" icon={PackageCheck} />}
      </section>
    ),
    paint: (
      <section className="rf-panel p-4" aria-label="Renk kuyruğu">
        <h2 className="rf-section-title mb-3 flex items-center gap-2">Renk kuyruğu <HintTip text="Açık üretim işleri renge göre. Aynı renkteki işler boyahaneye birlikte gönderilirse boya değişimi azalır." /></h2>
        {summaryLoading ? <Skeleton className="h-24 w-full" /> : summary?.paint?.length ? (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {summary.paint.map((p) => (
              <li key={p.color} className="flex items-center gap-2 rounded-md border border-border p-2">
                <ColorSwatch color={p.color} size={36} className="rounded-md" />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold">{colorInfo(p.color)?.code ?? p.color}</span>
                  <span className="block text-[11px] tabular-nums text-muted-foreground">{p.jobs} iş · {p.pieces} adet</span>
                </span>
              </li>
            ))}
          </ul>
        ) : <EmptyState title="Kuyruk boş" icon={PackageCheck} />}
      </section>
    ),
    week: (
      <section className="rf-panel flex items-center gap-5 p-4" aria-label="Bu hafta">
        <ProgressRing size={84} stroke={8} value={summary?.week?.on_time ?? 0} max={summary?.week?.completed || 1}
          label="Zamanında teslim oranı" center={summary?.week?.completed ? `%${Math.round(((summary.week.on_time ?? 0) / summary.week.completed) * 100)}` : '—'} />
        <dl className="grid flex-1 grid-cols-2 gap-3">
          <div><dt className="text-xs text-muted-foreground">Bu hafta gelen</dt><dd className="text-2xl font-semibold tabular-nums">{summaryLoading ? <Skeleton className="h-8 w-10" /> : n(summary?.week?.created)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Bu hafta biten</dt><dd className="text-2xl font-semibold tabular-nums">{summaryLoading ? <Skeleton className="h-8 w-10" /> : n(summary?.week?.completed)}</dd></div>
        </dl>
      </section>
    ),
  };

  const move = (s: Section, by: number) => {
    const order = [...layout.order];
    const i = order.indexOf(s), j = i + by;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    saveLayout({ ...layout, order });
  };
  const toggle = (s: Section) => saveLayout({ ...layout, hidden: layout.hidden.includes(s) ? layout.hidden.filter((x) => x !== s) : [...layout.hidden, s] });

  return (
    <div className="rf-page space-y-5">
      <PageHeader
        leading={<TearCalendar />}
        eyebrow={<>{new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}<OccasionBadge /></>}
        title="Bugün"
        action={<>
          <button type="button" onClick={() => void Promise.all([refresh(), loadSummary()])} disabled={isValidating} aria-label="Yenile" className="rf-icon-button grid h-9 w-9 place-items-center border border-border"><RefreshCw size={15} className={isValidating ? 'animate-spin motion-reduce:animate-none' : ''} /></button>
          <button type="button" onClick={() => setEditing((v) => !v)} aria-pressed={editing} aria-label="Kartları düzenle" className="rf-icon-button grid h-9 w-9 place-items-center border border-border"><SlidersHorizontal size={15} /></button>
          {canCreate && <Link href="/quotations/new" className="rf-primary-button h-9 px-3.5 text-xs"><FilePlus2 size={15} /> Yeni teklif</Link>}
        </>}
      />
      {error && !orders.length && <p role="alert" className="rf-alert text-sm"><AlertOctagon size={16} aria-hidden /> Siparişler alınamadı</p>}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Açık sipariş" icon={Factory} href="/orders?view=active" loading={isLoading} value={open.length} trend={trend.map((t) => t.created)} />
        <StatCard label="Geciken" icon={AlertOctagon} href="/orders?view=overdue" loading={isLoading} value={overdue.length} tone={overdue.length ? 'danger' : 'neutral'} />
        <StatCard label="Kesim bekleyen iş" icon={Scissors} href="/production?tab=cutting" loading={summaryLoading} value={n(summary?.cutting?.waiting)} />
        <StatCard label="Bugün teslim" icon={Truck} href="/orders?view=today" loading={isLoading} value={dueToday.length} trend={trend.map((t) => t.completed)} />
      </div>

      {manager && (user?.role === 'owner' || user?.role === 'admin') && <FleetHealthCard />}

      <nav aria-label="Kısayollar" className="-mx-1 flex gap-2 overflow-x-auto px-1">
        {shortcuts.map((s) => (
          <Link key={s.href} href={s.href} className="flex min-w-[76px] flex-col items-center gap-1 rounded-md border border-border bg-card px-3 py-2 text-[11px] font-medium hover:border-primary/40">
            <s.icon size={20} aria-hidden className="text-primary" />{s.label}
          </Link>
        ))}
      </nav>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        {layout.order.map((s) => {
          const hidden = layout.hidden.includes(s);
          if (hidden && !editing) return null;
          const wide = s === 'morning' || s === 'today' || s === 'suggestions' || s === 'activities';
          return (
            <div key={s} className={cn('relative', wide && 'xl:col-span-2', hidden && 'opacity-40')}>
              {editing && (
                <div className="absolute right-2 top-2 z-10 flex gap-1 rounded-md border border-border bg-background p-0.5 shadow-sm">
                  <span className="px-1.5 text-[11px] leading-7 text-muted-foreground">{SECTION_LABELS[s]}</span>
                  <button type="button" aria-label={`${SECTION_LABELS[s]} yukarı`} onClick={() => move(s, -1)} className="rf-icon-button grid h-7 w-7 place-items-center"><ArrowUp size={14} /></button>
                  <button type="button" aria-label={`${SECTION_LABELS[s]} aşağı`} onClick={() => move(s, 1)} className="rf-icon-button grid h-7 w-7 place-items-center"><ArrowDown size={14} /></button>
                  <button type="button" aria-label={`${SECTION_LABELS[s]} ${hidden ? 'göster' : 'gizle'}`} onClick={() => toggle(s)} className="rf-icon-button grid h-7 w-7 place-items-center">{hidden ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                </div>
              )}
              {sections[s]}
            </div>
          );
        })}
      </div>
      {!isLoading && !orders.length && !error && <EmptyState title="İlk sipariş" action={canCreate ? { label: 'Yeni teklif', href: '/quotations/new' } : undefined} />}
    </div>
  );
}
