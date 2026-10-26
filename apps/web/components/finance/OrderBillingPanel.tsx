'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FilePlus2, Printer, Receipt, TrendingUp, Wallet } from 'lucide-react';
import { HintTip, Skeleton, StatusChip, useConfirm, type Tone } from '@/components/kit';
import { requestJson } from '@/lib/shared/network';
import { formatCurrency } from '@/lib/shared/utils';
import { COLLECTION_METHODS, COLLECTION_METHOD_LABELS, INVOICE_STATUS_LABELS, type InvoiceStatus } from '@/lib/features/finance/engine';

type Line = { id: string; description: string; quantity: number; unitPrice: number; invoiced: number; remaining: number };
type Invoice = { id: string; number: string | null; status: InvoiceStatus; issuedOn: string | null; dueOn: string | null; subtotal: number; vatTotal: number; grandTotal: number; eInvoice: string; cancelReason: string | null; lines: Array<{ id: string; description: string; quantity: number }> };
type Payment = { id: string; amount: number; method: string; paidAt: string; reference: string | null; chequeDueOn: string | null; invoiceNumber: string | null };
type Profit = { revenueNet: number; materialCost: number; laborCost: number | null; reworkCost: number; cost: number; profit: number | null; marginPercent: number | null; complete: boolean; upperBound: boolean; gaps: string[] };
type Billing = {
  order: { id: string; number: string; customerName: string; total: number; currency: string }; vatPercent: number; headerDiscount: number; lines: Line[]; invoices: Invoice[]; payments: Payment[];
  summary: { invoiceTotal: number; collected: number; balance: number }; estimatedProfit?: Profit;
};

export const INVOICE_TONE: Record<InvoiceStatus, Tone> = { draft: 'muted', issued: 'success', cancelled: 'danger' };
const send = (url: string, body: unknown, method = 'POST') => requestJson<any>(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date());
const dmy = (d: string | null) => (d ? d.split('-').reverse().join('.') : '—');

