'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarRange, Car, Droplets, FileText, KeyRound, MapPin, Radio, Trash2, Wrench } from 'lucide-react';
import { EmptyState, HintTip, Skeleton, StatusChip } from '@/components/kit';
import { RecordButton } from '@/components/records/RecordDrawer';
import { requestJson } from '@/lib/shared/network';
import { cn } from '@/lib/utils';
import {
  DOCUMENT_KINDS, DOCUMENT_KIND_LABELS, DOC_LEVEL_LABEL, VEHICLE_STATUSES, VEHICLE_STATUS_LABELS, VEHICLE_TYPES, VEHICLE_TYPE_LABELS, formatPlate,
  type DocLevel, type DocumentKind, type VehicleStatus, type VehicleType,
} from '@/lib/features/fleet/engine';
import { TileMap } from './TileMap';
import { HEALTH } from './FleetWorkspace';

type Vehicle = {
  id: string; plate: string; make: string | null; model: string | null; modelYear: number | null; type: VehicleType; status: VehicleStatus; driverId: string | null; driverName: string | null;
  odometerKm: number | null; notes: string | null; version: number; health: 'good' | 'attention' | 'critical'; reasons: string[];
  documents: Array<{ id: string; kind: DocumentKind; number: string | null; issuedOn: string | null; expiresOn: string | null; amount: number | null; attachmentId: string | null; level: DocLevel; daysLeft: number | null }>;
  current: string[];
  maintenance: Array<{ id: string; doneOn: string; km: number | null; amount: number; description: string; vendor: string | null; nextDueOn: string | null; nextDueKm: number | null }>;
  fuel: Array<{ id: string; filledOn: string; liters: number; amount: number; km: number | null; fullTank: boolean }>;
  assignments: Array<{ id: string; kind: string; installationId: string | null; shipmentId: string | null; title: string | null; startsAt: string; endsAt: string; driverName: string | null; conflict: boolean }>;
  devices: Array<{ id: string; label: string; active: boolean; lastSeenAt: string | null }>;
  costs: { monthly: Array<{ month: string; fuel: number; maintenance: number }>; perKm: number | null; consumptionL100: number | null; total: number };
};
type Tab = 'general' | 'documents' | 'maintenance' | 'fuel' | 'assignments' | 'location';
type Member = { id: string; name: string | null; email: string; role: string };

const money = (n: number | null | undefined) => (n === null || n === undefined ? '—' : new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n));
const when = (iso: string) => new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
const post = (url: string, body: unknown, method = 'POST') => requestJson<any>(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const todayIso = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date());

