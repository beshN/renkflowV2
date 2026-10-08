'use client';

import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, Copy, GitCompareArrows, History, Link2, MessageCircle, Percent, Save } from 'lucide-react';
import { HintTip, StatusChip } from '@/components/kit';
import { requestJson } from '@/lib/shared/network';
import { formatCurrency } from '@/lib/utils';

type Diff = { header: Array<{ field: string; label: string; from: unknown; to: unknown }>; lines: Array<{ kind: 'added' | 'removed' | 'changed'; productName: string; changes: Array<{ label: string; from: unknown; to: unknown }> }>; totalDelta: number };
type Depth = {
  available: true;
  history: { available: boolean; current: number; revisions: Array<{ revision: number; status: string; reason: string | null; at: string; by: string | null; totalAmount: number; diffToNext: Diff; nextRevision: number }> };
  discount: { effective: number; threshold: number; approved: number | null; needsApproval: boolean; tryTotal: number | null };
  decision: { decidedAt: string | null; name: string | null; ip: string | null; note: string | null; link: { createdAt: string; expiresAt: string; used: boolean; revoked: boolean; live: boolean } | null; validUntil: string | null } | null;
};
const STATUS_TR: Record<string, string> = { draft: 'Taslak', sent: 'Gönderildi', accepted: 'Kabul', rejected: 'Red', expired: 'Süresi doldu', converted: 'Siparişe döndü' };
const show = (v: unknown, currency: string, label: string) =>
  v == null || v === '' ? '—' : typeof v === 'number' && /fiyat|Toplam/i.test(label) ? formatCurrency(v, currency) : String(v);

/**
 * The quote's sales depth beside its lines: the discount against the firm's threshold (and the
 * manager's approval), the customer approval link and decision, revisions with what changed, and
 * saving it as a template.
 */