/** The order's invoices and collections (finance roles only): partial invoice drafts, issue, cancel, collect, estimated profit. */
export function OrderBillingPanel({ orderId }: { orderId: string }) {
  const [b, setB] = useState<Billing | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [qty, setQty] = useState<Record<string, string>>({});
  const [extra, setExtra] = useState({ description: '', amount: '' });
  const [pay, setPay] = useState({ amount: '', method: 'bank_transfer', paidOn: today(), reference: '', chequeDueOn: '', invoiceId: '' });
  const [confirm, confirmDialog] = useConfirm();
  const load = useCallback(async () => {
    const r = await requestJson<Billing>(`/api/v1/finance/orders/${orderId}`, { cache: 'no-store' });
    if (r.ok && r.data) { setB(r.data); setQty(Object.fromEntries(r.data.lines.map((l) => [l.id, l.remaining ? String(l.remaining) : '']))); }
    else setError(r.error || 'Fatura bilgisi alınamadı');
  }, [orderId]);
  useEffect(() => { void load(); }, [load]);
  if (!b) return error ? <p role="alert" className="rf-panel text-sm">{error}</p> : <Skeleton className="h-48" />;
  const cur = (n: number) => formatCurrency(n, b.order.currency);

  async function act(p: Promise<{ ok: boolean; error?: string | null }>, done: string) {
    setError(''); setNotice('');
    const r = await p;
    if (!r.ok) { setError(r.error || 'İşlem yapılamadı'); return false; }
    setNotice(done); await load(); return true;
  }
  async function draft(e: React.FormEvent) {
    e.preventDefault();
    const lines = b!.lines.filter((l) => Number(qty[l.id]) > 0).map((l) => ({ orderItemId: l.id, quantity: Number(qty[l.id]) }));
    const ex = extra.description.trim() && Number(extra.amount) > 0 ? [{ description: extra.description.trim(), quantity: 1, unitPrice: Number(extra.amount) }] : [];
    if (await act(send('/api/v1/invoices', { orderId, lines, extra: ex }), 'Taslak fatura oluşturuldu')) setExtra({ description: '', amount: '' });
  }
  async function collect(e: React.FormEvent) {
    e.preventDefault();
    const body = { orderId, amount: Number(pay.amount), method: pay.method, paidOn: pay.paidOn, reference: pay.reference || null, chequeDueOn: pay.method === 'check' ? pay.chequeDueOn || null : null, invoiceId: pay.invoiceId || null };
    if (await act(send('/api/v1/finance/collections', body), 'Tahsilat kaydedildi')) setPay({ ...pay, amount: '', reference: '', chequeDueOn: '' });
  }
  function cancel(id: string) {
    const reason = window.prompt('İptal gerekçesi');
    if (reason && reason.trim().length >= 3) void act(send(`/api/v1/invoices/${id}`, { action: 'cancel', reason: reason.trim() }), 'Fatura iptal edildi');
  }
  const open = b.lines.some((l) => l.remaining > 0);
  const issued = b.invoices.filter((i) => i.status === 'issued');
  const p = b.estimatedProfit;

  return (
    <div className="space-y-4">
      {confirmDialog}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[['Faturalanan', b.summary.invoiceTotal], ['Tahsil edilen', b.summary.collected], ['Siparişte kalan', b.summary.balance]].map(([label, v]) => (
          <div key={label as string} className="rf-panel p-2"><p className="text-[11px] text-muted-foreground">{label}</p><p className="font-semibold tabular-nums">{cur(v as number)}</p></div>
        ))}
      </div>
      {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
      {notice && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}

      <section className="rf-panel space-y-2 p-3" aria-labelledby="bill-draft">
        <h3 id="bill-draft" className="flex items-center gap-2 text-sm font-semibold"><FilePlus2 size={14} aria-hidden /> Faturalanacak kalemler <HintTip text={`Kalemin bir kısmı faturalanabilir (kısmi fatura). Taslaklar da miktarı ayırır; aynı kalem iki kez faturalanamaz. KDV %${b.vatPercent} (tekliften).${b.headerDiscount ? ` Teklifteki genel iskonto (%${b.headerDiscount}) birim fiyatlara yansıtıldı.` : ''}`} /></h3>
        <form onSubmit={draft} className="space-y-2">
          {b.lines.length === 0 ? <p className="text-xs text-muted-foreground">Siparişte kalem yok; serbest satırla fatura açılabilir.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1">Kalem</th><th className="text-right">Sipariş</th><th className="text-right">Faturalanan</th><th className="text-right">Bu fatura</th></tr></thead>
                <tbody>
                  {b.lines.map((l) => (
                    <tr key={l.id} className="border-t border-border">
                      <td className="py-1 pr-2">{l.description}<span className="block text-[11px] text-muted-foreground">{cur(l.unitPrice)} / adet</span></td>
                      <td className="text-right tabular-nums">{l.quantity}</td>
                      <td className="text-right tabular-nums">{l.invoiced}</td>
                      <td className="text-right"><input aria-label={`${l.description} faturalanacak miktar`} type="number" min={0} max={l.remaining} step="any" disabled={!l.remaining} className="rf-input w-20 text-right" value={qty[l.id] ?? ''} onChange={(e) => setQty({ ...qty, [l.id]: e.target.value })} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs">Serbest satır (ör. nakliye)<input className="rf-input mt-1 w-48" value={extra.description} onChange={(e) => setExtra({ ...extra, description: e.target.value })} /></label>
              <label className="text-xs">Net tutar<input type="number" min={0} step="0.01" className="rf-input mt-1 w-28" value={extra.amount} onChange={(e) => setExtra({ ...extra, amount: e.target.value })} /></label>
              <button type="submit" className="rf-primary-button text-sm" disabled={!open && !extra.description}>Taslak fatura oluştur</button>
            </div>
        </form>
      </section>

      <section className="space-y-2" aria-labelledby="bill-invoices">
        <h3 id="bill-invoices" className="flex items-center gap-2 text-sm font-semibold"><Receipt size={14} aria-hidden /> Faturalar</h3>
        {b.invoices.length === 0 ? <p className="text-xs text-muted-foreground">Henüz fatura yok.</p> : (
          <ul className="space-y-2">
            {b.invoices.map((i) => (
              <li key={i.id} className="rf-panel flex flex-wrap items-center gap-2 p-2 text-sm">
                <span className="font-mono font-semibold">{i.number ?? 'Taslak'}</span>
                <StatusChip tone={INVOICE_TONE[i.status]} label={INVOICE_STATUS_LABELS[i.status]} />

                <span className="tabular-nums">{cur(i.grandTotal)}</span>
                {i.dueOn && <span className="text-xs text-muted-foreground">vade {dmy(i.dueOn)}</span>}
                {i.cancelReason && <span className="text-xs text-muted-foreground">({i.cancelReason})</span>}
                <span className="ml-auto flex flex-wrap gap-1">
                  {i.status === 'draft' && <button type="button" className="rf-primary-button text-xs" onClick={() => void act(send(`/api/v1/invoices/${i.id}`, { action: 'issue' }), 'Fatura kesildi')}>Kes</button>}
                  {i.status === 'draft' && <button type="button" className="rf-secondary-button text-xs" onClick={async () => { if (await confirm({ title: 'Taslak fatura silinsin mi?', description: 'Bu işlem geri alınamaz.', confirmLabel: 'Taslağı sil' })) void act(requestJson(`/api/v1/invoices/${i.id}`, { method: 'DELETE' }), 'Taslak silindi'); }}>Sil</button>}
                  {i.status === 'issued' && <button type="button" className="rf-secondary-button text-xs" onClick={() => cancel(i.id)}>İptal</button>}
                  <Link href={`/finance/invoices/${i.id}`} className="rf-secondary-button inline-flex items-center gap-1 text-xs"><Printer size={12} aria-hidden /> Görüntüle</Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rf-panel space-y-2 p-3" aria-labelledby="bill-collect">
        <h3 id="bill-collect" className="flex items-center gap-2 text-sm font-semibold"><Wallet size={14} aria-hidden /> Tahsilat</h3>
        <form onSubmit={collect} className="grid gap-2 sm:grid-cols-3" aria-label="Tahsilat ekle">
          <label className="text-xs">Tutar<input type="number" min={0.01} step="0.01" required className="rf-input mt-1 w-full" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></label>
          <label className="text-xs">Yöntem<select className="rf-input mt-1 w-full" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>{COLLECTION_METHODS.map((m) => <option key={m} value={m}>{COLLECTION_METHOD_LABELS[m]}</option>)}</select></label>
          <label className="text-xs">Tarih<input type="date" required className="rf-input mt-1 w-full" value={pay.paidOn} onChange={(e) => setPay({ ...pay, paidOn: e.target.value })} /></label>
          <label className="text-xs">{pay.method === 'check' ? 'Çek no' : 'Referans / dekont'}<input className="rf-input mt-1 w-full" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} /></label>
          {pay.method === 'check' && <label className="text-xs">Çek vadesi<input type="date" required className="rf-input mt-1 w-full" value={pay.chequeDueOn} onChange={(e) => setPay({ ...pay, chequeDueOn: e.target.value })} /></label>}
          <label className="text-xs">Fatura (isteğe bağlı)<select className="rf-input mt-1 w-full" value={pay.invoiceId} onChange={(e) => setPay({ ...pay, invoiceId: e.target.value })}><option value="">—</option>{issued.map((i) => <option key={i.id} value={i.id}>{i.number}</option>)}</select></label>
          <div className="sm:col-span-3"><button type="submit" className="rf-primary-button text-sm">Tahsilatı kaydet</button></div>
        </form>
        {b.payments.length > 0 && (
          <ul className="divide-y divide-border text-sm" aria-label="Tahsilatlar">
            {b.payments.map((x) => (
              <li key={x.id} className="flex flex-wrap gap-2 py-1">
                <span className="tabular-nums font-medium">{cur(x.amount)}</span>
                <span>{COLLECTION_METHOD_LABELS[x.method] ?? x.method}</span>
                <span className="text-xs text-muted-foreground">{new Intl.DateTimeFormat('tr-TR').format(new Date(x.paidAt))}{x.reference ? ` · ${x.reference}` : ''}{x.chequeDueOn ? ` · çek vadesi ${dmy(x.chequeDueOn)}` : ''}{x.invoiceNumber ? ` · ${x.invoiceNumber}` : ''}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {p && (
        <section className="rf-panel space-y-2 p-3" aria-labelledby="bill-profit">
          <h3 id="bill-profit" className="flex items-center gap-2 text-sm font-semibold"><TrendingUp size={14} aria-hidden /> Tahmini kâr <StatusChip tone={p.complete ? 'success' : 'warning'} label={p.complete ? 'Veri tam' : 'Eksik veri'} />
            <HintTip text="Gelir: sipariş kalemleri (KDV hariç). Maliyet: iş emrine çıkılan malzeme lotları, üretim süresi × saatlik işçilik, yeniden işleme. Bilinmeyen kalem tahmin edilmez, aşağıda listelenir." /></h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
            <dt className="text-muted-foreground">Gelir (net)</dt><dd className="tabular-nums sm:col-span-2">{cur(p.revenueNet)}</dd>
            <dt className="text-muted-foreground">Malzeme</dt><dd className="tabular-nums sm:col-span-2">{cur(p.materialCost)}</dd>
            <dt className="text-muted-foreground">İşçilik</dt><dd className="tabular-nums sm:col-span-2">{p.laborCost === null ? 'bilinmiyor' : cur(p.laborCost)}</dd>
            <dt className="text-muted-foreground">Yeniden işleme</dt><dd className="tabular-nums sm:col-span-2">{cur(p.reworkCost)}</dd>
            <dt className="font-semibold">{p.upperBound ? 'Kâr (en fazla)' : 'Kâr'}</dt><dd className="font-semibold tabular-nums sm:col-span-2">{p.profit === null ? 'hesaplanamadı (maliyet kaydı yok)' : `${cur(p.profit)}${p.marginPercent !== null ? ` · %${p.marginPercent.toLocaleString('tr-TR')}` : ''}`}</dd>
          </dl>
          {p.gaps.length > 0 && <ul className="list-disc pl-5 text-xs text-muted-foreground" aria-label="Eksik veriler">{p.gaps.map((g) => <li key={g}>{g}</li>)}</ul>}
        </section>
      )}
    </div>
  );
}
