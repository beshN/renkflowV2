'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { BarChart3, LifeBuoy, ListChecks, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { EmptyState, HintTip, PageHeader, Skeleton, StatusChip } from '@/components/kit';
import { RecordButton } from '@/components/records/RecordDrawer';
import { requestJson } from '@/lib/shared/network';
import { cn } from '@/lib/utils';
import { TICKET_CATEGORY_LABELS, TICKET_STATUSES, TICKET_STATUS_LABELS, TICKET_TRANSITIONS, type TicketCategory, type TicketStatus } from '@/lib/features/field/engine';

type Ticket = {
  id: string; number: string; title: string; description: string | null; category: string; priority: string; status: TicketStatus; assignedTo: string | null; assigneeName: string | null;
  orderId: string | null; orderNumber: string | null; installationId: string | null; inWarranty: boolean; warrantyEndsOn: string | null; parts: Array<{ name: string; quantity: number }>;
  laborMinutes: number; resolution: string | null; openedAt: string; resolvedAt: string | null; customerName?: string | null; technicalView?: true; version: number;
};
type Report = { total: number; open: number; avgResolutionHours: number | null; maxResolutionHours: number | null; warrantyMonths: number;
  recurring: { byCategory: Array<{ category: string; family: string | null; count: number }>; byOrder: Array<{ orderId: string; orderNumber: string | null; count: number }> } };
type Member = { id: string; name: string | null; email: string; role: string };

const send = (url: string, method: string, body?: unknown) => requestJson<any>(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
const when = (iso: string | null) => (iso ? new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso)) : '—');
const PRIORITY: Record<string, string> = { low: 'Düşük', normal: 'Normal', high: 'Yüksek', urgent: 'Acil' };

