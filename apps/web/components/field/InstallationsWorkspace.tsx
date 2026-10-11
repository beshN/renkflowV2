'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, ChevronLeft, ChevronRight, Link2, MapPin, PackageX, Wrench } from 'lucide-react';
import { EmptyState, HintTip, PageHeader, Skeleton, StatusChip } from '@/components/kit';
import { RecordButton } from '@/components/records/RecordDrawer';
import { requestJson } from '@/lib/shared/network';
import { cn } from '@/lib/utils';
import { INSTALLATION_STATUS_LABELS, type InstallationStatus } from '@/lib/features/field/engine';

type Installation = {
  id: string; number: string; orderId: string; orderNumber: string; crew: string[]; crewNames: string[]; crewName: string | null; date: string | null; startTime: string | null;
  durationMinutes: number; status: InstallationStatus; issues: Array<{ kind: 'missing' | 'damage'; text: string; at: string }>; notes: string | null; signed: boolean; signedAt: string | null;
  signedName?: string | null; customerName?: string | null; address?: string | null; mapUrl?: string | null; orderStatus?: string | null; signoffOpen?: boolean; technicalView?: true;
  productName: string | null; checklistDone: number; checklistTotal: number; version: number;
};
type Conflict = { a: string; b: string; people: string[]; date: string };
type Member = { id: string; name: string | null; email: string; role: string };

