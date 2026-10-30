'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowUpRight, CalendarDays, Factory, PackageCheck, Scissors, Truck } from 'lucide-react';
import { Skeleton } from '@/components/kit/Skeleton';
import type { Order } from '@/lib/types';
import { useAuth } from '@/lib/context/AuthContext';
import { useMemberAccess } from '@/lib/hooks/useMemberAccess';
import { getVisibleNavGroups } from '@/lib/core/dashboard-nav';

type Trend = { day: string; created: number; completed: number };

/** Uses the existing tenant summary; no invented comparisons or financial totals. */
export function DashboardOverview({ children, trend: allTrend, loading, orders, production, tools }: {
  tools?: React.ReactNode; children: React.ReactNode; trend: Trend[]; loading: boolean; orders: Order[];
  production?: { in_progress: string; open: string; blocked: string };
}) {
  const { user } = useAuth();
  const access = useMemberAccess();
  const visibleLinks = new Set(getVisibleNavGroups(user?.role, access).flatMap(group => group.items.map(item => item.href)));
  const [period, setPeriod] = useState(7);
  const trend = allTrend.slice(-period);
  const maximum = Math.max(4, Math.ceil(Math.max(0, ...trend.flatMap(day => [day.created, day.completed])) / 4) * 4);
  const totalCreated = trend.reduce((sum, day) => sum + day.created, 0);
  const totalCompleted = trend.reduce((sum, day) => sum + day.completed, 0);
  const upcoming = orders.filter((order): order is Order & { deliveryDate: string } => Boolean(order.deliveryDate)).sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate)).slice(0, 4);
  const count = (value?: string) => value === undefined ? '—' : Number(value).toLocaleString('tr-TR');
  return (
    <div className="rf-overview-grid">
      <div className="min-w-0 space-y-5">
        <section className="rf-panel rf-overview-card" aria-label="İşletme özeti">
          <div className="rf-overview-heading"><h2>İşletme özeti</h2><div className="rf-overview-tools"><span className="rf-soft-badge">Bugün</span>{tools}</div></div>
          {children}
          <div className="rf-overview-projects">
            <div className="rf-overview-projects-heading"><h3>Termin planı <span>{orders.length}</span></h3>{visibleLinks.has('/orders') && <Link href="/orders">Sipariş listesi <ArrowUpRight size={14} aria-hidden /></Link>}</div>
            <div className="rf-project-register">{upcoming.map(order => <Link key={order.id} href={'/orders/' + order.id}><span>{order.orderNumber}</span><strong>{order.customerName}</strong><time dateTime={order.deliveryDate}>{new Intl.DateTimeFormat('tr-TR', {day:'numeric',month:'short',timeZone:'Europe/Istanbul'}).format(new Date(order.deliveryDate+'T12:00:00Z'))}</time><ArrowUpRight size={13} aria-hidden /></Link>)}{!loading && !upcoming.length && <p>Teslim tarihi belirlenen siparişler burada görünür.</p>}</div>
          </div>
        </section>
        <section className="rf-panel rf-overview-card" aria-label="Sipariş hareketleri">
          <div className="rf-overview-heading"><div><h2>Sipariş hareketleri</h2><p>Günlük gelen ve tamamlanan siparişler</p></div><label className="rf-period-select"><span className="sr-only">Grafik dönemi</span><select value={period} onChange={event => setPeriod(Number(event.target.value))}><option value={7}>Son 7 gün</option><option value={14}>Son 14 gün</option></select></label></div>
          {loading ? <Skeleton className="h-56 w-full rounded-2xl" /> : trend.length ? <>
            <div className="rf-chart-totals"><div><i className="rf-chart-key-created" /><strong>{totalCreated.toLocaleString('tr-TR')}</strong><span>Gelen sipariş</span></div><div><i className="rf-chart-key-completed" /><strong>{totalCompleted.toLocaleString('tr-TR')}</strong><span>Tamamlanan</span></div></div>
            <div className="rf-chart-plot">
              <div className="rf-chart-axis" aria-hidden="true">{[4,3,2,1,0].map(tick => <span key={tick}>{maximum * tick / 4}</span>)}</div>
              <div className="rf-chart-canvas">
                <div className="rf-chart-grid" aria-hidden="true">{[0,1,2,3,4].map(tick => <span key={tick} />)}</div>
                <div className="rf-order-chart">{trend.map(day => <button type="button" key={day.day} className="rf-order-chart-day" aria-label={`${new Intl.DateTimeFormat('tr-TR', {day:'numeric',month:'long',timeZone:'Europe/Istanbul'}).format(new Date(day.day+'T12:00:00Z'))}: ${day.created} gelen, ${day.completed} tamamlanan sipariş`}>
                  <span className="rf-chart-tooltip"><strong>{new Intl.DateTimeFormat('tr-TR', {day:'numeric',month:'short',timeZone:'Europe/Istanbul'}).format(new Date(day.day+'T12:00:00Z'))}</strong>{day.created} gelen · {day.completed} tamamlanan</span>
                  <span className="rf-order-chart-bars" aria-hidden="true"><span className="rf-order-chart-created" style={{ height: `${day.created / maximum * 100}%` }} /><span className="rf-order-chart-completed" style={{ height: `${day.completed / maximum * 100}%` }} /></span>
                  <span aria-hidden="true">{new Intl.DateTimeFormat('tr-TR', { weekday: 'short', timeZone: 'Europe/Istanbul' }).format(new Date(day.day + 'T12:00:00Z'))}</span>
                </button>)}</div>
              </div>
            </div>
            <details className="rf-chart-details"><summary>Günlük döküm</summary><table><caption className="sr-only">Sipariş hareketleri günlük verileri</caption><thead><tr><th scope="col">Tarih</th><th scope="col">Gelen</th><th scope="col">Tamamlanan</th></tr></thead><tbody>{trend.map(day => <tr key={day.day}><th scope="row">{day.day}</th><td>{day.created}</td><td>{day.completed}</td></tr>)}</tbody></table></details>
          </> : <div className="rf-overview-empty"><Factory size={30} strokeWidth={1.2} aria-hidden /><p>Henüz sipariş hareketi yok</p><span>Yeni kayıtlar geldikçe günlük hareketler burada görünür.</span></div>}
        </section>
      </div>
      <aside className="min-w-0 space-y-5" aria-label="Operasyon özeti">
        <section className="rf-panel rf-overview-card">
          <div className="rf-overview-heading"><h2>Yaklaşan teslimatlar</h2><Truck size={18} aria-hidden /></div>
          {loading ? <Skeleton className="h-52 w-full rounded-2xl" /> : upcoming.length ? <ul className="rf-delivery-list">{upcoming.map(order => <li key={order.id}><Link href={'/orders/' + order.id}>
            <span className="rf-delivery-icon"><PackageCheck size={19} strokeWidth={1.5} aria-hidden /></span><span className="min-w-0 flex-1"><strong>{order.orderNumber}</strong><span className="block truncate text-xs text-muted-foreground">{order.customerName}</span></span><span className="rf-delivery-date"><CalendarDays size={12} aria-hidden />{new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', timeZone: 'Europe/Istanbul' }).format(new Date(order.deliveryDate + 'T12:00:00Z'))}</span>
          </Link></li>)}</ul> : <div className="rf-overview-empty rf-overview-empty-small"><PackageCheck size={28} strokeWidth={1.2} aria-hidden /><p>Planlı teslimat yok</p></div>}
          {visibleLinks.has('/calendar') && <Link href="/calendar" className="rf-overview-all">Takvimi görüntüle <ArrowUpRight size={15} aria-hidden /></Link>}
        </section>
        <section className="rf-panel rf-overview-card">
          <div className="rf-overview-heading"><h2>Üretimde bugün</h2><Factory size={18} aria-hidden /></div>
          <dl className="rf-production-summary">
            <div><dt><span className="rf-status-dot bg-emerald-500" /> Devam eden</dt><dd>{loading ? '…' : count(production?.in_progress)}</dd></div>
            <div><dt><span className="rf-status-dot bg-zinc-400" /> Açık işler</dt><dd>{loading ? '…' : count(production?.open)}</dd></div>
            <div><dt><span className="rf-status-dot bg-amber-500" /> Bekleyen / engelli</dt><dd>{loading ? '…' : count(production?.blocked)}</dd></div>
          </dl>
          {visibleLinks.has('/production') && <Link href="/production" className="rf-overview-all">Üretimi görüntüle <Scissors size={15} aria-hidden /></Link>}
        </section>
      </aside>
    </div>
  );
}
