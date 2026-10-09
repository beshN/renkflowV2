'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, FileText, Printer } from 'lucide-react';
import { EmptyState, PageHeader, Skeleton, StatusChip } from '@/components/kit';
import { requestJson } from '@/lib/shared/network';
import { formatCurrency } from '@/lib/shared/utils';
import { INVOICE_STATUS_LABELS, type InvoiceStatus } from '@/lib/features/finance/engine';
import { INVOICE_TONE } from './OrderBillingPanel';

type Row = { id: string; number: string | null; status: InvoiceStatus; orderId: string; orderNumber: string | null; customerName: string; issuedOn: string | null; dueOn: string | null; currency: string; grandTotal: number };
const dmy = (d: string | null) => (d ? d.split('-').reverse().join('.') : '—');

/** All invoices of the firm, by status. */
export function InvoicesWorkspace() {
  const [status, setStatus] = useState<'' | InvoiceStatus>('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    setRows(null);
    void requestJson<{ invoices: Row[] }>(`/api/v1/invoices${status ? `?status=${status}` : ''}`, { cache: 'no-store' }).then((r) => {
      if (current) { if (r.ok && r.data) setRows(r.data.invoices); else setError(r.error || 'Faturalar alınamadı'); }
    });
    return () => { current = false; };
  }, [status]);
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Finans" title="Faturalar" hint="Faturalar siparişin 'Fatura & tahsilat' sekmesinden taslak olarak açılır, kesilince numara alır. e-fatura/e-arşiv entegrasyonu bağlanmadı: buradaki belgeler GİB'e gönderilmez."
        action={<Link href="/finance/receivables" className="rf-secondary-button text-sm">Alacaklar</Link>} />
      <div className="flex flex-wrap gap-1" role="group" aria-label="Durum">
        {(['', 'draft', 'issued', 'cancelled'] as const).map((s) => (
          <button key={s || 'all'} type="button" aria-pressed={status === s} className={status === s ? 'rf-primary-button text-xs' : 'rf-secondary-button text-xs'} onClick={() => setStatus(s)}>{s ? INVOICE_STATUS_LABELS[s] : 'Tümü'}</button>
        ))}
      </div>
      {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
      {!rows ? <Skeleton className="h-40" /> : rows.length === 0 ? <EmptyState title="Fatura yok" icon={FileText} /> : (
        <div className="rf-panel overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground"><th className="p-2">No</th><th className="p-2">Müşteri</th><th className="p-2">Sipariş</th><th className="p-2">Tarih</th><th className="p-2">Vade</th><th className="p-2 text-right">Tutar</th><th className="p-2">Durum</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-2 font-mono"><Link href={`/finance/invoices/${r.id}`} className="hover:underline">{r.number ?? 'Taslak'}</Link></td>
                  <td className="p-2">{r.customerName}</td>
                  <td className="p-2"><Link href={`/orders/${r.orderId}`} className="hover:underline">{r.orderNumber}</Link></td>
                  <td className="p-2">{dmy(r.issuedOn)}</td><td className="p-2">{dmy(r.dueOn)}</td>
                  <td className="p-2 text-right tabular-nums">{formatCurrency(r.grandTotal, r.currency)}</td>
                  <td className="p-2"><StatusChip tone={INVOICE_TONE[r.status]} label={INVOICE_STATUS_LABELS[r.status]} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

type Doc = Row & {
  seller: string | null; taxNumber: string | null; taxOffice: string | null; address: string | null; notes: string | null; subtotal: number; vatTotal: number; cancelReason: string | null;
  lines: Array<{ id: string; description: string; quantity: number; unitPrice: number; vatPercent: number; netAmount: number; vatAmount: number }>;
};

/** One invoice as a printable page; clearly not an e-invoice. */
export function InvoiceDocument({ id }: { id: string }) {
  const [d, setD] = useState<Doc | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { void requestJson<Doc>(`/api/v1/invoices/${id}`, { cache: 'no-store' }).then((r) => (r.ok && r.data ? setD(r.data) : setError(r.error || 'Fatura alınamadı'))); }, [id]);
  if (!d) return error ? <p role="alert" className="rf-panel text-sm">{error}</p> : <Skeleton className="h-64" />;
  const cur = (n: number) => formatCurrency(n, d.currency);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Link href={`/orders/${d.orderId}`} className="rf-secondary-button inline-flex items-center gap-1 text-sm"><ArrowLeft size={14} aria-hidden /> Sipariş</Link>
        <button type="button" className="rf-primary-button inline-flex items-center gap-1 text-sm" onClick={() => window.print()}><Printer size={14} aria-hidden /> Yazdır</button>
      </div>
      <article className="rf-panel mx-auto max-w-3xl space-y-4 p-5 print:border-0 print:shadow-none" aria-label="Fatura">
        <p role="note" className="rounded-md border border-border bg-muted px-3 py-2 text-xs">Bu belge firma içi fatura kaydıdır; e-fatura/e-arşiv değildir. GİB entegrasyonu bağlanmadı.</p>
        <header className="flex flex-wrap justify-between gap-4">
          <div><p className="text-xs text-muted-foreground">Satıcı</p><p className="font-semibold">{d.seller ?? '—'}</p></div>
          <div className="text-right">
            <p className="text-lg font-bold">{d.status === 'draft' ? 'TASLAK FATURA' : 'FATURA'} <span className="font-mono">{d.number ?? ''}</span></p>
            <StatusChip tone={INVOICE_TONE[d.status]} label={INVOICE_STATUS_LABELS[d.status]} />
            <p className="text-xs">Tarih {dmy(d.issuedOn)} · Vade {dmy(d.dueOn)} · Sipariş {d.orderNumber}</p>
          </div>
        </header>
        <section><p className="text-xs text-muted-foreground">Alıcı</p><p className="font-medium">{d.customerName}</p>
          {(d.taxOffice || d.taxNumber) && <p className="text-xs">{[d.taxOffice, d.taxNumber].filter(Boolean).join(' · ')}</p>}
          {d.address && <p className="text-xs">{d.address}</p>}</section>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="py-1">Açıklama</th><th className="text-right">Miktar</th><th className="text-right">Birim fiyat</th><th className="text-right">KDV</th><th className="text-right">Tutar</th></tr></thead>
          <tbody>{d.lines.map((l) => <tr key={l.id} className="border-b border-border"><td className="py-1 pr-2">{l.description}</td><td className="text-right tabular-nums">{l.quantity.toLocaleString('tr-TR')}</td><td className="text-right tabular-nums">{cur(l.unitPrice)}</td><td className="text-right">%{l.vatPercent}</td><td className="text-right tabular-nums">{cur(l.netAmount)}</td></tr>)}</tbody>
        </table>
        <dl className="ml-auto grid w-64 grid-cols-2 gap-1 text-sm">
          <dt>Ara toplam</dt><dd className="text-right tabular-nums">{cur(d.subtotal)}</dd>
          <dt>KDV</dt><dd className="text-right tabular-nums">{cur(d.vatTotal)}</dd>
          <dt className="font-semibold">Genel toplam</dt><dd className="text-right font-semibold tabular-nums">{cur(d.grandTotal)}</dd>
        </dl>
        {d.notes && <p className="text-xs">{d.notes}</p>}
        {d.cancelReason && <p className="text-xs text-rose-700 dark:text-rose-300">İptal: {d.cancelReason}</p>}
      </article>
    </div>
  );
}

type Statement = {
  customer: { name: string }; seller: string | null; from: string; to: string; openingBalance: number; closingBalance: number; debit: number; credit: number;
  lines: Array<{ on: string; kind: string; ref: string; text: string; debit: number; credit: number; balance: number }>;
};

/** Customer statement (ekstre) for a period; printable. */
export function StatementView() {
  const q = useSearchParams();
  const key = q.get('customer') ?? '';
  const [from, setFrom] = useState(q.get('from') ?? `${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(q.get('to') ?? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date()));
  const [s, setS] = useState<Statement | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    setS(null); setError('');
    void requestJson<Statement>(`/api/v1/finance/statement?customer=${encodeURIComponent(key)}&from=${from}&to=${to}`, { cache: 'no-store' }).then((r) => {
      if (current) { if (r.ok && r.data) setS(r.data); else setError(r.error || 'Ekstre alınamadı'); }
    });
    return () => { current = false; };
  }, [key, from, to]);
  const tl = (n: number) => formatCurrency(n, 'TRY');
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2 print:hidden">
        <Link href="/finance/receivables" className="rf-secondary-button inline-flex items-center gap-1 text-sm"><ArrowLeft size={14} aria-hidden /> Alacaklar</Link>
        <label className="text-xs">Başlangıç<input type="date" className="rf-input mt-1" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-xs">Bitiş<input type="date" className="rf-input mt-1" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <button type="button" className="rf-primary-button inline-flex items-center gap-1 text-sm" onClick={() => window.print()}><Printer size={14} aria-hidden /> Yazdır</button>
      </div>
      {error && <p role="alert" className="rf-panel text-sm">{error}</p>}
      {!s ? (!error && <Skeleton className="h-48" />) : (
        <article className="rf-panel mx-auto max-w-3xl space-y-3 p-5 print:border-0" aria-label="Cari hesap ekstresi">
          <header className="flex flex-wrap justify-between gap-2">
            <div><p className="text-xs text-muted-foreground">{s.seller}</p><h1 className="text-lg font-bold">Cari hesap ekstresi</h1><p className="font-medium">{s.customer.name}</p></div>
            <p className="text-sm">{dmy(s.from)} – {dmy(s.to)}</p>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="py-1">Tarih</th><th>Belge</th><th>Açıklama</th><th className="text-right">Borç</th><th className="text-right">Alacak</th><th className="text-right">Bakiye</th></tr></thead>
              <tbody>
                <tr className="border-b border-border"><td className="py-1" colSpan={5}>Devreden bakiye</td><td className="text-right tabular-nums">{tl(s.openingBalance)}</td></tr>
                {s.lines.map((l, i) => (
                  <tr key={i} className="border-b border-border"><td className="py-1">{dmy(l.on)}</td><td className="font-mono text-xs">{l.ref}</td><td className="text-xs">{l.text}</td>
                    <td className="text-right tabular-nums">{l.debit ? tl(l.debit) : ''}</td><td className="text-right tabular-nums">{l.credit ? tl(l.credit) : ''}</td><td className="text-right tabular-nums">{tl(l.balance)}</td></tr>
                ))}
              </tbody>
              <tfoot><tr className="font-semibold"><td className="py-1" colSpan={3}>Dönem toplamı / kapanış</td><td className="text-right tabular-nums">{tl(s.debit)}</td><td className="text-right tabular-nums">{tl(s.credit)}</td><td className="text-right tabular-nums">{tl(s.closingBalance)}</td></tr></tfoot>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">Pozitif bakiye müşterinin borcudur; negatif bakiye avanstır. İptal edilen faturalar ekstrede yer almaz.</p>
        </article>
      )}
    </div>
  );
}
