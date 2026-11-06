'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { requestJson } from '@/lib/shared/network';
type Job = { id: string; name: string; title: string; order_number: string; status: string; version: number; planned_qty: string; completed_qty: string; unit: string | null; quality_checks: unknown[] };
export function KioskStation() {
  const [jobs, setJobs] = useState<Job[]>([]), [selected, setSelected] = useState<string>(),
    [error, setError] = useState(''), [busy, setBusy] = useState(false), [loaded, setLoaded] = useState(false);
  const locked = useRef(false);
  async function load() {
    const r = await requestJson<{jobs: Job[]}>('/api/v1/production/kiosk');
    if (r.ok && r.data) { setJobs(r.data.jobs); setLoaded(true); }
    else { setJobs([]); setError(r.error || 'İşler alınamadı'); }
  }
  useEffect(() => { void load(); }, []);
  const job = jobs.find(j => j.id === selected);
  const remaining = job ? Number(job.planned_qty) - Number(job.completed_qty) : 0;
  const canFinish = Number.isInteger(remaining) && remaining > 0;
  async function act(action: 'start' | 'pause' | 'complete') {
    if (!job || locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try {
      const r = await requestJson('/api/v1/production/kiosk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        commandId: crypto.randomUUID(), operationId: job.id, version: job.version, action,
        ...(action === 'complete' ? { quantity: Number(job.planned_qty) - Number(job.completed_qty) } : {}),
      }) });
      if (!r.ok) setError(r.error || 'İşlem tamamlanamadı. Güncel kaydı kontrol edin.');
      await load();
    } finally { locked.current = false; setBusy(false); }
  }
  return <main className="min-h-dvh space-y-6 bg-background p-4 text-foreground md:p-8">
    <header className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-3xl font-semibold">İstasyon · Usta</h1>
      <Button className="min-h-16 px-8 text-xl" variant="outline" disabled={busy} onClick={() => { setError(''); void load(); }}>Yenile</Button></header>
    {error && <p role="alert" className="text-xl text-destructive">{error}</p>}
    {!loaded && !error && <p role="status">İşler yükleniyor…</p>}
    {loaded && !jobs.length && <p className="text-xl">Size atanmış açık iş yok.</p>}
    <div className="grid gap-6 lg:grid-cols-2"><nav aria-label="Atanmış işler" className="space-y-3">
      {jobs.map(j => <Button key={j.id} variant={selected === j.id ? 'default' : 'outline'} disabled={busy} aria-pressed={selected === j.id}
        className="h-auto min-h-24 w-full justify-start whitespace-normal p-5 text-left text-xl" onClick={() => setSelected(j.id)}>
        {j.order_number} · {j.title} · {j.name} · {j.completed_qty}/{j.planned_qty} {j.unit || 'Birim belirtilmemiş'}
      </Button>)}
    </nav>{job && <section aria-label="Seçilen iş" className="rf-panel space-y-5 p-6">
      <h2 className="text-2xl font-semibold">{job.name}</h2>
      <p className="text-xl">{job.completed_qty} / {job.planned_qty} {job.unit || 'Birim belirtilmemiş'}</p>
      <p>{({ waiting: 'Önceki aşama bekleniyor', ready: 'Hazır', running: 'Çalışıyor', paused: 'Molada', blocked: 'Engelli' } as Record<string,string>)[job.status]}</p>
      <div className="grid gap-4">
        {['ready','paused'].includes(job.status) && <Button className="min-h-24 text-2xl" disabled={busy} onClick={() => void act('start')}>{job.status === 'paused' ? 'Devam' : 'Başla'}</Button>}
        {job.status === 'running' && <><Button variant="outline" className="min-h-24 text-2xl" disabled={busy} onClick={() => void act('pause')}>Mola</Button>
          {canFinish && <Button className="min-h-24 text-2xl" disabled={busy || !!job.quality_checks?.length} onClick={() => void act('complete')}>Bitir · {remaining} {job.unit || 'Birim belirtilmemiş'}</Button>}</>}
      </div>
      {job.status === 'running' && !canFinish && <p>Kalan miktar bu kioskta tamamlanamaz; mevcut usta ekranını kullanın.</p>}
      {!!job.quality_checks?.length && <p>Kalite kontrolü gereken işi <a className="underline" href="/production/worker">mevcut usta ekranından</a> tamamlayın.</p>}
      <p role="status">{busy ? 'İşlem kaydediliyor…' : ''}</p>
    </section>}</div>
  </main>;
}