const send = (url: string, method: string, body?: unknown) => requestJson<any>(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
const day = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return day(d); };
const monday = (iso: string) => { const d = new Date(iso + 'T00:00:00Z'); const w = (d.getUTCDay() + 6) % 7; return addDays(iso, -w); };
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date());
const dayLabel = (iso: string) => new Intl.DateTimeFormat('tr-TR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(iso + 'T00:00:00Z'));
const NEXT: Record<InstallationStatus, InstallationStatus[]> = { planned: ['in_progress', 'cancelled'], in_progress: ['done', 'planned'], done: [], cancelled: ['planned'] };

/** Installation plan: crews by day (drag a job to another day), conflicts, the job's checklist and sign-off. */
export function InstallationsWorkspace({ field }: { field: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const openId = params.get('open');
  const [week, setWeek] = useState(() => monday(today()));
  const [data, setData] = useState<{ installations: Installation[]; conflicts: Conflict[] } | null>(null);
  const [error, setError] = useState('');
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(week, i)), [week]);
  const load = useCallback(async () => {
    const r = await requestJson<{ installations: Installation[]; conflicts: Conflict[] }>(`/api/v1/installations?from=${week}&to=${addDays(week, 6)}`, { cache: 'no-store' });
    if (r.ok && r.data) { setData(r.data); setError(''); } else setError(r.error || 'Montajlar alınamadı');
  }, [week]);
  useEffect(() => { void load(); }, [load]);
  const open = (id: string | null) => router.replace(id ? `/installations?open=${id}` : '/installations', { scroll: false });

  async function reschedule(i: Installation, date: string) {
    if (i.date === date || field) return;
    const r = await send(`/api/v1/installations/${i.id}`, 'PATCH', { date, expectedVersion: i.version });
    if (!r.ok) setError(r.error || 'Taşınamadı');
    else { if (r.data?.conflicts?.length) setError(`${i.number} taşındı, ancak aynı ekipte çakışma var.`); await load(); }
  }

  if (!data) return error ? <p role="alert" className="rf-panel text-sm">{error}</p> : <Skeleton className="h-64" />;
  const inConflict = new Set(data.conflicts.flatMap((c) => [c.a, c.b]));
  const unscheduled = data.installations.filter((i) => !i.date);
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Saha" title={field ? 'Montajlarım' : 'Montaj planı'} hint={field ? 'Size atanan montajlar. Kontrol listesini ve fotoğrafları kaydın çekmecesinden işleyin; eksik ya da hasarı not edin.' : 'Siparişten "Montaj planla" ile açılır. Kartı başka güne sürükleyerek taşıyın; aynı kişi aynı saatte iki işte ise çakışma uyarısı çıkar (engellemez). Bitince müşteriye teslim imza bağlantısı gönderin.'}
        kpis={[{ label: 'bu hafta', value: data.installations.filter((i) => i.date).length, icon: Wrench }, { label: 'çakışma', value: data.conflicts.length, icon: AlertTriangle, tone: data.conflicts.length ? 'warning' : 'neutral' }, { label: 'tarihsiz', value: unscheduled.length }]}
        action={<div className="flex items-center gap-1">
          <button type="button" className="rf-icon-button" aria-label="Önceki hafta" onClick={() => setWeek(addDays(week, -7))}><ChevronLeft size={16} /></button>
          <button type="button" className="rf-secondary-button text-xs" onClick={() => setWeek(monday(today()))}>Bu hafta</button>
          <button type="button" className="rf-icon-button" aria-label="Sonraki hafta" onClick={() => setWeek(addDays(week, 7))}><ChevronRight size={16} /></button>
        </div>} />
      {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
      {openId && <InstallationDetail id={openId} field={field} onClose={() => open(null)} onChanged={load} onError={setError} />}
      {data.installations.length === 0 ? <EmptyState title="Bu hafta montaj yok" icon={Wrench} /> : (
        <div className="grid gap-2 md:grid-cols-7" aria-label="Haftalık montaj takvimi">
          {days.map((d) => (
            <section key={d} aria-label={dayLabel(d)} className={cn('min-h-24 min-w-0 space-y-1 rounded-md border border-border p-1.5', d === today() && 'border-primary/60')}
              onDragOver={(e) => !field && e.preventDefault()}
              onDrop={(e) => { const id = e.dataTransfer.getData('text/installation'); const i = data.installations.find((x) => x.id === id); if (i) void reschedule(i, d); }}>
              <h2 className="text-[11px] font-semibold text-muted-foreground">{dayLabel(d)}</h2>
              {data.installations.filter((i) => i.date === d).map((i) => (
                <button key={i.id} type="button" draggable={!field && i.status !== 'done'} onDragStart={(e) => e.dataTransfer.setData('text/installation', i.id)} onClick={() => open(i.id)}
                  className={cn('block w-full space-y-0.5 rounded border bg-card p-1.5 text-left text-xs', inConflict.has(i.id) ? 'border-amber-600/60' : 'border-border', openId === i.id && 'ring-1 ring-primary')}>
                  <span className="flex items-center gap-1 font-medium">{inConflict.has(i.id) && <AlertTriangle size={12} aria-label="Çakışma" className="text-amber-600" />}{i.startTime ?? ''} {i.number}</span>
                  <span className="block truncate text-muted-foreground">{i.crewName || i.crewNames.join(', ') || 'ekip yok'}</span>
                  {!i.technicalView && i.customerName && <span className="block truncate">{i.customerName}</span>}
                  <span className="flex flex-wrap gap-1"><StatusChip tone={i.status === 'done' ? 'success' : i.status === 'in_progress' ? 'warning' : i.status === 'cancelled' ? 'muted' : 'info'} label={INSTALLATION_STATUS_LABELS[i.status]} />{i.signed && <StatusChip tone="success" label="İmzalı" />}</span>
                </button>
              ))}
            </section>
          ))}
        </div>
      )}
      {unscheduled.length > 0 && (
        <section className="space-y-1" aria-label="Tarihsiz montajlar">
          <h2 className="text-xs font-semibold">Tarihsiz (bir güne sürükleyin)</h2>
          <div className="flex flex-wrap gap-2">
            {unscheduled.map((i) => <button key={i.id} type="button" draggable={!field} onDragStart={(e) => e.dataTransfer.setData('text/installation', i.id)} onClick={() => open(i.id)} className="rounded border border-border px-2 py-1 text-xs">{i.number} · {i.orderNumber}</button>)}
          </div>
        </section>
      )}
    </div>
  );
}

