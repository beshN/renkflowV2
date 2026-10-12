'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, GitPullRequestArrow, PackageCheck, Plus, Trash2, Wallet } from 'lucide-react';
import { EmptyState, HintTip, ProgressRing, Skeleton, StatusChip } from '@/components/kit';
import { requestJson } from '@/lib/shared/network';
import { formatCurrency, cn } from '@/lib/utils';
import { money } from '@/lib/features/sales/engine';
import { OrderMaterials } from '@/components/stock/OrderMaterials';

type Line = { orderItemId: string; productName: string; quantity: number; delivered: number; remaining: number; deliveryStatus: 'open' | 'partial' | 'delivered'; unitPrice: number; widthMm: number | null; heightMm: number | null; color: string | null; workOrders: number };
type Row = { seq: number; label: string; dueOn: string; amount: number; paid: number; remaining: number; state: 'paid' | 'partial' | 'overdue' | 'today' | 'planned' };
type Change = { id: string; status: 'pending' | 'applied' | 'rejected'; reason: string; changes: Array<Record<string, unknown>>; impact: { level: 'none' | 'warn' | 'block'; reasons: string[] }; by: string | null; at: string; decidedBy: string | null };
type Sales = {
  available: true; today: string; status: string; currency: string; totalAmount: number;
  dates: { planned: string | null; promised: string | null; delivered: string | null; slipDays: number | null };
  lines: Line[]; deliveries: Array<{ id: string; orderItemId: string; quantity: number; deliveredOn: string; note: string | null; by: string | null }>;
  plan: { rows: Row[]; planned: number; paid: number; overdue: number; mismatch: string | null; surplus: number };
  changes: Change[];
};

const LINE_TONE = { open: ['muted', 'Bekliyor'], partial: ['warning', 'Kısmi'], delivered: ['success', 'Teslim'] } as const;
const ROW_TONE = { paid: ['success', 'Ödendi'], partial: ['info', 'Kısmi'], overdue: ['danger', 'Gecikti'], today: ['warning', 'Bugün'], planned: ['muted', 'Planlı'] } as const;
const FIELD = { quantity: 'Adet', widthMm: 'Genişlik', heightMm: 'Yükseklik', projectionMm: 'Açılım', color: 'Renk', unitPrice: 'Birim fiyat', notes: 'Not' } as Record<string, string>;
const dateTr = (d: string | null) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }) : '—');

/**
 * The order's commercial side in one tab: promise against reality, what has been delivered line
 * by line, the payment plan against what came in, and change requests with their production impact.
 */
