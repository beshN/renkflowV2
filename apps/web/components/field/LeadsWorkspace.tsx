'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { BarChart3, CalendarClock, FileText, KanbanSquare, MapPin, Phone, Plus, Ruler, Target, Trophy } from 'lucide-react';
import { EmptyState, HintTip, PageHeader, Skeleton, StatusChip } from '@/components/kit';
import { RecordButton } from '@/components/records/RecordDrawer';
import { requestJson } from '@/lib/shared/network';
import { cn } from '@/lib/utils';
import { PRODUCT_FAMILIES } from '@/lib/features/products/families';
import {
  LEAD_SOURCES, LEAD_SOURCE_LABELS, LEAD_STAGES, LEAD_STAGE_LABELS, LEAD_TRANSITIONS, LOST_REASONS, LOST_REASON_LABELS,
  type LeadSource, type LeadStage, type MeasureField,
} from '@/lib/features/field/engine';

type Lead = {
  id: string; number: string; title: string; contactName: string; companyName: string | null; phone: string | null; email: string | null; address: string | null; mapUrl: string | null;
  source: string; stage: LeadStage; lostReason: string | null; productFamily: string | null; estimatedValue?: number | null; ownerName: string | null; nextFollowUp: string | null;
  quotationId: string | null; quotationNumber: string | null; customerId: string | null; surveys?: number; version: number;
};
type Survey = {
  id: string; scheduledAt: string | null; address: string | null; mapUrl: string | null; assigneeName: string | null; status: 'planned' | 'done' | 'cancelled'; productFamily: string | null;
  fields: MeasureField[]; measures: Record<string, string | number | boolean>; notes: string | null; quotedAt: string | null;
  changedSinceQuote: Array<{ key: string; label: string; before: unknown; after: unknown }>;
};
type Report = { overall: { total: number; open: number; won: number; lost: number; conversionPct: number | null; avgDaysToWin: number | null }; bySource: Array<{ source: string; total: number; won: number; lost: number; open: number; conversionPct: number | null; avgDaysToWin: number | null }>; funnel: Array<{ stage: LeadStage; count: number }> };

const OPEN_STAGES: LeadStage[] = ['new', 'survey', 'quoted', 'negotiation'];
const send = (url: string, method: string, body?: unknown) => requestJson<any>(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
const money = (n: number | null | undefined) => (n === null || n === undefined ? null : new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n));
const when = (iso: string | null) => (iso ? new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : 'zaman seçilmedi');
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date());