function InstallationDetail({ id, field, onClose, onChanged, onError }: { id: string; field: boolean; onClose: () => void; onChanged: () => Promise<void>; onError: (e: string) => void }) {
  const [i, setI] = useState<(Installation & { conflicts: Conflict[] }) | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [issue, setIssue] = useState<{ kind: 'missing' | 'damage'; text: string } | null>(null);
  const [link, setLink] = useState<string | null>(null);
  // The crew boxes answer at once; the server's answer replaces this on reload.
  const [crew, setCrew] = useState<string[]>([]);
  const load = useCallback(async () => {
    const r = await requestJson<Installation & { conflicts: Conflict[] }>(`/api/v1/installations/${id}`, { cache: 'no-store' });
    if (r.ok && r.data) { setI(r.data); setCrew(r.data.crew); } else onError(r.error || 'Montaj alınamadı');
  }, [id, onError]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (field) return;
    void requestJson<{ members: Member[] }>('/api/tenant/members').then((r) => r.ok && r.data && setMembers(r.data.members.filter((m) => m.role !== 'member')));
  }, [field]);
  if (!i) return <Skeleton className="h-40" />;
  async function patch(body: Record<string, unknown>) {
    const r = await send(`/api/v1/installations/${id}`, 'PATCH', { ...body, expectedVersion: i!.version });
    if (!r.ok) { onError(r.error || 'Kaydedilemedi'); return; }
    if (r.data?.conflicts?.length) onError('Kaydedildi; aynı kişi aynı saatte başka bir montajda (çakışma).');
    await Promise.all([load(), onChanged()]);
  }
  async function addIssue(e: React.FormEvent) {
    e.preventDefault();
    if (!issue) return;
    const r = await send(`/api/v1/installations/${id}`, 'POST', { action: 'issue', ...issue });
    if (!r.ok) onError(r.error || 'Not eklenemedi'); else { setIssue(null); await load(); }
  }
  async function signoff() {
    const r = await send(`/api/v1/installations/${id}`, 'POST', { action: 'signoff' });
    if (!r.ok || !r.data) { onError(r.error || 'Bağlantı oluşturulamadı'); return; }
    setLink(`${window.location.origin}${r.data.path}`);
    await load();
  }
  const editable = !field && i.status !== 'done';
  return (
    <section className="rf-panel space-y-3 p-4" aria-label={`${i.number} ayrıntı`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{i.technicalView ? i.number : <>{i.number} · <Link className="text-primary underline" href={`/orders/${i.orderId}`}>{i.orderNumber}</Link></>}</p>
          <h2 className="text-lg font-semibold">{i.productName ?? 'Montaj'}</h2>
          {!i.technicalView && <p className="text-sm">{i.customerName}</p>}
          {!i.technicalView && i.address && <p className="flex flex-wrap items-center gap-1 text-xs"><MapPin size={12} aria-hidden />{i.address}{i.mapUrl && <a className="text-primary underline" href={i.mapUrl} target="_blank" rel="noreferrer noopener">Harita</a>}</p>}
          <p className="text-xs">Kontrol listesi {i.checklistDone}/{i.checklistTotal}{i.signed ? ` · teslim imzalandı${i.signedName ? ` (${i.signedName})` : ''}` : ''}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <RecordButton type="installation" id={i.id} label="Kontrol listesi ve fotoğraf" />
          {NEXT[i.status].map((s) => (field && s === 'cancelled') ? null : (
            <button key={s} type="button" className={s === 'done' ? 'rf-primary-button text-sm' : 'rf-secondary-button text-sm'} onClick={() => void patch({ status: s })}>{s === 'in_progress' ? 'Sahaya çıkıldı' : s === 'done' ? 'Montaj tamam' : s === 'cancelled' ? 'İptal et' : 'Plana geri al'}</button>
          ))}
          <button type="button" className="rf-secondary-button text-sm" onClick={onClose}>Kapat</button>
        </div>
      </div>
      {i.conflicts.length > 0 && <p role="alert" className="flex items-center gap-1 text-xs text-amber-800 dark:text-amber-300"><AlertTriangle size={14} aria-hidden /> Aynı gün ve saatte başka montajda olan ekip üyesi var.</p>}
      {!field && (
        <div className="grid gap-2 sm:grid-cols-4">
          <label className="text-xs">Gün<input type="date" className="rf-input mt-1 w-full" disabled={!editable} defaultValue={i.date ?? ''} onBlur={(e) => e.target.value && e.target.value !== i.date && void patch({ date: e.target.value })} /></label>
          <label className="text-xs">Başlangıç<input type="time" className="rf-input mt-1 w-full" disabled={!editable} defaultValue={i.startTime ?? ''} onBlur={(e) => e.target.value !== (i.startTime ?? '') && void patch({ startTime: e.target.value || null })} /></label>
          <label className="text-xs">Süre (dk)<input type="number" min={15} step={15} className="rf-input mt-1 w-full" disabled={!editable} defaultValue={i.durationMinutes} onBlur={(e) => Number(e.target.value) !== i.durationMinutes && void patch({ durationMinutes: Number(e.target.value) })} /></label>
          <label className="text-xs">Ekip adı<input className="rf-input mt-1 w-full" disabled={!editable} defaultValue={i.crewName ?? ''} onBlur={(e) => e.target.value !== (i.crewName ?? '') && void patch({ crewName: e.target.value || null })} /></label>
          <fieldset className="sm:col-span-4">
            <legend className="text-xs">Ekip</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {members.map((m) => (
                <label key={m.id} className="inline-flex items-center gap-1 text-xs">
                  <input type="checkbox" className="h-4 w-4" disabled={!editable} checked={crew.includes(m.id)}
                    onChange={() => { const next = crew.includes(m.id) ? crew.filter((c) => c !== m.id) : [...crew, m.id]; setCrew(next); void patch({ crew: next }); }} />
                  {m.name || m.email}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      )}
      {field && <p className="text-xs">{i.date ?? 'tarih yok'} {i.startTime ?? ''} · {i.durationMinutes} dk · {i.crewNames.join(', ')}</p>}
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1 text-sm font-semibold"><PackageX size={14} aria-hidden /> Eksik ve hasar</h3>
          {i.status !== 'cancelled' && !issue && <button type="button" className="rf-secondary-button text-xs" onClick={() => setIssue({ kind: 'missing', text: '' })}>Not ekle</button>}
        </div>
        {issue && (
          <form onSubmit={addIssue} className="flex flex-wrap items-end gap-2" aria-label="Eksik ya da hasar notu">
            <label className="text-xs">Tür<select className="rf-input mt-1" value={issue.kind} onChange={(e) => setIssue({ ...issue, kind: e.target.value as 'missing' | 'damage' })}><option value="missing">Eksik parça</option><option value="damage">Hasar</option></select></label>
            <label className="min-w-0 flex-1 text-xs">Açıklama<input className="rf-input mt-1 w-full" required minLength={3} value={issue.text} onChange={(e) => setIssue({ ...issue, text: e.target.value })} /></label>
            <button type="submit" className="rf-primary-button text-xs">Ekle</button>
            <button type="button" className="rf-secondary-button text-xs" onClick={() => setIssue(null)}>Vazgeç</button>
          </form>
        )}
        {i.issues.length ? <ul className="list-disc pl-5 text-xs">{i.issues.map((x, n) => <li key={n}>{x.kind === 'missing' ? 'Eksik' : 'Hasar'}: {x.text}</li>)}</ul> : <p className="text-xs text-muted-foreground">Not yok.</p>}
      </div>
      {!field && (i.status === 'in_progress' || i.status === 'done') && !i.signed && (
        <div className="space-y-1">
          <button type="button" className="rf-secondary-button inline-flex items-center gap-1 text-sm" onClick={() => void signoff()}><Link2 size={14} aria-hidden /> {i.signoffOpen ? 'Yeni imza bağlantısı' : 'Teslim imza bağlantısı'}</button>
          <HintTip text="Müşteri bağlantıdan işi görür (fiyat yok) ve adıyla teslimi onaylar. Bağlantı 14 gün geçerli ve yalnız bir kez gösterilir. İmzadan sonra 'teslim edildi' önerisi Önerilenler'e düşer." />
          {link && <input readOnly className="rf-input w-full font-mono text-xs" value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Teslim imza bağlantısı" />}
        </div>
      )}
    </section>
  );
}
