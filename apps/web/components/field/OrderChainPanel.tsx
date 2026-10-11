'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarPlus, LifeBuoy, ShieldCheck, Target, Wrench } from 'lucide-react';
import { HintTip, Skeleton, StatusChip } from '@/components/kit';
import { requestJson } from '@/lib/shared/network';
import { INSTALLATION_STATUS_LABELS, LEAD_SOURCE_LABELS, TICKET_CATEGORIES, TICKET_CATEGORY_LABELS, TICKET_STATUS_LABELS, type InstallationStatus, type LeadSource, type TicketStatus } from '@/lib/features/field/engine';

type Chain = {
  available: boolean;
  lead?: { id: string; number: string; source: string; quotationId: string | null } | null;
  installations?: Array<{ id: string; number: string; date: string | null; startTime: string | null; status: InstallationStatus; signed: boolean; crewNames: string[] }>;
  tickets?: Array<{ id: string; number: string; title: string; status: TicketStatus; inWarranty: boolean }>;
  warranty?: { covered: boolean; endsOn: string | null; daysLeft: number | null; reason: string | null };
  can?: { planInstallation: boolean; openTicket: boolean };
};

const post = (url: string, body: unknown) => requestJson<any>(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

/** The order's place in the chain: the lead behind it, installation and sign-off, service and warranty. */
export function OrderChainPanel({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [chain, setChain] = useState<Chain | null>(null);
  const [error, setError] = useState('');
  const [ticket, setTicket] = useState<{ title: string; category: string } | null>(null);
  const load = useCallback(async () => {
    const r = await requestJson<Chain>(`/api/v1/orders/${orderId}/chain`, { cache: 'no-store' });
    if (r.ok && r.data) setChain(r.data); else setError(r.error || 'Zincir bilgisi alınamadı');
  }, [orderId]);
  useEffect(() => { void load(); }, [load]);

  async function plan() {
    const r = await post('/api/v1/installations', { orderId });
    if (r.ok && r.data) router.push(`/installations?open=${r.data.id}`); else setError(r.error || 'Montaj planlanamadı');
  }
  async function openTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!ticket) return;
    const r = await post('/api/v1/service', { orderId, title: ticket.title, category: ticket.category });
    if (r.ok && r.data) router.push(`/service?open=${r.data.id}`); else setError(r.error || 'Servis kaydı açılamadı');
  }

  if (!chain) return error ? <p role="alert" className="rf-panel text-sm">{error}</p> : <Skeleton className="h-40" />;
  if (!chain.available) return <p className="rf-panel p-4 text-sm text-muted-foreground">Montaj ve servis zinciri veritabanı güncellemesinden (045) sonra açılır.</p>;
  return (
    <section className="rf-panel space-y-4 p-4" aria-label="Montaj ve servis">
      {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
      {chain.lead && (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <Target size={14} aria-hidden className="text-muted-foreground" />
          Kaynak: <Link className="text-primary underline" href={`/leads?open=${chain.lead.id}`}>{chain.lead.number}</Link>
          <span className="text-muted-foreground">({LEAD_SOURCE_LABELS[chain.lead.source as LeadSource] ?? chain.lead.source})</span>
          {chain.lead.quotationId && <Link className="text-primary underline" href={`/quotations/${chain.lead.quotationId}`}>Teklif</Link>}
        </p>
      )}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Wrench size={14} aria-hidden /> Montaj</h3>
          {chain.can?.planInstallation && <button type="button" className="rf-secondary-button inline-flex items-center gap-1 text-xs" onClick={() => void plan()}><CalendarPlus size={14} aria-hidden /> Montaj planla</button>}
        </div>
        {chain.installations?.length ? (
          <ul className="space-y-1">
            {chain.installations.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Link className="font-medium text-primary underline" href={`/installations?open=${i.id}`}>{i.number}</Link>
                <span className="text-xs text-muted-foreground">{i.date ?? 'tarih yok'} {i.startTime ?? ''} · {i.crewNames.join(', ') || 'ekip seçilmedi'}</span>
                <StatusChip tone={i.status === 'done' ? 'success' : i.status === 'cancelled' ? 'muted' : 'info'} label={INSTALLATION_STATUS_LABELS[i.status]} />
                {i.signed && <StatusChip tone="success" label="Teslim imzalı" />}
              </li>
            ))}
          </ul>
        ) : <p className="text-xs text-muted-foreground">Henüz montaj planı yok.</p>}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><LifeBuoy size={14} aria-hidden /> Servis ve garanti</h3>
          {chain.can?.openTicket && !ticket && <button type="button" className="rf-secondary-button text-xs" onClick={() => setTicket({ title: '', category: 'other' })}>Servis kaydı aç</button>}
        </div>
        {chain.warranty && (
          <p className="flex items-center gap-2 text-xs">
            <ShieldCheck size={14} aria-hidden className={chain.warranty.covered ? 'text-emerald-600' : 'text-muted-foreground'} />
            {chain.warranty.covered ? `Garanti ${chain.warranty.endsOn} tarihine kadar (${chain.warranty.daysLeft} gün)` : chain.warranty.reason}
            <HintTip text="Garanti teslim gününden itibaren firmanın garanti süresi kadardır (Servis ekranından değiştirilir). Servis kaydı açılırken o günkü durum kayda yazılır." />
          </p>
        )}
        {ticket && (
          <form onSubmit={openTicket} className="flex flex-wrap items-end gap-2" aria-label="Servis kaydı aç">
            <label className="min-w-0 flex-1 text-xs">Konu<input className="rf-input mt-1 w-full" required minLength={3} value={ticket.title} onChange={(e) => setTicket({ ...ticket, title: e.target.value })} /></label>
            <label className="text-xs">Tür<select className="rf-input mt-1" value={ticket.category} onChange={(e) => setTicket({ ...ticket, category: e.target.value })}>
              {TICKET_CATEGORIES.map((c) => <option key={c} value={c}>{TICKET_CATEGORY_LABELS[c]}</option>)}
            </select></label>
            <button type="submit" className="rf-primary-button text-xs">Aç</button>
            <button type="button" className="rf-secondary-button text-xs" onClick={() => setTicket(null)}>Vazgeç</button>
          </form>
        )}
        {chain.tickets?.length ? (
          <ul className="space-y-1">
            {chain.tickets.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Link className="font-medium text-primary underline" href={`/service?open=${t.id}`}>{t.number}</Link>
                <span className="min-w-0 truncate">{t.title}</span>
                <StatusChip tone={t.status === 'resolved' || t.status === 'closed' ? 'success' : 'warning'} label={TICKET_STATUS_LABELS[t.status]} />
                {t.inWarranty && <StatusChip tone="info" label="Garantide" />}
              </li>
            ))}
          </ul>
        ) : <p className="text-xs text-muted-foreground">Servis kaydı yok.</p>}
      </div>
    </section>
  );
}