/** Lead pipeline: board by stage, the lead's surveys and measures, conversion by source. */
export function LeadsWorkspace() {
  const router = useRouter();
  const params = useSearchParams();
  const openId = params.get('open');
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'board' | 'report'>('board');
  const [creating, setCreating] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [losing, setLosing] = useState<{ lead: Lead; reason: string; note: string } | null>(null);
  const load = useCallback(async () => {
    const r = await requestJson<{ leads: Lead[] }>('/api/v1/leads', { cache: 'no-store' });
    if (r.ok && r.data) { setLeads(r.data.leads); setError(''); } else setError(r.error || 'Potansiyel müşteriler alınamadı');
  }, []);
  useEffect(() => { void load(); }, [load]);
  const open = (id: string | null) => router.replace(id ? `/leads?open=${id}` : '/leads', { scroll: false });

  async function move(lead: Lead, to: LeadStage, lostReason?: string, lostNote?: string) {
    if (to === lead.stage) return;
    if (to === 'lost' && !lostReason) { setLosing({ lead, reason: '', note: '' }); return; }
    const r = await send(`/api/v1/leads/${lead.id}`, 'POST', { action: 'move', to, lostReason, lostNote, expectedVersion: lead.version });
    if (!r.ok) setError(r.error || 'Aşama değiştirilemedi'); else { setLosing(null); await load(); if (to === 'quoted' || to === 'won') open(lead.id); }
  }

  const overdue = useMemo(() => (leads ?? []).filter((l) => OPEN_STAGES.includes(l.stage) && l.nextFollowUp && l.nextFollowUp < today()).length, [leads]);
  if (!leads) return error ? <p role="alert" className="rf-panel text-sm">{error}</p> : <Skeleton className="h-64" />;
  const openCount = leads.filter((l) => OPEN_STAGES.includes(l.stage)).length;
  const won = leads.filter((l) => l.stage === 'won').length;
  const closed = won + leads.filter((l) => l.stage === 'lost').length;
  const stages = showClosed ? LEAD_STAGES : OPEN_STAGES;
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Satış" title="Potansiyel müşteriler" hint="Yeni → Keşif → Teklif → Pazarlık → Kazanıldı/Kaybedildi. Kartı sürükleyerek ya da kartın aşama seçicisinden ilerletin. Teklif aşamasına gelen kayıt için müşteri kartı ve keşif ölçülerinden taslak teklif kendiliğinden açılır."
        kpis={[{ label: 'açık', value: openCount, icon: Target }, { label: 'kazanılan', value: won, icon: Trophy, tone: 'success' }, { label: 'dönüşüm', value: closed ? `%${Math.round((won / closed) * 100)}` : '—' }, { label: 'takibi geçmiş', value: overdue, icon: CalendarClock, tone: overdue ? 'warning' : 'neutral' }]}
        action={<button type="button" className="rf-primary-button inline-flex items-center gap-1 text-sm" onClick={() => setCreating(true)}><Plus size={14} aria-hidden /> Yeni</button>} />
      {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
      {creating && <NewLead onClose={() => setCreating(false)} onCreated={async (id) => { setCreating(false); await load(); open(id); }} onError={setError} />}
      {losing && (
        <form className="rf-panel flex flex-wrap items-end gap-2 p-3" aria-label="Kayıp nedeni" onSubmit={(e) => { e.preventDefault(); void move(losing.lead, 'lost', losing.reason, losing.note); }}>
          <p className="w-full text-sm font-medium">{losing.lead.number} kaybedildi: neden?</p>
          <label className="text-xs">Neden<select className="rf-input mt-1" required value={losing.reason} onChange={(e) => setLosing({ ...losing, reason: e.target.value })}>
            <option value="">Seçin</option>{LOST_REASONS.map((r) => <option key={r} value={r}>{LOST_REASON_LABELS[r]}</option>)}
          </select></label>
          <label className="min-w-0 flex-1 text-xs">Not<input className="rf-input mt-1 w-full" value={losing.note} onChange={(e) => setLosing({ ...losing, note: e.target.value })} /></label>
          <button type="submit" className="rf-primary-button text-sm">Kaydet</button>
          <button type="button" className="rf-secondary-button text-sm" onClick={() => setLosing(null)}>Vazgeç</button>
        </form>
      )}
      <div className="flex gap-1 rounded-md border border-border p-1" role="tablist" aria-label="Görünüm">
        {([['board', 'Hat', KanbanSquare], ['report', 'Dönüşüm raporu', BarChart3]] as const).map(([k, label, Icon]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={cn('flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-2 text-xs font-medium', tab === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
            <Icon size={14} aria-hidden /> {label}
          </button>
        ))}
      </div>
      {openId && <LeadDetail id={openId} onClose={() => open(null)} onChanged={load} onError={setError} />}
      {tab === 'board' ? (
        <>
          <label className="inline-flex items-center gap-2 text-xs"><input type="checkbox" className="h-4 w-4" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> Kapananları da göster</label>
          {leads.length === 0 ? <EmptyState title="Henüz potansiyel müşteri yok" icon={Target} /> : (
            <div className={cn('grid gap-3', showClosed ? 'md:grid-cols-3 xl:grid-cols-6' : 'md:grid-cols-2 xl:grid-cols-4')}>
              {stages.map((stage) => (
                <section key={stage} aria-label={LEAD_STAGE_LABELS[stage]} className="min-w-0 space-y-2 rounded-md border border-border p-2"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { const id = e.dataTransfer.getData('text/lead'); const lead = leads.find((l) => l.id === id); if (lead && LEAD_TRANSITIONS[lead.stage].includes(stage)) void move(lead, stage); else if (lead && lead.stage !== stage) setError(`${LEAD_STAGE_LABELS[lead.stage]} → ${LEAD_STAGE_LABELS[stage]} geçişi yapılamaz`); }}>
                  <h2 className="flex items-center justify-between text-xs font-semibold">{LEAD_STAGE_LABELS[stage]}<span className="text-muted-foreground">{leads.filter((l) => l.stage === stage).length}</span></h2>
                  {leads.filter((l) => l.stage === stage).map((l) => (
                    <article key={l.id} draggable={LEAD_TRANSITIONS[l.stage].length > 0} onDragStart={(e) => e.dataTransfer.setData('text/lead', l.id)}
                      className={cn('cursor-grab space-y-1 rounded-md border border-border bg-card p-2 text-sm', openId === l.id && 'border-primary')}>
                      <button type="button" className="block w-full text-left" onClick={() => open(l.id)}>
                        <span className="block text-xs text-muted-foreground">{l.number} · {LEAD_SOURCE_LABELS[l.source as LeadSource] ?? l.source}</span>
                        <span className="block font-medium">{l.title}</span>
                        <span className="block truncate text-xs">{l.contactName}{l.companyName ? ` · ${l.companyName}` : ''}</span>
                      </button>
                      <div className="flex flex-wrap items-center gap-1">
                        {money(l.estimatedValue) && <span className="text-xs tabular-nums">{money(l.estimatedValue)}</span>}
                        {l.nextFollowUp && <StatusChip tone={l.nextFollowUp < today() && OPEN_STAGES.includes(l.stage) ? 'warning' : 'neutral'} label={`Takip ${l.nextFollowUp}`} />}
                        {l.stage === 'lost' && l.lostReason && <StatusChip tone="muted" label={LOST_REASON_LABELS[l.lostReason as keyof typeof LOST_REASON_LABELS] ?? l.lostReason} />}
                      </div>
                      {LEAD_TRANSITIONS[l.stage].length > 0 && (
                        <label className="block text-[11px]"><span className="sr-only">{l.number} aşamasını değiştir</span>
                          <select className="rf-input w-full text-xs" value="" onChange={(e) => e.target.value && void move(l, e.target.value as LeadStage)}>
                            <option value="">Aşamaya taşı…</option>
                            {LEAD_TRANSITIONS[l.stage].map((s) => <option key={s} value={s}>{LEAD_STAGE_LABELS[s]}</option>)}
                          </select>
                        </label>
                      )}
                    </article>
                  ))}
                </section>
              ))}
            </div>
          )}
        </>
      ) : <LeadReport />}
    </div>
  );
}

function NewLead({ onClose, onCreated, onError }: { onClose: () => void; onCreated: (id: string) => Promise<void>; onError: (e: string) => void }) {
  const [f, setF] = useState({ title: '', contactName: '', companyName: '', phone: '', email: '', address: '', source: 'phone', productFamily: 'pergola', estimatedValue: '', nextFollowUp: '' });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = await send('/api/v1/leads', 'POST', { ...f, estimatedValue: f.estimatedValue ? Number(f.estimatedValue) : null, nextFollowUp: f.nextFollowUp || null, email: f.email || null });
    if (r.ok && r.data) await onCreated(r.data.id); else onError(r.error || 'Kaydedilemedi');
  }
  const input = (k: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="text-xs">{label}<input className="rf-input mt-1 w-full" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...props} /></label>
  );
  return (
    <form onSubmit={save} className="rf-panel grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Yeni potansiyel müşteri">
      {input('title', 'Konu', { required: true, placeholder: 'Bahçe pergolası' })}
      {input('contactName', 'Kişi', { required: true })}
      {input('companyName', 'Firma')}
      {input('phone', 'Telefon', { type: 'tel' })}
      {input('email', 'E-posta', { type: 'email' })}
      {input('address', 'Adres')}
      <label className="text-xs">Kaynak<select className="rf-input mt-1 w-full" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}>{LEAD_SOURCES.map((s) => <option key={s} value={s}>{LEAD_SOURCE_LABELS[s]}</option>)}</select></label>
      <label className="text-xs">Ürün ailesi<select className="rf-input mt-1 w-full" value={f.productFamily} onChange={(e) => setF({ ...f, productFamily: e.target.value })}><option value="">Diğer</option>{PRODUCT_FAMILIES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select></label>
      {input('estimatedValue', 'Tahmini tutar (₺)', { type: 'number', min: 0 })}
      {input('nextFollowUp', 'Sonraki takip', { type: 'date' })}
      <div className="flex items-end gap-2 sm:col-span-2">
        <button type="submit" className="rf-primary-button text-sm">Kaydet</button>
        <button type="button" className="rf-secondary-button text-sm" onClick={onClose}>Vazgeç</button>
      </div>
    </form>
  );
}