/** After-sales and warranty tickets: who works on what, parts and labour, and what keeps coming back. */
export function ServiceWorkspace({ field, manager }: { field: boolean; manager: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const openId = params.get('open');
  const [status, setStatus] = useState('');
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [tab, setTab] = useState<'list' | 'report'>('list');
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const r = await requestJson<{ tickets: Ticket[] }>(`/api/v1/service${status ? `?status=${status}` : ''}`, { cache: 'no-store' });
    if (r.ok && r.data) { setTickets(r.data.tickets); setError(''); } else setError(r.error || 'Servis kayıtları alınamadı');
  }, [status]);
  useEffect(() => { void load(); }, [load]);
  const open = (id: string | null) => router.replace(id ? `/service?open=${id}` : '/service', { scroll: false });
  if (!tickets) return error ? <p role="alert" className="rf-panel text-sm">{error}</p> : <Skeleton className="h-64" />;
  const openCount = tickets.filter((t) => !['resolved', 'closed'].includes(t.status)).length;
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Satış sonrası" title={field ? 'Servis işlerim' : 'Servis ve garanti'} hint="Servis kaydı siparişin ya da montajın 'Montaj & servis' bölümünden tek tıkla açılır. Garanti, açılış anında teslim günü ve firmanın garanti süresine göre yazılır."
        kpis={[{ label: 'açık', value: openCount, icon: LifeBuoy, tone: openCount ? 'warning' : 'neutral' }, { label: 'garantide', value: tickets.filter((t) => t.inWarranty).length, icon: ShieldCheck }]} />
      {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
      {!field && (
        <div className="flex gap-1 rounded-md border border-border p-1" role="tablist" aria-label="Görünüm">
          {([['list', 'Kayıtlar', ListChecks], ['report', 'Rapor', BarChart3]] as const).map(([k, label, Icon]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={cn('flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-2 text-xs font-medium', tab === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
              <Icon size={14} aria-hidden /> {label}
            </button>
          ))}
        </div>
      )}
      {openId && <TicketDetail id={openId} field={field} onClose={() => open(null)} onChanged={load} onError={setError} />}
      {tab === 'report' && !field ? <ServiceReport manager={manager} onError={setError} /> : (
        <>
          <label className="text-xs">Durum
            <select className="rf-input ml-2" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Tümü</option>{TICKET_STATUSES.map((s) => <option key={s} value={s}>{TICKET_STATUS_LABELS[s]}</option>)}
            </select>
          </label>
          {tickets.length === 0 ? <EmptyState title="Servis kaydı yok" icon={LifeBuoy} /> : (
            <ul className="space-y-2" aria-label="Servis kayıtları">
              {tickets.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => open(t.id)} className={cn('rf-panel flex w-full flex-wrap items-center gap-2 p-3 text-left text-sm', openId === t.id && 'border-primary')}>
                    <span className="font-medium">{t.number}</span>
                    <span className="min-w-0 flex-1 truncate">{t.title}</span>
                    <span className="text-xs text-muted-foreground">{TICKET_CATEGORY_LABELS[t.category as TicketCategory] ?? t.category} · {when(t.openedAt)}</span>
                    {t.inWarranty && <StatusChip tone="info" label="Garantide" />}
                    <StatusChip tone={t.status === 'resolved' || t.status === 'closed' ? 'success' : t.priority === 'urgent' ? 'danger' : 'warning'} label={TICKET_STATUS_LABELS[t.status]} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function TicketDetail({ id, field, onClose, onChanged, onError }: { id: string; field: boolean; onClose: () => void; onChanged: () => Promise<void>; onError: (e: string) => void }) {
  const [t, setT] = useState<Ticket | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [parts, setParts] = useState<Array<{ name: string; quantity: number }>>([]);
  const [labor, setLabor] = useState(0);
  const [resolution, setResolution] = useState('');
  const load = useCallback(async () => {
    const r = await requestJson<Ticket>(`/api/v1/service/${id}`, { cache: 'no-store' });
    if (r.ok && r.data) { setT(r.data); setParts(r.data.parts); setLabor(r.data.laborMinutes); setResolution(r.data.resolution ?? ''); } else onError(r.error || 'Kayıt alınamadı');
  }, [id, onError]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (field) return;
    void requestJson<{ members: Member[] }>('/api/tenant/members').then((r) => r.ok && r.data && setMembers(r.data.members.filter((m) => m.role !== 'member')));
  }, [field]);
  if (!t) return <Skeleton className="h-40" />;
  async function patch(body: Record<string, unknown>) {
    const r = await send(`/api/v1/service/${id}`, 'PATCH', { ...body, expectedVersion: t!.version });
    if (!r.ok) onError(r.error || 'Kaydedilemedi'); else { setT(r.data); await onChanged(); }
  }
  const closed = t.status === 'closed';
  return (
    <section className="rf-panel space-y-3 p-4" aria-label={`${t.number} ayrıntı`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{t.number} · {TICKET_CATEGORY_LABELS[t.category as TicketCategory] ?? t.category} · öncelik {PRIORITY[t.priority] ?? t.priority}
            {!t.technicalView && t.orderId && <> · <Link className="text-primary underline" href={`/orders/${t.orderId}`}>{t.orderNumber}</Link></>}</p>
          <h2 className="text-lg font-semibold">{t.title}</h2>
          {!t.technicalView && t.customerName && <p className="text-sm">{t.customerName}</p>}
          {t.description && <p className="text-sm">{t.description}</p>}
          <p className="text-xs">{t.inWarranty ? `Garantide (bitiş ${t.warrantyEndsOn})` : t.warrantyEndsOn ? `Garanti ${t.warrantyEndsOn} tarihinde bitti` : 'Garanti bilgisi yok (teslim tarihi yok)'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <RecordButton type="service_ticket" id={t.id} label="Notlar ve fotoğraf" />
          <button type="button" className="rf-secondary-button text-sm" onClick={onClose}>Kapat</button>
        </div>
      </div>
      {!field && !closed && (
        <label className="text-xs">Atanan
          <select className="rf-input ml-2" value={t.assignedTo ?? ''} onChange={(e) => void patch({ assignedTo: e.target.value || null })}>
            <option value="">—</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}
          </select>
        </label>
      )}
      {field && <p className="text-xs">Atanan: {t.assigneeName ?? '—'}</p>}
      <fieldset className="space-y-2" disabled={closed}>
        <legend className="text-sm font-semibold">Parça ve işçilik</legend>
        {parts.map((p, n) => (
          <div key={n} className="flex items-end gap-2">
            <label className="min-w-0 flex-1 text-xs">Parça<input className="rf-input mt-1 w-full" value={p.name} onChange={(e) => setParts(parts.map((x, i) => (i === n ? { ...x, name: e.target.value } : x)))} /></label>
            <label className="w-20 text-xs">Adet<input type="number" min={0} className="rf-input mt-1 w-full" value={p.quantity} onChange={(e) => setParts(parts.map((x, i) => (i === n ? { ...x, quantity: Number(e.target.value) } : x)))} /></label>
            <button type="button" className="rf-icon-button" aria-label="Parçayı kaldır" onClick={() => setParts(parts.filter((_, i) => i !== n))}><Trash2 size={14} /></button>
          </div>
        ))}
        <div className="flex flex-wrap items-end gap-2">
          <button type="button" className="rf-secondary-button inline-flex items-center gap-1 text-xs" onClick={() => setParts([...parts, { name: '', quantity: 1 }])}><Plus size={14} aria-hidden /> Parça</button>
          <label className="text-xs">İşçilik (dk)<input type="number" min={0} className="rf-input ml-2 w-24" value={labor} onChange={(e) => setLabor(Number(e.target.value))} /></label>
          <button type="button" className="rf-secondary-button text-xs" onClick={() => void patch({ parts: parts.filter((p) => p.name.trim() && p.quantity > 0), laborMinutes: labor })}>Kaydet</button>
        </div>
      </fieldset>
      <label className="block text-xs">Çözüm<textarea className="rf-input mt-1 w-full" rows={2} disabled={closed} value={resolution} onChange={(e) => setResolution(e.target.value)} /></label>
      <div className="flex flex-wrap gap-2">
        {TICKET_TRANSITIONS[t.status].filter((s) => !field || s !== 'closed').map((s) => (
          <button key={s} type="button" className={s === 'resolved' ? 'rf-primary-button text-sm' : 'rf-secondary-button text-sm'} onClick={() => void patch({ status: s, resolution: resolution || null })}>{TICKET_STATUS_LABELS[s]}</button>
        ))}
      </div>
    </section>
  );
}

function ServiceReport({ manager, onError }: { manager: boolean; onError: (e: string) => void }) {
  const [r, setR] = useState<Report | null>(null);
  const load = useCallback(async () => {
    const x = await requestJson<Report>('/api/v1/service?report=1', { cache: 'no-store' });
    if (x.ok && x.data) setR(x.data); else onError(x.error || 'Rapor alınamadı');
  }, [onError]);
  useEffect(() => { void load(); }, [load]);
  if (!r) return <Skeleton className="h-40" />;
  async function months(v: string) {
    const x = await send('/api/v1/service/settings', 'PUT', { warrantyMonths: Number(v) });
    if (!x.ok) onError(x.error || 'Kaydedilemedi'); else await load();
  }
  return (
    <section className="space-y-3" aria-label="Servis raporu">
      <p className="text-sm">Toplam {r.total} · açık {r.open} · ortalama çözüm {r.avgResolutionHours ?? '—'} saat · en uzun {r.maxResolutionHours ?? '—'} saat</p>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rf-panel p-3">
          <h3 className="mb-1 text-sm font-semibold">Tekrar eden arıza (tür + ürün)</h3>
          {r.recurring.byCategory.length ? <ul className="text-sm">{r.recurring.byCategory.map((c) => <li key={c.category + c.family}>{TICKET_CATEGORY_LABELS[c.category as TicketCategory] ?? c.category}{c.family ? ` · ${c.family}` : ''}: {c.count}</li>)}</ul> : <p className="text-xs text-muted-foreground">Tekrar eden yok.</p>}
        </div>
        <div className="rf-panel p-3">
          <h3 className="mb-1 text-sm font-semibold">Aynı siparişe tekrar gelinen</h3>
          {r.recurring.byOrder.length ? <ul className="text-sm">{r.recurring.byOrder.map((o) => <li key={o.orderId}><Link className="text-primary underline" href={`/orders/${o.orderId}`}>{o.orderNumber ?? o.orderId.slice(0, 8)}</Link>: {o.count} kayıt</li>)}</ul> : <p className="text-xs text-muted-foreground">Yok.</p>}
        </div>
      </div>
      <label className="inline-flex items-center gap-2 text-xs">Garanti süresi (ay)
        <input type="number" min={0} max={240} className="rf-input w-20" defaultValue={r.warrantyMonths} disabled={!manager} onBlur={(e) => Number(e.target.value) !== r.warrantyMonths && void months(e.target.value)} />
        <HintTip text="Teslim gününden itibaren. Yalnız yeni açılan servis kayıtlarına uygulanır; açılmış kayıtların garanti durumu değişmez." />
      </label>
    </section>
  );
}