/** One vehicle: general, documents, maintenance, fuel, assignments and location. */
export function VehicleDetail({ id }: { id: string }) {
  const [v, setV] = useState<Vehicle | null>(null);
  const [tab, setTab] = useState<Tab>('general');
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const r = await requestJson<Vehicle>(`/api/v1/vehicles/${id}`, { cache: 'no-store' });
    if (r.ok && r.data) { setV(r.data); setError(''); } else setError(r.error || 'Araç alınamadı');
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  if (!v) return error ? <p role="alert" className="rf-panel text-sm">{error}</p> : <Skeleton className="h-64" />;
  async function add(body: Record<string, unknown>) {
    const r = await post(`/api/v1/vehicles/${id}`, body);
    if (!r.ok) { setError(r.error || 'Kaydedilemedi'); return false; }
    await load();
    // After the reload (which clears the error line), so the double-booking warning stays visible.
    if (r.data?.conflicts) setError('Kaydedildi; araç aynı saatte başka bir görevde (çakışma).');
    return true;
  }
  async function remove(type: string, entryId: string) {
    if (!window.confirm('Bu kayıt silinsin mi?')) return;
    const r = await requestJson(`/api/v1/vehicles/${id}/entries/${type}/${entryId}`, { method: 'DELETE' });
    if (!r.ok) setError(r.error || 'Silinemedi'); else await load();
  }
  const tabs: Array<[Tab, string, typeof Car]> = [['general', 'Genel', Car], ['documents', 'Belgeler', FileText], ['maintenance', 'Bakım', Wrench], ['fuel', 'Yakıt', Droplets], ['assignments', 'Görevler', CalendarRange], ['location', 'Konum', MapPin]];
  return (
    <div className="space-y-4">
      <Link href="/vehicles" className="inline-flex items-center gap-1 text-xs text-muted-foreground"><ArrowLeft size={14} aria-hidden /> Araçlar</Link>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
        <div>
          <p className="rf-eyebrow">{VEHICLE_TYPE_LABELS[v.type]} · {VEHICLE_STATUS_LABELS[v.status]}</p>
          <h1 className="rf-page-title font-mono tracking-wide">{formatPlate(v.plate)}</h1>
          <p className="text-sm">{[v.make, v.model, v.modelYear].filter(Boolean).join(' ') || '—'} · {v.driverName ?? 'sürücü yok'}{v.odometerKm !== null ? ` · ${v.odometerKm.toLocaleString('tr-TR')} km` : ''}</p>
          {v.reasons.length > 0 && <p className="text-xs text-muted-foreground">{v.reasons.join(' · ')}</p>}
        </div>
        <div className="flex items-center gap-2"><StatusChip tone={HEALTH[v.health].tone} label={HEALTH[v.health].label} /><RecordButton type="vehicle" id={v.id} label="Dosyalar ve notlar" /></div>
      </header>
      {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
      <div className="flex gap-1 overflow-x-auto rounded-md border border-border p-1" role="tablist" aria-label="Araç bölümleri">
        {tabs.map(([k, label, Icon]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={cn('flex shrink-0 items-center gap-1.5 rounded px-3 py-2 text-xs font-medium', tab === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
            <Icon size={14} aria-hidden /> {label}
          </button>
        ))}
      </div>
      {tab === 'general' && <General v={v} onSaved={load} onError={setError} />}
      {tab === 'documents' && <Documents v={v} add={add} remove={remove} />}
      {tab === 'maintenance' && <Maintenance v={v} add={add} remove={remove} />}
      {tab === 'fuel' && <Fuel v={v} add={add} remove={remove} />}
      {tab === 'assignments' && <Assignments v={v} add={add} remove={remove} />}
      {tab === 'location' && <Location v={v} onChanged={load} onError={setError} />}
    </div>
  );
}

function General({ v, onSaved, onError }: { v: Vehicle; onSaved: () => Promise<void>; onError: (e: string) => void }) {
  const [members, setMembers] = useState<Member[]>([]);
  useEffect(() => { void requestJson<{ members: Member[] }>('/api/tenant/members').then((r) => r.ok && r.data && setMembers(r.data.members)); }, []);
  async function patch(body: Record<string, unknown>) {
    const r = await post(`/api/v1/vehicles/${v.id}`, { ...body, expectedVersion: v.version }, 'PATCH');
    if (!r.ok) onError(r.error || 'Kaydedilemedi'); else await onSaved();
  }
  const max = Math.max(1, ...v.costs.monthly.map((m) => m.fuel + m.maintenance));
  return (
    <div className="space-y-4">
      <div className="rf-panel grid gap-2 p-3 sm:grid-cols-3">
        <label className="text-xs">Durum<select className="rf-input mt-1 w-full" value={v.status} onChange={(e) => void patch({ status: e.target.value })}>{VEHICLE_STATUSES.map((s) => <option key={s} value={s}>{VEHICLE_STATUS_LABELS[s]}</option>)}</select></label>
        <label className="text-xs">Tür<select className="rf-input mt-1 w-full" value={v.type} onChange={(e) => void patch({ type: e.target.value })}>{VEHICLE_TYPES.map((t) => <option key={t} value={t}>{VEHICLE_TYPE_LABELS[t]}</option>)}</select></label>
        <label className="text-xs">Sürücü<select className="rf-input mt-1 w-full" value={v.driverId ?? ''} onChange={(e) => void patch({ driverId: e.target.value || null })}><option value="">—</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}</select></label>
        <label className="text-xs">Km<input type="number" min={0} className="rf-input mt-1 w-full" defaultValue={v.odometerKm ?? ''} onBlur={(e) => e.target.value && Number(e.target.value) !== v.odometerKm && void patch({ odometerKm: Number(e.target.value) })} /></label>
        <label className="text-xs sm:col-span-2">Not<input className="rf-input mt-1 w-full" defaultValue={v.notes ?? ''} onBlur={(e) => e.target.value !== (v.notes ?? '') && void patch({ notes: e.target.value || null })} /></label>
      </div>
      <section className="rf-panel space-y-2 p-3" aria-labelledby="cost-title">
        <h2 id="cost-title" className="flex items-center gap-2 text-sm font-semibold">Maliyet <HintTip text="Yakıt ve bakım kayıtlarından. Km başına maliyet, girilen en düşük ve en yüksek km arasındaki yol üzerinden hesaplanır." /></h2>
        <p className="text-sm">Toplam {money(v.costs.total)} · km başına {v.costs.perKm === null ? '—' : `${v.costs.perKm.toLocaleString('tr-TR')} ₺`} · tüketim {v.costs.consumptionL100 === null ? '—' : `${v.costs.consumptionL100} L/100 km`}</p>
        {v.costs.monthly.length ? (
          <>
            <ul className="flex items-end gap-2" style={{ height: 120 }} aria-label="Aylık maliyet (yakıt ve bakım)">
              {v.costs.monthly.slice(-12).map((m) => (
                <li key={m.month} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${m.month}: yakıt ${money(m.fuel)}, bakım ${money(m.maintenance)}`}>
                  <span className="flex w-full max-w-10 flex-col justify-end overflow-hidden rounded-sm" style={{ height: `${((m.fuel + m.maintenance) / max) * 96}px` }}>
                    <span className="block bg-amber-500" style={{ flexGrow: m.maintenance }} />
                    <span className="block bg-primary" style={{ flexGrow: m.fuel }} />
                  </span>
                  <span className="text-[10px] text-muted-foreground">{m.month.slice(5)}/{m.month.slice(2, 4)}</span>
                </li>
              ))}
            </ul>
            <p className="flex gap-3 text-[11px]"><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-primary" aria-hidden />Yakıt</span><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-500" aria-hidden />Bakım</span></p>
          </>
        ) : <p className="text-xs text-muted-foreground">Henüz yakıt ya da bakım kaydı yok.</p>}
      </section>
    </div>
  );
}

function Documents({ v, add, remove }: { v: Vehicle; add: (b: Record<string, unknown>) => Promise<boolean>; remove: (t: string, id: string) => Promise<void> }) {
  const [f, setF] = useState({ kind: 'inspection', number: '', issuedOn: '', expiresOn: '', amount: '' });
  return (
    <div className="space-y-3">
      <form className="rf-panel grid gap-2 p-3 sm:grid-cols-5" aria-label="Belge ekle" onSubmit={async (e) => { e.preventDefault(); if (await add({ type: 'document', kind: f.kind, number: f.number || null, issuedOn: f.issuedOn || null, expiresOn: f.expiresOn || null, amount: f.amount ? Number(f.amount) : null })) setF({ ...f, number: '', issuedOn: '', expiresOn: '', amount: '' }); }}>
        <label className="text-xs">Tür<select className="rf-input mt-1 w-full" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{DOCUMENT_KINDS.map((k) => <option key={k} value={k}>{DOCUMENT_KIND_LABELS[k]}</option>)}</select></label>
        <label className="text-xs">Numara<input className="rf-input mt-1 w-full" value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} /></label>
        <label className="text-xs">Başlangıç<input type="date" className="rf-input mt-1 w-full" value={f.issuedOn} onChange={(e) => setF({ ...f, issuedOn: e.target.value })} /></label>
        <label className="text-xs">Bitiş<input type="date" className="rf-input mt-1 w-full" value={f.expiresOn} onChange={(e) => setF({ ...f, expiresOn: e.target.value })} /></label>
        <label className="text-xs">Tutar (₺)<input type="number" min={0} className="rf-input mt-1 w-full" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
        <p className="text-[11px] text-muted-foreground sm:col-span-4">Taranmış belgeyi &quot;Dosyalar ve notlar&quot;dan ekleyin.</p>
        <button type="submit" className="rf-primary-button text-sm">Ekle</button>
      </form>
      {v.documents.length === 0 ? <EmptyState title="Belge yok" icon={FileText} /> : (
        <ul className="space-y-1" aria-label="Belgeler">
          {v.documents.map((d) => (
            <li key={d.id} className={cn('rf-panel flex flex-wrap items-center gap-2 p-2 text-sm', !v.current.includes(d.id) && 'opacity-60')}>
              <span className="font-medium">{DOCUMENT_KIND_LABELS[d.kind]}</span>
              <span className="text-xs text-muted-foreground">{d.number ?? ''} {d.issuedOn ?? ''}{d.expiresOn ? ` → ${d.expiresOn}` : ''} {d.amount !== null ? `· ${money(d.amount)}` : ''}</span>
              {v.current.includes(d.id) ? <StatusChip tone={d.level === 'expired' || d.level === 'd7' ? 'danger' : d.level === 'd15' || d.level === 'd30' ? 'warning' : 'success'} label={d.level === 'ok' || d.level === 'none' ? DOC_LEVEL_LABEL[d.level] : d.level === 'expired' ? DOC_LEVEL_LABEL.expired : `${d.daysLeft} gün kaldı`} /> : <StatusChip tone="muted" label="Yenilendi" />}
              <button type="button" className="rf-icon-button ml-auto" aria-label="Belgeyi sil" onClick={() => void remove('document', d.id)}><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Maintenance({ v, add, remove }: { v: Vehicle; add: (b: Record<string, unknown>) => Promise<boolean>; remove: (t: string, id: string) => Promise<void> }) {
  const [f, setF] = useState({ doneOn: todayIso(), km: '', amount: '', description: '', vendor: '', nextDueOn: '', nextDueKm: '' });
  return (
    <div className="space-y-3">
      <form className="rf-panel grid gap-2 p-3 sm:grid-cols-4" aria-label="Bakım ekle" onSubmit={async (e) => { e.preventDefault(); if (await add({ type: 'maintenance', doneOn: f.doneOn, km: f.km ? Number(f.km) : null, amount: Number(f.amount || 0), description: f.description, vendor: f.vendor || null, nextDueOn: f.nextDueOn || null, nextDueKm: f.nextDueKm ? Number(f.nextDueKm) : null })) setF({ ...f, km: '', amount: '', description: '', vendor: '', nextDueOn: '', nextDueKm: '' }); }}>
        <label className="text-xs">Tarih<input type="date" required className="rf-input mt-1 w-full" value={f.doneOn} onChange={(e) => setF({ ...f, doneOn: e.target.value })} /></label>
        <label className="text-xs">Km<input type="number" min={0} className="rf-input mt-1 w-full" value={f.km} onChange={(e) => setF({ ...f, km: e.target.value })} /></label>
        <label className="text-xs">Tutar (₺)<input type="number" min={0} required className="rf-input mt-1 w-full" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
        <label className="text-xs">Servis<input className="rf-input mt-1 w-full" value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} /></label>
        <label className="text-xs sm:col-span-2">Açıklama<input required className="rf-input mt-1 w-full" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
        <label className="text-xs">Sonraki bakım (tarih)<input type="date" className="rf-input mt-1 w-full" value={f.nextDueOn} onChange={(e) => setF({ ...f, nextDueOn: e.target.value })} /></label>
        <label className="text-xs">Sonraki bakım (km)<input type="number" min={0} className="rf-input mt-1 w-full" value={f.nextDueKm} onChange={(e) => setF({ ...f, nextDueKm: e.target.value })} /></label>
        <button type="submit" className="rf-primary-button text-sm sm:col-start-4">Ekle</button>
      </form>
      {v.maintenance.length === 0 ? <EmptyState title="Bakım kaydı yok" icon={Wrench} /> : (
        <ul className="space-y-1" aria-label="Bakımlar">
          {v.maintenance.map((m) => (
            <li key={m.id} className="rf-panel flex flex-wrap items-center gap-2 p-2 text-sm">
              <span className="font-medium">{m.doneOn}</span><span>{m.description}</span>
              <span className="text-xs text-muted-foreground">{m.km !== null ? `${m.km.toLocaleString('tr-TR')} km · ` : ''}{money(m.amount)}{m.vendor ? ` · ${m.vendor}` : ''}{m.nextDueOn || m.nextDueKm ? ` · sonraki: ${[m.nextDueOn, m.nextDueKm !== null ? `${m.nextDueKm?.toLocaleString('tr-TR')} km` : null].filter(Boolean).join(' / ')}` : ''}</span>
              <button type="button" className="rf-icon-button ml-auto" aria-label="Bakımı sil" onClick={() => void remove('maintenance', m.id)}><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Fuel({ v, add, remove }: { v: Vehicle; add: (b: Record<string, unknown>) => Promise<boolean>; remove: (t: string, id: string) => Promise<void> }) {
  const [f, setF] = useState({ filledOn: todayIso(), liters: '', amount: '', km: '', fullTank: true });
  return (
    <div className="space-y-3">
      <form className="rf-panel grid gap-2 p-3 sm:grid-cols-5" aria-label="Yakıt ekle" onSubmit={async (e) => { e.preventDefault(); if (await add({ type: 'fuel', filledOn: f.filledOn, liters: Number(f.liters), amount: Number(f.amount), km: f.km ? Number(f.km) : null, fullTank: f.fullTank })) setF({ ...f, liters: '', amount: '', km: '' }); }}>
        <label className="text-xs">Tarih<input type="date" required className="rf-input mt-1 w-full" value={f.filledOn} onChange={(e) => setF({ ...f, filledOn: e.target.value })} /></label>
        <label className="text-xs">Litre<input type="number" min={0.1} step={0.01} required className="rf-input mt-1 w-full" value={f.liters} onChange={(e) => setF({ ...f, liters: e.target.value })} /></label>
        <label className="text-xs">Tutar (₺)<input type="number" min={0} step={0.01} required className="rf-input mt-1 w-full" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
        <label className="text-xs">Km<input type="number" min={0} className="rf-input mt-1 w-full" value={f.km} onChange={(e) => setF({ ...f, km: e.target.value })} /></label>
        <label className="inline-flex items-end gap-1 text-xs"><input type="checkbox" className="h-4 w-4" checked={f.fullTank} onChange={(e) => setF({ ...f, fullTank: e.target.checked })} /> Depo doldu</label>
        <button type="submit" className="rf-primary-button text-sm sm:col-start-5">Ekle</button>
      </form>
      {v.fuel.length === 0 ? <EmptyState title="Yakıt kaydı yok" icon={Droplets} /> : (
        <ul className="space-y-1" aria-label="Yakıt alımları">
          {v.fuel.map((x) => (
            <li key={x.id} className="rf-panel flex flex-wrap items-center gap-2 p-2 text-sm">
              <span className="font-medium">{x.filledOn}</span><span>{x.liters.toLocaleString('tr-TR')} L · {money(x.amount)}</span>
              <span className="text-xs text-muted-foreground">{x.km !== null ? `${x.km.toLocaleString('tr-TR')} km` : ''}{x.fullTank ? ' · depo doldu' : ''}</span>
              <button type="button" className="rf-icon-button ml-auto" aria-label="Yakıt kaydını sil" onClick={() => void remove('fuel', x.id)}><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Assignments({ v, add, remove }: { v: Vehicle; add: (b: Record<string, unknown>) => Promise<boolean>; remove: (t: string, id: string) => Promise<void> }) {
  const [jobs, setJobs] = useState<{ installations: Array<{ id: string; label: string; date: string | null; startTime: string | null; durationMinutes: number }>; shipments: Array<{ id: string; label: string; date: string | null }> } | null>(null);
  const [f, setF] = useState({ kind: 'installation', jobId: '', title: '', start: '', end: '' });
  useEffect(() => { void requestJson<typeof jobs>('/api/v1/vehicles?view=jobs').then((r) => r.ok && r.data && setJobs(r.data)); }, []);
  // Picking an installation fills its day and hours.
  function pick(jobId: string) {
    const i = jobs?.installations.find((x) => x.id === jobId);
    if (f.kind === 'installation' && i?.date) {
      const start = `${i.date}T${i.startTime ?? '09:00'}`;
      const end = new Date(new Date(start).getTime() + i.durationMinutes * 60_000);
      const pad = (n: number) => String(n).padStart(2, '0');
      setF({ ...f, jobId, start, end: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}` });
    } else setF({ ...f, jobId });
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const ok = await add({ type: 'assignment', kind: f.kind, installationId: f.kind === 'installation' ? f.jobId : null, shipmentId: f.kind === 'shipment' ? f.jobId : null, title: f.title || null, startsAt: new Date(f.start).toISOString(), endsAt: new Date(f.end).toISOString() });
    if (ok) setF({ kind: f.kind, jobId: '', title: '', start: '', end: '' });
  }
  const options = f.kind === 'installation' ? jobs?.installations ?? [] : f.kind === 'shipment' ? jobs?.shipments ?? [] : [];
  return (
    <div className="space-y-3">
      <form className="rf-panel grid gap-2 p-3 sm:grid-cols-5" aria-label="Görev ata" onSubmit={save}>
        <label className="text-xs">Görev<select className="rf-input mt-1 w-full" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value, jobId: '' })}><option value="installation">Montaj</option><option value="shipment">Sevkiyat</option><option value="other">Diğer</option></select></label>
        {f.kind === 'other'
          ? <label className="text-xs">Açıklama<input className="rf-input mt-1 w-full" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
          : <label className="text-xs">İş<select className="rf-input mt-1 w-full" required value={f.jobId} onChange={(e) => pick(e.target.value)}><option value="">Seçin</option>{options.map((o) => <option key={o.id} value={o.id}>{o.label}{o.date ? ` · ${o.date}` : ''}</option>)}</select></label>}
        <label className="text-xs">Başlangıç<input type="datetime-local" required className="rf-input mt-1 w-full" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></label>
        <label className="text-xs">Bitiş<input type="datetime-local" required className="rf-input mt-1 w-full" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></label>
        <button type="submit" className="rf-primary-button self-end text-sm">Ata</button>
      </form>
      {v.assignments.length === 0 ? <EmptyState title="Görev yok" icon={CalendarRange} /> : (
        <ul className="space-y-1" aria-label="Görevler">
          {v.assignments.map((a) => (
            <li key={a.id} className={cn('rf-panel flex flex-wrap items-center gap-2 p-2 text-sm', a.conflict && 'border-amber-600/60')}>
              <span className="font-medium">{a.kind === 'installation' ? 'Montaj' : a.kind === 'shipment' ? 'Sevkiyat' : 'Diğer'}</span>
              {a.installationId ? <Link className="text-primary underline" href={`/installations?open=${a.installationId}`}>{a.title ?? 'Montajı aç'}</Link> : <span>{a.title ?? ''}</span>}
              <span className="text-xs text-muted-foreground">{when(a.startsAt)} – {when(a.endsAt)}{a.driverName ? ` · ${a.driverName}` : ''}</span>
              {a.conflict && <StatusChip tone="warning" label="Çakışma" />}
              <button type="button" className="rf-icon-button ml-auto" aria-label="Görevi kaldır" onClick={() => void remove('assignment', a.id)}><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Location({ v, onChanged, onError }: { v: Vehicle; onChanged: () => Promise<void>; onError: (e: string) => void }) {
  const [day, setDay] = useState(todayIso());
  const [route, setRoute] = useState<{ points: Array<{ at: string; lat: number; lng: number }>; totalPoints: number; sampled: boolean; distanceKm: number; stops: Array<{ from: string; to: string; minutes: number; lat: number; lng: number }>; dailyKm: Array<{ day: string; km: number }> } | null>(null);
  const [label, setLabel] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [routeError, setRouteError] = useState('');
  useEffect(() => {
    // Only the answer for the day still selected is shown; a failed day shows its error, not the old route.
    let current = true;
    setRoute(null); setRouteError('');
    void requestJson<NonNullable<typeof route>>(`/api/v1/vehicles/${v.id}/route?day=${day}`, { cache: 'no-store' }).then((r) => {
      if (!current) return;
      if (r.ok && r.data) setRoute(r.data); else setRouteError(r.error || 'Güzergâh alınamadı');
    });
    return () => { current = false; };
  }, [v.id, day]);
  async function addDevice(e: React.FormEvent) {
    e.preventDefault();
    const r = await post(`/api/v1/vehicles/${v.id}`, { type: 'device', label });
    if (!r.ok || !r.data) { onError(r.error || 'Cihaz eklenemedi'); return; }
    setToken(r.data.token); setLabel(''); await onChanged();
  }
  async function toggle(deviceId: string, active: boolean) {
    const r = await post(`/api/v1/vehicles/${v.id}/devices/${deviceId}`, { active }, 'PATCH');
    if (!r.ok) onError(r.error || 'Değiştirilemedi'); else await onChanged();
  }
  const last = route?.points[route.points.length - 1];
  return (
    <div className="space-y-3">
      {v.devices.length === 0 && !token ? (
        <EmptyState title="Cihaz bağla: bu araca henüz takip cihazı eklenmedi" icon={Radio} />
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs">Gün<input type="date" className="rf-input mt-1" value={day} onChange={(e) => setDay(e.target.value)} /></label>
            {route && <p className="text-sm">{route.totalPoints} nokta{route.sampled ? ` (haritada ${route.points.length} gösteriliyor)` : ''} · {route.distanceKm} km · {route.stops.length} durak</p>}
          </div>
          {route && route.points.length && last ? (
            <TileMap label={`${formatPlate(v.plate)} güzergâhı ${day}`} route={route.points} markers={[
              { id: 'last', lat: last.lat, lng: last.lng, label: formatPlate(v.plate) },
              ...route.stops.map((s, i) => ({ id: `stop-${i}`, lat: s.lat, lng: s.lng, label: `${s.minutes} dk`, tone: 'muted' as const })),
            ]} />
          ) : routeError ? <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{routeError}</p> : route ? <EmptyState title="Bu gün konum yok" icon={MapPin} /> : <Skeleton className="h-40" />}
          {route && route.stops.length > 0 && (
            <ul className="text-xs" aria-label="Duraklar">{route.stops.map((s, i) => <li key={i}>{when(s.from)} – {when(s.to)} · {s.minutes} dk</li>)}</ul>
          )}
        </>
      )}
      <details className="rf-panel space-y-2 p-3" aria-labelledby="devices-title">
        <summary className="cursor-pointer list-none"><h2 id="devices-title" className="inline-flex items-center gap-2 text-sm font-semibold"><KeyRound size={14} aria-hidden /> Cihazlar <HintTip text="Araca takılan takip cihazı konumu otomatik gönderir. Kurulumu teknik ekip yapar." /></h2></summary>
        {v.devices.map((d) => (
          <p key={d.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{d.label}</span>
            <StatusChip tone={d.active ? 'success' : 'muted'} label={d.active ? 'Açık' : 'Kapalı'} />
            <span className="text-xs text-muted-foreground">{d.lastSeenAt ? `son veri ${when(d.lastSeenAt)}` : 'veri gelmedi'}</span>
            <button type="button" className="rf-secondary-button text-xs" onClick={() => void toggle(d.id, !d.active)}>{d.active ? 'Kapat' : 'Aç'}</button>
          </p>
        ))}
        <form className="flex flex-wrap items-end gap-2" onSubmit={addDevice} aria-label="Cihaz ekle">
          <label className="text-xs">Cihaz adı<input className="rf-input mt-1" required maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Teltonika FMB920" /></label>
          <button type="submit" className="rf-secondary-button text-sm">Cihaz ekle</button>
        </form>
        {token && <label className="block text-xs">Bağlantı kodu (yalnız şimdi gösterilir, cihaza girin)<input readOnly className="rf-input mt-1 w-full font-mono text-xs" value={token} onFocus={(e) => e.currentTarget.select()} /></label>}
      </details>
    </div>
  );
}