function LeadDetail({ id, onClose, onChanged, onError }: { id: string; onClose: () => void; onChanged: () => Promise<void>; onError: (e: string) => void }) {
  const [lead, setLead] = useState<(Lead & { surveys: Survey[] }) | null>(null);
  const [planning, setPlanning] = useState<{ at: string; address: string } | null>(null);
  const load = useCallback(async () => {
    const r = await requestJson<Lead & { surveys: Survey[] }>(`/api/v1/leads/${id}`, { cache: 'no-store' });
    if (r.ok && r.data) setLead(r.data); else onError(r.error || 'Kayıt alınamadı');
  }, [id, onError]);
  useEffect(() => { void load(); }, [load]);
  if (!lead) return <Skeleton className="h-40" />;
  const closed = lead.stage === 'won' || lead.stage === 'lost';
  async function convert() {
    const r = await send(`/api/v1/leads/${id}`, 'POST', { action: 'convert' });
    if (!r.ok || !r.data) { onError(r.error || 'Teklif oluşturulamadı'); return; }
    await Promise.all([load(), onChanged()]);
  }
  async function plan(e: React.FormEvent) {
    e.preventDefault();
    if (!planning) return;
    const r = await send(`/api/v1/leads/${id}`, 'POST', { action: 'survey', scheduledAt: planning.at ? new Date(planning.at).toISOString() : null, address: planning.address || null });
    if (!r.ok) { onError(r.error || 'Keşif planlanamadı'); return; }
    setPlanning(null);
    await Promise.all([load(), onChanged()]);
  }
  async function followUp(date: string) {
    const r = await send(`/api/v1/leads/${id}`, 'PATCH', { nextFollowUp: date || null });
    if (!r.ok) onError(r.error || 'Kaydedilemedi'); else { setLead(r.data); await onChanged(); }
  }
  return (
    <section className="rf-panel space-y-3 p-4" aria-label={`${lead.number} ayrıntı`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{lead.number} · {LEAD_STAGE_LABELS[lead.stage]} · {LEAD_SOURCE_LABELS[lead.source as LeadSource] ?? lead.source}</p>
          <h2 className="text-lg font-semibold">{lead.title}</h2>
          <p className="text-sm">{lead.contactName}{lead.companyName ? ` · ${lead.companyName}` : ''}</p>
          <p className="flex flex-wrap gap-3 text-xs">
            {lead.phone && <a className="inline-flex items-center gap-1 text-primary underline" href={`tel:${lead.phone.replace(/\s/g, '')}`}><Phone size={12} aria-hidden />{lead.phone}</a>}
            {lead.email && <a className="text-primary underline" href={`mailto:${lead.email}`}>{lead.email}</a>}
            {lead.address && <span className="inline-flex items-center gap-1"><MapPin size={12} aria-hidden />{lead.address}{lead.mapUrl && <a className="text-primary underline" href={lead.mapUrl} target="_blank" rel="noreferrer noopener">Harita</a>}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <RecordButton type="lead" id={lead.id} label="Takip ve notlar" />
          {lead.quotationId
            ? <Link className="rf-primary-button inline-flex items-center gap-1 text-sm" href={`/quotations/${lead.quotationId}`}><FileText size={14} aria-hidden /> {lead.quotationNumber ?? 'Teklifi aç'}</Link>
            : lead.stage !== 'lost' && <button type="button" className="rf-primary-button inline-flex items-center gap-1 text-sm" onClick={() => void convert()}><FileText size={14} aria-hidden /> Teklif oluştur</button>}
          <button type="button" className="rf-secondary-button text-sm" onClick={onClose}>Kapat</button>
        </div>
      </div>
      {!closed && (
        <label className="inline-flex items-center gap-2 text-xs">Sonraki takip
          <input type="date" className="rf-input" defaultValue={lead.nextFollowUp ?? ''} onBlur={(e) => e.target.value !== (lead.nextFollowUp ?? '') && void followUp(e.target.value)} />
          <HintTip text="Takip etkinliği (arama, e-posta) için 'Takip ve notlar'dan etkinlik ekleyin; günü gelince bildirim düşer." />
        </label>
      )}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Ruler size={14} aria-hidden /> Keşif ve ölçü</h3>
          {!closed && !planning && <button type="button" className="rf-secondary-button text-xs" onClick={() => setPlanning({ at: '', address: lead.address ?? '' })}>Keşif planla</button>}
        </div>
        {planning && (
          <form onSubmit={plan} className="flex flex-wrap items-end gap-2" aria-label="Keşif planla">
            <label className="text-xs">Zaman<input type="datetime-local" className="rf-input mt-1" value={planning.at} onChange={(e) => setPlanning({ ...planning, at: e.target.value })} /></label>
            <label className="min-w-0 flex-1 text-xs">Adres<input className="rf-input mt-1 w-full" value={planning.address} onChange={(e) => setPlanning({ ...planning, address: e.target.value })} /></label>
            <button type="submit" className="rf-primary-button text-xs">Planla</button>
            <button type="button" className="rf-secondary-button text-xs" onClick={() => setPlanning(null)}>Vazgeç</button>
          </form>
        )}
        {lead.surveys.length === 0 ? <p className="text-xs text-muted-foreground">Keşif yok.</p> : lead.surveys.map((s) => <SurveyCard key={s.id} survey={s} readOnly={closed} onSaved={load} onError={onError} />)}
      </div>
    </section>
  );
}

function SurveyCard({ survey, readOnly, onSaved, onError }: { survey: Survey; readOnly: boolean; onSaved: () => Promise<void>; onError: (e: string) => void }) {
  const [values, setValues] = useState<Record<string, string | number | boolean>>(survey.measures);
  async function save(status?: 'done') {
    const r = await send(`/api/v1/leads/surveys/${survey.id}`, 'PATCH', { measures: values, ...(status ? { status } : {}) });
    if (!r.ok) onError(r.error || 'Ölçü kaydedilemedi'); else await onSaved();
  }
  return (
    <article className="space-y-2 rounded-md border border-border p-3">
      <p className="flex flex-wrap items-center gap-2 text-xs">
        <StatusChip tone={survey.status === 'done' ? 'success' : survey.status === 'cancelled' ? 'muted' : 'info'} label={survey.status === 'done' ? 'Ölçüldü' : survey.status === 'cancelled' ? 'İptal' : 'Planlandı'} />
        <span>{when(survey.scheduledAt)}</span>
        {survey.address && <span className="inline-flex items-center gap-1"><MapPin size={12} aria-hidden />{survey.address}</span>}
        {survey.mapUrl && <a className="text-primary underline" href={survey.mapUrl} target="_blank" rel="noreferrer noopener">Harita</a>}
        {survey.assigneeName && <span className="text-muted-foreground">· {survey.assigneeName}</span>}
      </p>
      {survey.changedSinceQuote.length > 0 && (
        <p role="alert" className="text-xs text-amber-800 dark:text-amber-300">Teklif sonrası değişen ölçü: {survey.changedSinceQuote.map((d) => `${d.label} ${d.before ?? '—'} → ${d.after ?? '—'}`).join(' · ')}</p>
      )}
      <div className="grid gap-2 sm:grid-cols-3">
        {survey.fields.map((f) => (
          <label key={f.key} className="text-xs">{f.label}{f.required ? ' *' : ''}
            {f.type === 'choice' ? (
              <select className="rf-input mt-1 w-full" disabled={readOnly} value={String(values[f.key] ?? '')} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}>
                <option value="">—</option>{f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : f.type === 'yesno' ? (
              <select className="rf-input mt-1 w-full" disabled={readOnly} value={values[f.key] === undefined ? '' : String(values[f.key])} onChange={(e) => setValues({ ...values, [f.key]: e.target.value === 'true' })}>
                <option value="">—</option><option value="true">Evet</option><option value="false">Hayır</option>
              </select>
            ) : (
              <input className="rf-input mt-1 w-full" disabled={readOnly} inputMode={f.type === 'text' ? 'text' : 'numeric'} value={String(values[f.key] ?? '')}
                onChange={(e) => setValues({ ...values, [f.key]: f.type === 'text' ? e.target.value : e.target.value.replace(/[^\d]/g, '') })} />
            )}
          </label>
        ))}
      </div>
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rf-secondary-button text-xs" onClick={() => void save()}>Kaydet</button>
          {survey.status !== 'done' && <button type="button" className="rf-primary-button text-xs" onClick={() => void save('done')}>Ölçü tamam</button>}
          <span className="text-[11px] text-muted-foreground">Fotoğraflar için kaydın &quot;Takip ve notlar&quot; çekmecesinden dosya ekleyin.</span>
        </div>
      )}
    </article>
  );
}

function LeadReport() {
  const [from, setFrom] = useState(() => today().slice(0, 8) + '01');
  const [to, setTo] = useState('');
  const [r, setR] = useState<Report | null>(null);
  useEffect(() => {
    const p = new URLSearchParams({ report: '1', ...(from ? { from } : {}), ...(to ? { to } : {}) });
    void requestJson<Report>(`/api/v1/leads?${p}`, { cache: 'no-store' }).then((x) => x.ok && x.data && setR(x.data));
  }, [from, to]);
  const max = Math.max(1, ...(r?.funnel.map((f) => f.count) ?? [1]));
  return (
    <section className="space-y-3" aria-label="Dönüşüm raporu">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs">Başlangıç<input type="date" className="rf-input mt-1" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-xs">Bitiş (hariç)<input type="date" className="rf-input mt-1" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <HintTip text="Dönüşüm = kazanılan ÷ (kazanılan + kaybedilen); açık kayıtlar ayrı sayılır. Dönem, kaydın açıldığı güne göredir." />
      </div>
      {!r ? <Skeleton className="h-40" /> : (
        <>
          <p className="text-sm">Toplam {r.overall.total} · açık {r.overall.open} · kazanılan {r.overall.won} · kaybedilen {r.overall.lost} · dönüşüm {r.overall.conversionPct === null ? '—' : `%${r.overall.conversionPct}`} · kazanmaya ortalama {r.overall.avgDaysToWin ?? '—'} gün</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1">Kaynak</th><th>Toplam</th><th>Açık</th><th>Kazanılan</th><th>Kaybedilen</th><th>Dönüşüm</th><th>Ort. gün</th></tr></thead>
              <tbody>
                {r.bySource.map((s) => (
                  <tr key={s.source} className="border-t border-border tabular-nums">
                    <td className="py-1">{LEAD_SOURCE_LABELS[s.source as LeadSource] ?? s.source}</td><td>{s.total}</td><td>{s.open}</td><td>{s.won}</td><td>{s.lost}</td>
                    <td>{s.conversionPct === null ? '—' : `%${s.conversionPct}`}</td><td>{s.avgDaysToWin ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-1" aria-label="Aşama dağılımı">
            {r.funnel.map((f) => (
              <li key={f.stage} className="grid grid-cols-[96px_1fr_32px] items-center gap-2 text-xs">
                <span>{LEAD_STAGE_LABELS[f.stage]}</span>
                <span className="h-3 rounded-sm bg-primary/70" style={{ width: `${(f.count / max) * 100}%` }} aria-hidden />
                <span className="tabular-nums">{f.count}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
