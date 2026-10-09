'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, BarChart3, Gauge, Timer } from 'lucide-react';
import { EmptyState, HintTip, Skeleton, StatusChip } from '@/components/kit';
import { requestJson } from '@/lib/shared/network';
import { cn } from '@/lib/utils';

type ParetoRow = { code: string; label: string; count: number; quantity?: number; value: number; share: number; cumulative: number; vital: boolean };
type Insights = {
  available: boolean;
  scrap: ParetoRow[];
  rework: ParetoRow[];
  delay: ParetoRow[];
  openDelays: Array<{ id: string; reason: string; expectedUntil: string | null; since: string; workOrderId: string; title: string }>;
  capacity: Array<{ code: string; name: string; lateJobs: number; days: Array<{ day: string; available: number; booked: number; load: number }> }>;
  capacityError: string | null;
};

const dayLabel = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('tr-TR', { weekday: 'short', day: '2-digit' });
const loadTone = (load: number, available: number) =>
  !available ? 'bg-muted text-muted-foreground' : load >= 90 ? 'bg-rose-600 text-white' : load >= 70 ? 'bg-amber-500 text-black' : load > 0 ? 'bg-primary/70 text-primary-foreground' : 'bg-primary/10 text-muted-foreground';

/** Where production loses (scrap, rework, delay reasons as Pareto), what is stuck now, and how full each work centre is. */
export function ProductionInsights() {
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    requestJson<Insights>('/api/v1/production/insights', { cache: 'no-store' }).then((r) => (r.ok && r.data ? setData(r.data) : setError(r.error || 'Analiz alınamadı')));
  }, []);
  if (error) return <p role="alert" className="rf-panel text-sm">{error}</p>;
  if (!data) return <div className="rf-panel space-y-3" role="status"><span className="sr-only">Analiz alınıyor</span><Skeleton className="h-6 w-1/3" /><Skeleton className="h-32" /></div>;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rf-panel space-y-3 lg:col-span-2" aria-label="Kapasite">
        <div className="flex items-center gap-2">
          <Gauge size={16} aria-hidden />
          <h2 className="rf-section-title">Kapasite · 7 gün</h2>
          <HintTip text="Çizelgenin her iş merkezine o gün yazdığı dakika, vardiya × paralel yer kapasitesine oranla. Termini kaçan işler gecikme olarak sayılır." />
        </div>
        {data.capacityError ? <p className="text-xs text-muted-foreground">{data.capacityError}</p> : data.capacity.length === 0 ? <p className="text-xs text-muted-foreground">Tanımlı iş merkezi yok</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-separate border-spacing-1 text-center text-xs">
              <thead><tr><th className="text-left font-medium text-muted-foreground">Merkez</th>{data.capacity[0].days.map((d) => <th key={d.day} className="font-medium text-muted-foreground">{dayLabel(d.day)}</th>)}<th className="font-medium text-muted-foreground">Gecikme</th></tr></thead>
              <tbody>
                {data.capacity.map((c) => (
                  <tr key={c.code}>
                    <th scope="row" className="max-w-[120px] truncate text-left font-medium">{c.name}</th>
                    {c.days.map((d) => (
                      <td key={d.day} className={cn('h-9 rounded-md tabular-nums', loadTone(d.load, d.available))} title={`${d.booked} / ${d.available} dk`}>
                        {d.available ? `${d.load}%` : '—'}
                      </td>
                    ))}
                    <td>{c.lateJobs ? <StatusChip tone="danger" label={String(c.lateJobs)} /> : <span className="text-muted-foreground">0</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ParetoCard title="Fire nedenleri" icon={BarChart3} rows={data.scrap} empty="90 günde fire kaydı yok" />
      <ParetoCard title="Rework nedenleri" icon={BarChart3} rows={data.rework} empty="90 günde rework yok" />
      <ParetoCard title="Gecikme nedenleri" icon={Timer} rows={data.delay} empty="90 günde gecikme yok" />

      <section className="rf-panel space-y-2" aria-label="Açık gecikmeler">
        <div className="flex items-center gap-2"><AlertTriangle size={16} aria-hidden /><h2 className="rf-section-title">Açık gecikmeler</h2>{data.openDelays.length > 0 && <StatusChip tone="warning" label={String(data.openDelays.length)} />}</div>
        {data.openDelays.length === 0 ? <p className="text-xs text-muted-foreground">Yok</p> : (
          <ul className="space-y-1.5 text-sm">
            {data.openDelays.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2">
                <Link href={`/work-orders/${d.workOrderId}`} className="min-w-0 flex-1 truncate font-medium hover:underline">{d.title}</Link>
                <StatusChip tone="warning" label={d.reason} />
                {d.expectedUntil && <span className="text-xs text-muted-foreground tabular-nums">→ {new Date(d.expectedUntil + 'T12:00:00Z').toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
      {!data.available && <div className="lg:col-span-2"><EmptyState title="Fire ve gecikme kayıtları veritabanı güncellemesinden (042) sonra açılır" /></div>}
    </div>
  );
}

function ParetoCard({ title, icon: Icon, rows, empty }: { title: string; icon: typeof BarChart3; rows: ParetoRow[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section className="rf-panel space-y-2" aria-label={title}>
      <div className="flex items-center gap-2"><Icon size={16} aria-hidden /><h2 className="rf-section-title">{title}</h2><span className="ml-auto text-[11px] text-muted-foreground">90 gün</span></div>
      {rows.length === 0 ? <p className="text-xs text-muted-foreground">{empty}</p> : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.code} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 text-sm">
              <span className="truncate">{r.label}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{r.count} · %{r.share}</span>
              <span className="col-span-2 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                <span className={cn('block h-full rounded-full', r.vital ? 'bg-primary' : 'bg-muted-foreground/40')} style={{ width: `${(r.value / max) * 100}%` }} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
