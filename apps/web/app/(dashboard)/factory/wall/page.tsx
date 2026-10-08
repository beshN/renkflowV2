'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertOctagon, CalendarCheck2, Expand, Activity, Scissors, X } from 'lucide-react';
import { ColorSwatch } from '@/components/colors/ColorSwatch';
import { BarMini, Skeleton } from '@/components/kit';
import { cn } from '@/lib/utils';

type WallJob = { id: string; orderNumber: string; product: string | null; color: { label: string; code: string } | null; step: string | null; running: boolean; planned: number; produced: number; due: string | null };
type Wall = { updatedAt: string; today: WallJob[]; late: WallJob[]; running: WallJob[]; steps: Array<{ name: string; count: number }>; nextCuts: WallJob[]; openJobs: number };

function JobRow({ job, late }: { job: WallJob; late?: boolean }) {
  return (
    <li className="flex items-center gap-4 border-b border-border py-3 last:border-0">
      {job.color ? <ColorSwatch color={job.color} size={44} className="rounded-md" /> : <span className="h-11 w-11 shrink-0 rounded-md border border-dashed border-border" />}
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate font-mono text-2xl font-semibold', late && 'text-rose-700 dark:text-rose-300')}>{job.orderNumber}</span>
        <span className="block truncate text-lg text-muted-foreground">{[job.color?.code, job.step].filter(Boolean).join(' · ')}</span>
      </span>
      <span className="text-2xl font-semibold tabular-nums">{job.produced}/{job.planned}</span>
    </li>
  );
}

function Panel({ title, icon: Icon, count, tone, children }: { title: string; icon: typeof Activity; count: number; tone?: 'danger'; children: React.ReactNode }) {
  return (
    <section className={cn('flex min-h-0 flex-col rounded-xl border border-border bg-card p-5', tone === 'danger' && count > 0 && 'border-rose-600/50')}>
      <h2 className={cn('mb-3 flex items-center gap-3 text-2xl font-semibold', tone === 'danger' && count > 0 && 'text-rose-700 dark:text-rose-300')}>
        <Icon size={28} aria-hidden />{title}<span className="ml-auto text-4xl tabular-nums">{count}</span>
      </h2>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </section>
  );
}

/**
 * Wall screen for the workshop TV: today's jobs, jobs per step, late jobs, next cuts. Read-only,
 * refreshes itself every 30 seconds, large type, no customer names or prices.
 */
export default function FactoryWall() {
  const [data, setData] = useState<Wall | null>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch('/api/v1/production/wall', { cache: 'no-store' });
        const body = await r.json();
        if (!alive) return;
        if (!r.ok) setError(body.error || 'Veri alınamadı');
        else { setData(body.data); setError(''); }
      } catch { if (alive) setError('Bağlantı yok'); }
    };
    void load();
    const t1 = setInterval(load, 30_000), t2 = setInterval(() => setNow(new Date()), 15_000);
    return () => { alive = false; clearInterval(t1); clearInterval(t2); };
  }, []);
  const list = (jobs: WallJob[], late?: boolean) => jobs.length
    ? <ul>{jobs.slice(0, 6).map((j) => <JobRow key={j.id} job={j} late={late} />)}</ul>
    : <p className="grid h-full place-items-center text-6xl text-muted-foreground/40" aria-label="Yok">—</p>;
  return (
    <div className="fixed inset-0 z-[200] flex flex-col gap-4 overflow-hidden bg-background p-5">
      <header className="flex items-center gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Atölye</h1>
        <span className="text-3xl tabular-nums text-muted-foreground">{now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })}</span>
        {error && <span role="alert" className="rounded-md border border-rose-600/40 px-3 py-1 text-lg text-rose-700">{error}</span>}
        <span className="ml-auto flex gap-2">
          <button type="button" aria-label="Tam ekran" onClick={() => void document.documentElement.requestFullscreen?.().catch(() => undefined)} className="grid h-12 w-12 place-items-center rounded-md border border-border"><Expand size={22} /></button>
          <Link href="/factory" aria-label="Kapat" className="grid h-12 w-12 place-items-center rounded-md border border-border"><X size={22} /></Link>
        </span>
      </header>
      {!data ? <div className="grid flex-1 grid-cols-2 gap-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-full" />)}</div> : (
        <>
          {data.steps.length > 0 && <div className="rounded-xl border border-border bg-card p-4"><BarMini height={70} items={data.steps.map((s) => ({ key: s.name, label: s.name, value: s.count }))} /></div>}
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Bugün" icon={CalendarCheck2} count={data.today.length}>{list(data.today)}</Panel>
            <Panel title="Geciken" icon={AlertOctagon} count={data.late.length} tone="danger">{list(data.late, true)}</Panel>
            <Panel title="Çalışan" icon={Activity} count={data.running.length}>{list(data.running)}</Panel>
            <Panel title="Sıradaki kesim" icon={Scissors} count={data.nextCuts.length}>{list(data.nextCuts)}</Panel>
          </div>
        </>
      )}
    </div>
  );
}