export function OrderSalesPanel({ orderId, canEdit, canPlan, onOrderChanged }: { orderId: string; canEdit: boolean; canPlan: boolean; onOrderChanged?: () => void }) {
  const [data, setData] = useState<Sales | { available: false } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'' | 'promise' | 'delivery' | 'plan' | 'change'>('');

  const load = useCallback(async () => {
    const r = await requestJson<Sales | { available: false }>(`/api/v1/orders/${orderId}/sales`, { cache: 'no-store' });
    if (r.ok && r.data) setData(r.data);
    else setError(r.error || 'Bilgi alınamadı');
  }, [orderId]);
  useEffect(() => { void load(); }, [load]);

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError('');
    const r = await requestJson<Sales>(`/api/v1/orders/${orderId}/sales`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setBusy(false);
    if (!r.ok || !r.data) { setError(r.error || 'İşlem tamamlanamadı'); return false; }
    setData(r.data);
    setMode('');
    // Only an applied change moves the order's own figures (total); the rest lives in this panel.
    if (body.action === 'decide' && body.decision === 'apply') onOrderChanged?.();
    return true;
  }

  if (!data) return <div className="rf-panel space-y-3" role="status"><span className="sr-only">Yükleniyor</span><Skeleton className="h-16" /><Skeleton className="h-24" /></div>;
  if (!data.available) return <EmptyState title="Teslim ve ödeme planı veritabanı güncellemesinden sonra açılır" icon={Wallet} />;
  const d = data;
  const slip = d.dates.slipDays;

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">{error}</p>}

      <OrderMaterials orderId={orderId} />

      {/* Promise vs reality */}
      <section className="rf-panel space-y-3" aria-label="Termin">
        <div className="flex items-center gap-2">
          <CalendarClock size={16} aria-hidden />
          <h3 className="text-sm font-semibold">Termin</h3>
          <HintTip text="Söz verilen tarih sipariş onaylanınca planlanan terminden alınır ve sabit kalır; gecikme ona göre ölçülür. Değiştirmek gerekçe ister." />
          {slip != null && <StatusChip className="ml-auto" tone={slip > 0 ? 'danger' : 'success'} label={slip > 0 ? `+${slip} gün` : d.dates.delivered ? 'Zamanında' : 'Yolunda'} />}
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[['Planlanan', d.dates.planned], ['Söz verilen', d.dates.promised], ['Teslim', d.dates.delivered]].map(([label, value]) => (
            <div key={label} className="rounded-md border border-border px-2 py-2">
              <p className="text-[11px] text-muted-foreground">{label}</p>
              <p className="text-sm font-semibold tabular-nums">{dateTr(value)}</p>
            </div>
          ))}
        </div>
        {canEdit && mode !== 'promise' && <button type="button" className="text-xs font-medium text-primary" onClick={() => setMode('promise')}>Söz tarihini değiştir</button>}
        {mode === 'promise' && <PromiseForm current={d.dates.promised} busy={busy} onCancel={() => setMode('')} onSave={(date, reason) => send({ action: 'promise', date, reason })} />}
      </section>

      {/* Lines and deliveries */}
      <section className="rf-panel space-y-3" aria-label="Teslimat">
        <div className="flex items-center gap-2">
          <PackageCheck size={16} aria-hidden />
          <h3 className="text-sm font-semibold">Teslimat</h3>
          {canEdit && d.lines.some((l) => l.remaining > 0) && mode !== 'delivery' && <button type="button" className="ml-auto text-xs font-medium text-primary" onClick={() => setMode('delivery')}>Teslim gir</button>}
        </div>
        <ul className="space-y-2">
          {d.lines.map((l) => {
            const [tone, label] = LINE_TONE[l.deliveryStatus];
            return (
              <li key={l.orderItemId} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-sm">{l.productName}</span>
                <span className="h-2 w-24 overflow-hidden rounded-full bg-muted" aria-hidden><span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (l.delivered / Math.max(1, l.quantity)) * 100)}%` }} /></span>
                <span className="w-12 text-right text-xs tabular-nums">{l.delivered}/{l.quantity}</span>
                <StatusChip tone={tone} label={label} />
              </li>
            );
          })}
        </ul>
        {mode === 'delivery' && <DeliveryForm lines={d.lines} today={d.today} busy={busy} onCancel={() => setMode('')} onSave={(body) => send({ action: 'delivery', ...body })} />}
        {d.deliveries.length > 0 && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Teslim kayıtları ({d.deliveries.length})</summary>
            <ul className="mt-2 space-y-1">
              {d.deliveries.map((x) => <li key={x.id}>{dateTr(x.deliveredOn)} · {d.lines.find((l) => l.orderItemId === x.orderItemId)?.productName} × {x.quantity}{x.by ? ` · ${x.by}` : ''}{x.note ? ` · ${x.note}` : ''}</li>)}
            </ul>
          </details>
        )}
      </section>

      {/* Payment plan */}
      <section className="rf-panel space-y-3" aria-label="Ödeme planı">
        <div className="flex items-center gap-2">
          <Wallet size={16} aria-hidden />
          <h3 className="text-sm font-semibold">Ödeme planı</h3>
          {canPlan && mode !== 'plan' && <button type="button" className="ml-auto text-xs font-medium text-primary" onClick={() => setMode('plan')}>{d.plan.rows.length ? 'Düzenle' : 'Plan oluştur'}</button>}
        </div>
        {d.plan.mismatch && d.plan.rows.length > 0 && <p className="rounded-md border border-amber-600/35 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">{d.plan.mismatch}</p>}
        {d.plan.rows.length > 0 ? (
          <div className="flex items-center gap-4">
            <ProgressRing value={d.plan.paid} max={d.plan.planned} label="Tahsil edilen" center={<span className="text-[11px] font-semibold tabular-nums">%{Math.round((d.plan.paid / Math.max(1, d.plan.planned)) * 100)}</span>} />
            <ul className="min-w-0 flex-1 space-y-1.5">
              {d.plan.rows.map((r) => {
                const [tone, label] = ROW_TONE[r.state];
                return (
                  <li key={r.seq} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{r.label}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{dateTr(r.dueOn)}</span>
                    <span className="w-24 text-right tabular-nums">{formatCurrency(r.amount, d.currency)}</span>
                    <StatusChip tone={tone} label={label} />
                  </li>
                );
              })}
            </ul>
          </div>
        ) : mode !== 'plan' && <p className="text-xs text-muted-foreground">Plan yok</p>}
        {mode === 'plan' && <PlanForm total={d.totalAmount} currency={d.currency} today={d.today} initial={d.plan.rows} busy={busy} onCancel={() => setMode('')} onSave={(installments) => send({ action: 'plan', installments })} />}
      </section>

      {/* Change requests */}
      <section className="rf-panel space-y-3" aria-label="Değişiklik talepleri">
        <div className="flex items-center gap-2">
          <GitPullRequestArrow size={16} aria-hidden />
          <h3 className="text-sm font-semibold">Değişiklik talepleri</h3>
          <HintTip text="Onaylı siparişte ölçü, adet, renk ya da fiyat değişikliği talep olarak girilir. Üretim başladıysa uygulamadan önce etkisini onaylarsınız; teslim edilen ürün değişmez." />
          {canEdit && mode !== 'change' && <button type="button" className="ml-auto text-xs font-medium text-primary" onClick={() => setMode('change')}>Talep aç</button>}
        </div>
        {mode === 'change' && <ChangeForm lines={d.lines} busy={busy} onCancel={() => setMode('')} onSave={(body) => send({ action: 'change', ...body })} />}
        {d.changes.length === 0 && mode !== 'change' && <p className="text-xs text-muted-foreground">Talep yok</p>}
        <ul className="space-y-2">
          {d.changes.map((c) => <ChangeRow key={c.id} change={c} lines={d.lines} canEdit={canEdit} busy={busy} currency={d.currency} onDecide={(body) => send({ action: 'decide', changeId: c.id, ...body })} />)}
        </ul>
      </section>
    </div>
  );
}

function PromiseForm({ current, busy, onCancel, onSave }: { current: string | null; busy: boolean; onCancel: () => void; onSave: (date: string, reason: string) => void }) {
  const [date, setDate] = useState(current ?? '');
  const [reason, setReason] = useState('');
  return (
    <form className="grid gap-2 sm:grid-cols-[160px_1fr_auto]" onSubmit={(e) => { e.preventDefault(); onSave(date, reason); }}>
      <input type="date" aria-label="Söz verilen tarih" required className="rf-input" value={date} onChange={(e) => setDate(e.target.value)} />
      <input aria-label="Gerekçe" placeholder={current ? 'Gerekçe (zorunlu)' : 'Gerekçe'} required={Boolean(current)} minLength={current ? 3 : 0} className="rf-input" value={reason} onChange={(e) => setReason(e.target.value)} />
      <span className="flex gap-2"><button disabled={busy} className="rf-primary-button">Kaydet</button><button type="button" className="rf-input" onClick={onCancel}>Vazgeç</button></span>
    </form>
  );
}

function DeliveryForm({ lines, today, busy, onCancel, onSave }: { lines: Line[]; today: string; busy: boolean; onCancel: () => void; onSave: (b: { deliveredOn: string; note?: string; lines: Array<{ orderItemId: string; quantity: number }> }) => void }) {
  const open = lines.filter((l) => l.remaining > 0);
  const [qty, setQty] = useState<Record<string, number>>(Object.fromEntries(open.map((l) => [l.orderItemId, l.remaining])));
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const chosen = open.filter((l) => (qty[l.orderItemId] ?? 0) > 0);
  return (
    <form className="space-y-2 rounded-md border border-border p-3" onSubmit={(e) => { e.preventDefault(); onSave({ deliveredOn: date, note: note || undefined, lines: chosen.map((l) => ({ orderItemId: l.orderItemId, quantity: qty[l.orderItemId] })) }); }}>
      {open.map((l) => (
        <label key={l.orderItemId} className="flex items-center gap-3 text-sm">
          <span className="min-w-0 flex-1 truncate">{l.productName}</span>
          <input type="number" min={0} max={l.remaining} step="any" aria-label={`${l.productName} teslim adedi`} className="rf-input w-20 text-right" value={qty[l.orderItemId] ?? 0} onChange={(e) => setQty((p) => ({ ...p, [l.orderItemId]: Math.min(l.remaining, Math.max(0, +e.target.value)) }))} />
          <span className="w-10 text-xs text-muted-foreground">/ {l.remaining}</span>
        </label>
      ))}
      <div className="grid gap-2 sm:grid-cols-[160px_1fr_auto]">
        <input type="date" max={today} aria-label="Teslim tarihi" className="rf-input" value={date} onChange={(e) => setDate(e.target.value)} />
        <input aria-label="Not" placeholder="Not (isteğe bağlı)" className="rf-input" value={note} onChange={(e) => setNote(e.target.value)} />
        <span className="flex gap-2"><button disabled={busy || !chosen.length} className="rf-primary-button">Kaydet</button><button type="button" className="rf-input" onClick={onCancel}>Vazgeç</button></span>
      </div>
    </form>
  );
}

function PlanForm({ total, currency, today, initial, busy, onCancel, onSave }: { total: number; currency: string; today: string; initial: Row[]; busy: boolean; onCancel: () => void; onSave: (rows: Array<{ label: string; dueOn: string; amount: number }>) => void }) {
  const [rows, setRows] = useState(initial.length ? initial.map(({ label, dueOn, amount }) => ({ label, dueOn, amount })) : [{ label: 'Kapora', dueOn: today, amount: money(total * 0.3) }, { label: 'Teslimde', dueOn: today, amount: money(total - money(total * 0.3)) }]);
  const sum = money(rows.reduce((s, r) => s + (Number(r.amount) || 0), 0));
  const gap = money(total - sum);
  const set = (i: number, k: 'label' | 'dueOn' | 'amount', v: string) => setRows((p) => p.map((r, j) => (j === i ? { ...r, [k]: k === 'amount' ? Number(v) : v } : r)));
  return (
    <form className="space-y-2 rounded-md border border-border p-3" onSubmit={(e) => { e.preventDefault(); onSave(rows); }}>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_150px_130px_auto]">
          <input aria-label={`Taksit ${i + 1} adı`} required maxLength={60} className="rf-input" value={r.label} onChange={(e) => set(i, 'label', e.target.value)} />
          <input type="date" aria-label={`Taksit ${i + 1} tarihi`} required className="rf-input" value={r.dueOn} onChange={(e) => set(i, 'dueOn', e.target.value)} />
          <input type="number" step="0.01" min={0.01} aria-label={`Taksit ${i + 1} tutarı`} required className="rf-input text-right" value={r.amount} onChange={(e) => set(i, 'amount', e.target.value)} />
          <button type="button" className="rf-icon-button" aria-label={`Taksit ${i + 1} sil`} onClick={() => setRows((p) => p.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button type="button" className="inline-flex items-center gap-1 text-primary" onClick={() => setRows((p) => [...p, { label: `Taksit ${p.length + 1}`, dueOn: today, amount: Math.max(0, gap) }])}><Plus size={13} /> Taksit</button>
        <span className={cn('ml-auto tabular-nums', Math.abs(gap) > 0.009 ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground')}>
          {formatCurrency(sum, currency)} / {formatCurrency(total, currency)}{Math.abs(gap) > 0.009 ? ` · fark ${formatCurrency(gap, currency)}` : ''}
        </span>
      </div>
      <span className="flex gap-2"><button disabled={busy || Math.abs(gap) > 0.009 || !rows.length} className="rf-primary-button">Planı kaydet</button><button type="button" className="rf-input" onClick={onCancel}>Vazgeç</button>
        {initial.length > 0 && <button type="button" disabled={busy} className="rf-input ml-auto" onClick={() => onSave([])}>Planı kaldır</button>}</span>
    </form>
  );
}

function ChangeForm({ lines, busy, onCancel, onSave }: { lines: Line[]; busy: boolean; onCancel: () => void; onSave: (b: { reason: string; lines: Array<Record<string, unknown>> }) => void }) {
  const [lineId, setLineId] = useState(lines[0]?.orderItemId ?? '');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const line = lines.find((l) => l.orderItemId === lineId);
  const entries = Object.entries(fields).filter(([, v]) => v.trim() !== '');
  const change = { orderItemId: lineId, ...Object.fromEntries(entries.map(([k, v]) => [k, k === 'color' || k === 'notes' ? v : Number(v)])) };
  return (
    <form className="space-y-2 rounded-md border border-border p-3" onSubmit={(e) => { e.preventDefault(); onSave({ reason, lines: [change] }); }}>
      <select aria-label="Satır" className="rf-input w-full" value={lineId} onChange={(e) => { setLineId(e.target.value); setFields({}); }}>
        {lines.map((l) => <option key={l.orderItemId} value={l.orderItemId}>{l.productName}{l.workOrders ? ' · iş emri var' : ''}</option>)}
      </select>
      {line && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {([['quantity', line.quantity], ['widthMm', line.widthMm], ['heightMm', line.heightMm], ['color', line.color], ['unitPrice', line.unitPrice]] as const).map(([k, now]) => (
            <label key={k} className="text-[11px] text-muted-foreground">{FIELD[k]}
              <input className="rf-input mt-1 w-full text-sm text-foreground" inputMode={k === 'color' ? 'text' : 'decimal'} placeholder={now == null ? '—' : String(now)} value={fields[k] ?? ''} onChange={(e) => setFields((p) => ({ ...p, [k]: e.target.value }))} />
            </label>
          ))}
        </div>
      )}
      <input aria-label="Gerekçe" required minLength={3} placeholder="Gerekçe (zorunlu)" className="rf-input w-full" value={reason} onChange={(e) => setReason(e.target.value)} />
      <span className="flex gap-2"><button disabled={busy || !entries.length} className="rf-primary-button">Talebi aç</button><button type="button" className="rf-input" onClick={onCancel}>Vazgeç</button></span>
    </form>
  );
}

function ChangeRow({ change: c, lines, canEdit, busy, currency, onDecide }: { change: Change; lines: Line[]; canEdit: boolean; busy: boolean; currency: string; onDecide: (b: Record<string, unknown>) => Promise<boolean> | void }) {
  const [ack, setAck] = useState(false);
  const tone = c.status === 'applied' ? 'success' : c.status === 'rejected' ? 'muted' : c.impact.level === 'warn' ? 'warning' : 'info';
  const label = c.status === 'applied' ? 'Uygulandı' : c.status === 'rejected' ? 'Reddedildi' : c.impact.level === 'warn' ? 'Üretim etkisi' : 'Bekliyor';
  return (
    <li className="space-y-2 rounded-md border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip tone={tone} label={label} />
        <span className="min-w-0 flex-1 truncate">{c.reason}</span>
        <span className="text-xs text-muted-foreground">{c.by ?? ''} · {new Date(c.at).toLocaleDateString('tr-TR')}</span>
      </div>
      <ul className="space-y-0.5 text-xs">
        {c.changes.map((ch, i) => {
          const line = lines.find((l) => l.orderItemId === ch.orderItemId);
          return (
            <li key={i}>
              <span className="font-medium">{line?.productName ?? 'Satır'}</span>{' '}
              {Object.entries(ch).filter(([k]) => k !== 'orderItemId').map(([k, v]) => `${FIELD[k] ?? k} → ${k === 'unitPrice' ? formatCurrency(Number(v), currency) : String(v)}`).join(' · ')}
            </li>
          );
        })}
      </ul>
      {c.impact.reasons.length > 0 && <ul className="list-disc space-y-0.5 pl-5 text-xs text-amber-800 dark:text-amber-300">{c.impact.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
      {c.status === 'pending' && canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          {c.impact.level === 'warn' && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> Üretim etkisini gördüm</label>}
          <button type="button" disabled={busy || (c.impact.level === 'warn' && !ack)} className="rf-primary-button ml-auto" onClick={() => onDecide({ decision: 'apply', acknowledgeImpact: ack })}>Uygula</button>
          <button type="button" disabled={busy} className="rf-input" onClick={() => onDecide({ decision: 'reject' })}>Reddet</button>
        </div>
      )}
    </li>
  );
}