export function QuoteSalesPanel({ quoteId, status, currency, role, onChanged }: { quoteId: string; status: string; currency: string; role: string; onChanged: () => void }) {
  const [data, setData] = useState<Depth | { available: false } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string>('');
  const [revising, setRevising] = useState(false);
  const [reason, setReason] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [saved, setSaved] = useState('');
  const office = ['owner', 'admin', 'office'].includes(role);
  const manager = ['owner', 'admin'].includes(role);

  const load = useCallback(async () => {
    const r = await requestJson<Depth | { available: false }>(`/api/v1/quotations/${quoteId}/sales`, { cache: 'no-store' });
    if (r.ok && r.data) setData(r.data);
    else setError(r.error || 'Bilgi alınamadı');
  }, [quoteId]);
  useEffect(() => { void load(); }, [load, status]);

  async function command(body: Record<string, unknown>) {
    setBusy(true);
    setError('');
    const r = await requestJson<any>(`/api/v1/quotations/${quoteId}/sales`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setBusy(false);
    if (!r.ok) { setError(r.error || 'İşlem tamamlanamadı'); return null; }
    return r.data;
  }

  if (!data || !data.available) return null;
  const { discount: ds, decision, history } = data;
  const url = link ? `${window.location.origin}${link}` : '';

  return (
    <section className="grid gap-4 lg:grid-cols-2" aria-label="Teklif onayı ve geçmişi">
      {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm lg:col-span-2">{error}</p>}

      <div className="rf-panel space-y-3">
        <div className="flex items-center gap-2">
          <Percent size={16} aria-hidden />
          <h3 className="text-sm font-semibold">İndirim</h3>
          <HintTip text="Satır ve genel indirim birlikte, liste fiyatına göre. Firma eşiğini aşan indirimle teklif gönderilemez ve siparişe dönüştürülemez; yönetici onayı gerekir." />
          <StatusChip className="ml-auto" tone={ds.needsApproval ? 'warning' : ds.effective > ds.threshold ? 'success' : 'neutral'} label={ds.needsApproval ? 'Yönetici onayı gerekli' : ds.effective > ds.threshold ? `Onaylı %${ds.approved}` : 'Eşik içinde'} />
        </div>
        <div className="relative h-3 rounded-full bg-muted" role="img" aria-label={`İndirim yüzde ${ds.effective}, eşik yüzde ${ds.threshold}`}>
          <span className={`absolute inset-y-0 left-0 rounded-full ${ds.needsApproval ? 'bg-amber-500' : 'bg-primary'}`} style={{ width: `${Math.min(100, ds.effective * 2)}%` }} />
          <span className="absolute inset-y-[-3px] w-0.5 bg-foreground" style={{ left: `${Math.min(100, ds.threshold * 2)}%` }} />
        </div>
        <p className="flex justify-between text-xs tabular-nums text-muted-foreground"><span>%{ds.effective}</span><span>eşik %{ds.threshold}</span></p>
        {ds.tryTotal != null && currency !== 'TRY' && <p className="text-xs text-muted-foreground">TL karşılığı {formatCurrency(ds.tryTotal, 'TRY')} · kur elle girildi</p>}
        {ds.needsApproval && manager && ['draft', 'sent'].includes(status) && (
          <button type="button" disabled={busy} className="rf-primary-button" onClick={async () => { if (await command({ action: 'approve_discount' })) { await load(); onChanged(); } }}>
            <BadgeCheck size={15} /> İndirimi onayla
          </button>
        )}
      </div>

      <div className="rf-panel space-y-3">
        <div className="flex items-center gap-2">
          <Link2 size={16} aria-hidden />
          <h3 className="text-sm font-semibold">Müşteri onayı</h3>
          {decision?.link?.live && <StatusChip className="ml-auto" tone="info" label="Bağlantı açık" />}
        </div>
        {decision?.decidedAt ? (
          <div className="space-y-1 text-sm">
            <StatusChip tone={status === 'accepted' ? 'success' : 'danger'} label={status === 'accepted' ? 'Müşteri onayladı' : 'Müşteri reddetti'} />
            <p>{decision.name} · {new Date(decision.decidedAt).toLocaleString('tr-TR')}</p>
            <p className="text-xs text-muted-foreground">IP {decision.ip}{decision.note ? ` · “${decision.note}”` : ''}</p>
          </div>
        ) : status === 'sent' && office ? (
          <div className="space-y-2">
            <button type="button" disabled={busy} className="rf-primary-button" onClick={async () => { const r = await command({ action: 'approval_link' }); if (r?.path) { setLink(r.path); await load(); } }}>
              <Link2 size={15} /> {decision?.link?.live ? 'Yeni bağlantı oluştur' : 'Onay bağlantısı oluştur'}
            </button>
            {url && (
              <div className="flex flex-wrap items-center gap-2">
                <input readOnly aria-label="Onay bağlantısı" className="rf-input min-w-0 flex-1 text-xs" value={url} onFocus={(e) => e.currentTarget.select()} />
                <button type="button" className="rf-icon-button" aria-label="Kopyala" onClick={() => void navigator.clipboard?.writeText(url)}><Copy size={14} /></button>
                <a className="rf-icon-button" aria-label="WhatsApp ile gönder" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`Teklifiniz: ${url}`)}`}><MessageCircle size={14} /></a>
              </div>
            )}
            {decision?.link && !url && <p className="text-xs text-muted-foreground">Son bağlantı {new Date(decision.link.expiresAt).toLocaleDateString('tr-TR')} tarihine kadar{decision.link.revoked ? ' · kapatıldı' : ''}</p>}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{status === 'draft' ? 'Gönderilince bağlantı oluşturulur' : STATUS_TR[status] ?? status}</p>
        )}
      </div>

      <div className="rf-panel space-y-3 lg:col-span-2">
        <div className="flex flex-wrap items-center gap-2">
          <History size={16} aria-hidden />
          <h3 className="text-sm font-semibold">Revizyonlar</h3>
          <StatusChip tone="neutral" label={`Rev. ${history.current}`} />
          {office && ['sent', 'accepted', 'rejected', 'expired'].includes(status) && !revising && (
            <button type="button" className="ml-auto text-xs font-medium text-primary" onClick={() => setRevising(true)}><GitCompareArrows size={13} className="mr-1 inline" />Revize et</button>
          )}
        </div>
        {revising && (
          <form className="flex flex-wrap gap-2" onSubmit={async (e) => { e.preventDefault(); if (await command({ action: 'revise', reason })) { setRevising(false); setReason(''); onChanged(); } }}>
            <input autoFocus required minLength={3} aria-label="Revizyon gerekçesi" placeholder="Gerekçe" className="rf-input min-w-0 flex-1" value={reason} onChange={(e) => setReason(e.target.value)} />
            <button disabled={busy} className="rf-primary-button">Taslağa al</button>
            <button type="button" className="rf-input" onClick={() => setRevising(false)}>Vazgeç</button>
          </form>
        )}
        {history.revisions.length === 0 ? <p className="text-xs text-muted-foreground">İlk sürüm</p> : (
          <ol className="space-y-2">
            {[...history.revisions].reverse().map((r) => (
              <li key={r.revision} className="rounded-md border border-border p-3 text-sm">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">Rev. {r.revision} → {r.nextRevision}</span>
                  <StatusChip tone="muted" label={STATUS_TR[r.status] ?? r.status} />
                  <span className="text-xs text-muted-foreground">{r.by ?? ''} · {new Date(r.at).toLocaleDateString('tr-TR')}</span>
                  {r.diffToNext.totalDelta !== 0 && <span className={`ml-auto text-xs font-semibold tabular-nums ${r.diffToNext.totalDelta > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>{r.diffToNext.totalDelta > 0 ? '+' : ''}{formatCurrency(r.diffToNext.totalDelta, currency)}</span>}
                </p>
                {r.reason && <p className="mt-1 text-xs text-muted-foreground">{r.reason}</p>}
                <ul className="mt-2 space-y-0.5 text-xs">
                  {r.diffToNext.lines.map((l, i) => (
                    <li key={i}>
                      <span className={l.kind === 'added' ? 'text-emerald-700 dark:text-emerald-300' : l.kind === 'removed' ? 'text-rose-700 line-through dark:text-rose-300' : ''}>{l.kind === 'added' ? '+ ' : l.kind === 'removed' ? '− ' : '~ '}{l.productName}</span>
                      {l.changes.map((c) => ` · ${c.label}: ${show(c.from, currency, c.label)} → ${show(c.to, currency, c.label)}`).join('')}
                    </li>
                  ))}
                  {r.diffToNext.header.filter((h) => h.field !== 'totalAmount').map((h) => <li key={h.field}>~ {h.label}: {show(h.from, currency, h.label)} → {show(h.to, currency, h.label)}</li>)}
                </ul>
              </li>
            ))}
          </ol>
        )}
        {office && (
          <form className="flex flex-wrap items-center gap-2 border-t border-border pt-3" onSubmit={async (e) => { e.preventDefault(); const r = await command({ action: 'save_template', name: templateName }); if (r) { setSaved(r.name); setTemplateName(''); } }}>
            <input required maxLength={80} aria-label="Şablon adı" placeholder="Şablon adı" className="rf-input min-w-0 flex-1" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
            <button disabled={busy} className="rf-input inline-flex items-center gap-1"><Save size={14} /> Şablon olarak kaydet</button>
            {saved && <span role="status" className="text-xs text-primary">“{saved}” kaydedildi</span>}
          </form>
        )}
      </div>
    </section>
  );
}
