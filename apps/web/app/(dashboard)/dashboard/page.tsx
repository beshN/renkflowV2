'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, Boxes, CalendarDays, ChevronRight, Clock3, Factory, FileText, Plus, RefreshCw, TriangleAlert, ClipboardList, PackageCheck, ScanLine, Warehouse } from 'lucide-react';
import { useOrders } from '@/lib/hooks/useOrders';
import { useAuth } from '@/lib/context/AuthContext';
import { hasPermission } from '@/lib/auth/permissions';
import { StatusBadge } from '@/components/shared/ui/StatusStepper';
import { formatDate, cn } from '@/lib/utils';
import { businessDate, filterWorkspaceOrders, isOpenOrder, isOverdueOrder, normalizeOrderStatus } from '@/lib/features/orders/workspace';
import { motion, useReducedMotion } from 'framer-motion';
import { CountUp } from '@/components/motion';
import { TearCalendar } from '@/components/spells/TearCalendar';
import { OccasionBadge } from '@/components/spells/OccasionBadge';
import { CopyChip } from '@/components/spells/CopyChip';

type Summary = { orders: { active_count: string; pending_count: string; ready_for_shipment: string; today_deliveries: string }; production: { in_progress: string; open: string; blocked: string }; criticalStock: { critical_count: string } | null; overdue: { overdue_count: string } };
const pipeline = [
  { label: 'Yeni talepler', statuses: ['new', 'pending_approval'], color: '#c7d2fe', href: '/orders?stage=intake' },
  { label: 'Hazırlık', statuses: ['approved', 'preparing_materials', 'ready_for_production'], color: '#93a4f4', href: '/orders?stage=preparation' },
  { label: 'Üretim', statuses: ['in_production'], color: '#2350d1', href: '/orders?status=in_production' },
  { label: 'Kalite kontrol', statuses: ['quality_check'], color: '#d97706', href: '/orders?status=quality_check' },
  { label: 'Sevkiyat', statuses: ['ready_for_shipment', 'shipped'], color: '#0f766e', href: '/orders?stage=shipping' },
  { label: 'Tamamlanan', statuses: ['completed'], color: '#a1a1aa', href: '/orders?view=completed' },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();
  const { orders, isLoading, error, refresh, isValidating } = useOrders();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const loadSummary = useCallback(async (signal?: AbortSignal) => {
    setSummaryLoading(true);
    try {
      const response = await fetch('/api/v1/dashboard/summary', { signal, cache: 'no-store' });
      if (!response.ok) throw new Error('Özet yüklenemedi');
      const result = await response.json();
      setSummary(result.summary); setUpdatedAt(new Date()); setSummaryError(false);
    } catch (err) { if (!(err instanceof Error && err.name === 'AbortError')) setSummaryError(true); }
    finally { if (!signal?.aborted) setSummaryLoading(false); }
  }, []);
  useEffect(() => { const controller = new AbortController(); void loadSummary(controller.signal); return () => controller.abort(); }, [loadSummary]);
  async function reload() { setRefreshing(true); try { await Promise.all([refresh(), loadSummary()]); } finally { setRefreshing(false); } }

  const today = businessDate();
  const openOrders = orders.filter(isOpenOrder);
  const overdue = orders.filter(order => isOverdueOrder(order, today));
  const production = orders.filter(order => normalizeOrderStatus(order.status) === 'in_production');
  const upcoming = filterWorkspaceOrders(orders.filter(order => isOpenOrder(order) && order.deliveryDate), { sort: 'delivery', today }).slice(0, 5);
  const recent = filterWorkspaceOrders(orders, { sort: 'newest' }).slice(0, 5);
  const buckets = pipeline.map(stage => ({ ...stage, count: orders.filter(order => stage.statuses.includes(normalizeOrderStatus(order.status))).length }));
  const totalInPipeline = buckets.reduce((sum, stage) => sum + stage.count, 0);
  const hasOrders = !error || orders.length > 0;
  const metrics = [
    { label: 'Aktif siparişler', value: hasOrders ? openOrders.length : '—', description: 'Tamamlanmayı bekleyen işler', icon: FileText, href: '/orders?view=active', warning: false },
    { label: 'Üretimdeki siparişler', value: hasOrders ? production.length : '—', description: summary && !summaryError ? `${summary.production.in_progress} devam eden iş emri` : 'Atölyedeki siparişler', icon: Factory, href: '/orders?status=in_production', warning: false },
    { label: 'Geciken teslimatlar', value: hasOrders ? overdue.length : '—', description: overdue.length ? 'Termin planını gözden geçirin' : 'Geciken açık sipariş yok', icon: Clock3, href: '/orders?view=overdue', warning: overdue.length > 0 },
    { label: 'Bugünkü teslimatlar', value: hasOrders ? openOrders.filter(order => order.deliveryDate === today).length : '—', description: 'Bugün terminli açık siparişler', icon: PackageCheck, href: '/orders?view=today', warning: false },
  ];
  const greetingDate = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' }).format(new Date());
  const hour = Number(new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  const greeting = hour < 6 ? 'İyi geceler' : hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar';
  const firstName = user?.name?.split(' ')[0];
  return <div className="rf-page space-y-6">
    <section className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-border pb-6">
      <div className="flex min-w-0 items-start gap-4">
        <TearCalendar />
        <div className="min-w-0">
        <p className="rf-eyebrow flex-wrap"><span className="rf-status-dot" aria-hidden /> {greetingDate}<OccasionBadge /></p>
        <h1 className="rf-page-title">{greeting}{firstName ? `, ${firstName}` : ''}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{hasOrders ? openOrders.length : '—'} aktif sipariş</span>
          <span className="mx-2 text-border">/</span><span className="font-medium text-foreground">{hasOrders ? production.length : '—'} üretimde</span>
          <span className="mx-2 text-border">/</span>{overdue.length ? <span className="font-medium text-amber-700 dark:text-amber-400">{overdue.length} gecikmiş teslimat</span> : <span>Geciken teslimat yok</span>}
        </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={reload} disabled={refreshing || isValidating} className="rf-secondary-button h-9 px-3 text-xs disabled:opacity-50"><RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Yenile</button>
        {user && hasPermission(user.role, 'orders.create') && <Link href="/new-order" className="rf-primary-button h-9 px-3.5 text-xs"><Plus size={15} /> Sipariş oluştur</Link>}
      </div>
    </section>
    {user && ["owner","admin","office"].includes(user.role) && <div className="rf-quick-operations"><Link href="/production"><span className="rf-result-icon"><Factory size={22}/></span><div className="min-w-0"><p className="text-sm font-semibold">Üretim kontrolü</p><p className="mt-1 text-xs text-muted-foreground">İşler, kapasite ve kesim planları</p></div><ArrowUpRight className="ml-auto shrink-0 text-muted-foreground" size={16}/></Link><Link href="/warehouse"><span className="rf-result-icon"><Warehouse size={22}/></span><div className="min-w-0"><p className="text-sm font-semibold">Depo & raflar</p><p className="mt-1 text-xs text-muted-foreground">Malzemenin fiziksel konumu</p></div><ArrowUpRight className="ml-auto shrink-0 text-muted-foreground" size={16}/></Link><Link href="/warehouse/scan"><span className="rf-result-icon"><ScanLine size={22}/></span><div className="min-w-0"><p className="text-sm font-semibold">QR / barkod terminali</p><p className="mt-1 text-xs text-muted-foreground">Okut, doğrula ve işle</p></div><ArrowUpRight className="ml-auto shrink-0 text-muted-foreground" size={16}/></Link></div>}
    {(error || summaryError) && <div role="alert" className="rf-alert"><TriangleAlert size={18} className="shrink-0" /><div><p className="text-sm font-medium">{error ? 'Siparişler güncellenemedi' : 'Operasyon özeti güncellenemedi'}</p><p className="mt-1 text-xs">{orders.length ? 'Son alınan siparişler gösteriliyor. Yenile düğmesiyle tekrar deneyin.' : 'Bağlantıyı kontrol edip tekrar deneyin.'}</p></div></div>}
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{metrics.map(metric => <Link href={metric.href} key={metric.label} className="rf-metric group">
      <div className="mb-5 flex items-center justify-between gap-2"><span className="text-xs font-medium text-muted-foreground">{metric.label}</span><span className={cn('rf-icon-chip', metric.warning && '!text-amber-600')}><metric.icon size={15} strokeWidth={1.75} /></span></div>
      <p className={cn('rf-metric-value', metric.warning && 'text-amber-700 dark:text-amber-400')}>{isLoading ? <span className="block h-9 w-12 animate-pulse rounded-md bg-muted" /> : typeof metric.value === 'number' ? <CountUp value={metric.value} /> : metric.value}</p>
      <p className="mt-3 flex items-center justify-between gap-2 text-[10px] text-muted-foreground"><span>{metric.description}</span><ArrowUpRight size={13} className="shrink-0 opacity-40 group-hover:opacity-100" /></p>
    </Link>)}</div>
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="space-y-5">
        <section className="rf-panel overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4"><div><h2 className="rf-section-title">Sipariş akışı</h2><p className="mt-1 text-[11px] text-muted-foreground">Talepten tamamlanmaya, mevcut kayıtların dağılımı</p></div><Link href="/kanban" className="flex items-center gap-1 text-[11px] font-medium text-primary">Üretim panosu <ArrowUpRight size={13} /></Link></div>
          <div className="p-5">
            <div className="mb-6 flex h-2 gap-[3px] overflow-hidden rounded-full bg-muted" role="img" aria-label={`${totalInPipeline} siparişin aşamalara dağılımı`}>
              {buckets.filter(bucket => bucket.count).map((bucket, index) => <motion.div key={bucket.label} className="h-full rounded-full" initial={reduceMotion ? false : { width: 0 }} animate={{ width: `${bucket.count / totalInPipeline * 100}%` }} transition={{ duration: 0.6, delay: 0.1 + index * 0.05, ease: [0.2, 0.8, 0.2, 1] }} style={{ backgroundColor: bucket.color }} title={`${bucket.label}: ${bucket.count}`} />)}
            </div>
            <div className="grid grid-cols-2 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">{buckets.map((bucket, index) => <Link key={bucket.label} href={bucket.href} className={cn('group px-3 first:pl-0', index > 0 && 'lg:border-l lg:border-border')}>
              <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: bucket.color }} />{bucket.label}</p><p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight transition-colors group-hover:text-primary">{isLoading ? '…' : error && !orders.length ? '—' : <CountUp value={bucket.count} />}</p>
            </Link>)}</div>
          </div>
        </section>
        <section className="rf-panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4"><h2 className="rf-section-title">Son siparişler</h2><Link href="/orders" className="flex items-center gap-1 text-[11px] font-medium text-primary">Tüm siparişler <ArrowRight size={13} /></Link></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[540px] text-xs"><thead className="bg-muted/50 text-muted-foreground"><tr><th className="px-5 py-3 text-left font-medium">Sipariş / müşteri</th><th className="px-3 py-3 text-left font-medium">Ürün</th><th className="px-3 py-3 text-left font-medium">Termin</th><th className="px-5 py-3 text-right font-medium">Durum</th></tr></thead><tbody className="divide-y divide-border">
            {isLoading ? [1, 2, 3].map(index => <tr key={index}><td colSpan={4} className="p-5"><div className="h-6 animate-pulse rounded bg-muted" /></td></tr>) : recent.map(order => <tr key={order.id} className="hover:bg-accent/60"><td className="group px-5 py-4"><span className="inline-flex items-center gap-1"><Link href={'/orders/' + order.id} className="font-mono font-medium text-primary hover:underline">{order.orderNumber}</Link><CopyChip value={order.orderNumber} label="Sipariş numarasını" /></span><p className="mt-1 text-[11px] text-muted-foreground">{order.customerName}</p></td><td className="max-w-[200px] px-3 py-4"><span className="block truncate">{order.productName || '—'}</span></td><td className="whitespace-nowrap px-3 py-4 text-muted-foreground">{order.deliveryDate ? formatDate(order.deliveryDate) : 'Belirlenmedi'}</td><td className="px-5 py-4 text-right"><StatusBadge status={order.status} /></td></tr>)}
            {!isLoading && !recent.length && <tr><td colSpan={4} className="p-10 text-center text-muted-foreground">{error ? 'Sipariş verisi alınamadı.' : 'İlk siparişinizi oluşturarak operasyonu başlatın.'}</td></tr>}
          </tbody></table></div>
        </section>
      </div>
      <div className="space-y-5">
        <section className="rf-panel overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4"><CalendarDays size={16} className="text-muted-foreground" /><h2 className="rf-section-title">Teslimat gündemi</h2></div>
          <div className="divide-y divide-border">{isLoading ? <div className="m-5 h-32 animate-pulse rounded bg-muted" /> : upcoming.map(order => {
            const late = isOverdueOrder(order, today);
            return <Link key={order.id} href={'/orders/' + order.id} className="flex items-start gap-3 px-5 py-4 hover:bg-accent/50"><span className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', late ? 'bg-amber-500' : 'bg-muted-foreground/40')} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{order.customerName}</p><p className="mt-1 truncate text-[10px] text-muted-foreground">{order.orderNumber} · {order.productName}</p><p className={cn('mt-2 text-[10px]', late ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground')}>{late ? 'Termin geçti · ' : ''}{formatDate(order.deliveryDate)}</p></div><ChevronRight size={14} className="mt-1 shrink-0 text-muted-foreground" /></Link>;
          })}{!isLoading && !upcoming.length && <div className="px-5 py-8 text-center"><CalendarDays size={24} className="mx-auto mb-3 text-muted-foreground/40" /><p className="text-xs text-muted-foreground">{error ? 'Teslimat verisi alınamadı.' : 'Planlanmış açık teslimat yok.'}</p></div>}</div>
          <Link href="/orders?sort=delivery&view=active" className="flex items-center justify-between border-t border-border bg-accent/30 px-5 py-3 text-[11px] font-medium text-primary">Termin planını aç <ArrowRight size={13} /></Link>
        </section>
        <section className="rf-panel p-5"><h2 className="rf-section-title">Operasyon kontrolleri</h2>
          <div className="mt-4 space-y-4">
            <Link href="/work-orders" className="flex items-center gap-3"><ClipboardList size={17} className="text-muted-foreground" /><div className="flex-1"><p className="text-xs font-medium">İş emirleri</p><p className="mt-1 text-[10px] text-muted-foreground">{summaryLoading ? 'Kontrol ediliyor…' : summaryError || !summary ? 'Özet alınamadı' : `${summary.production.open} açık · ${summary.production.blocked} bloke`}</p></div><ArrowUpRight size={14} className="text-muted-foreground" /></Link>
            <Link href="/inventory" className="flex items-center gap-3"><Boxes size={17} className="text-muted-foreground" /><div className="flex-1"><p className="text-xs font-medium">Profil ve malzeme</p><p className="mt-1 text-[10px] text-muted-foreground">{summaryLoading ? 'Kontrol ediliyor…' : summaryError || !summary?.criticalStock ? 'Depo bakiyeleri alınamadı' : `${summary.criticalStock.critical_count} minimum stok uyarısı`}</p></div><ArrowUpRight size={14} className="text-muted-foreground" /></Link>
          </div>
          {!summaryLoading && !summary?.criticalStock && <p className="mt-5 border-t border-border pt-3 text-[10px] leading-relaxed text-muted-foreground">Stok görünürlüğü sınırlı. Depo ekranında bağlantı durumunu inceleyin.</p>}
        </section>
      </div>
    </div>
    <footer className="rf-workspace-footer"><span>RENKFLOW / Renk Alüminyum</span><span>{updatedAt ? 'Özet güncellendi · ' + updatedAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' }) : 'Operasyon çalışma alanı'}</span></footer>
  </div>;
}
