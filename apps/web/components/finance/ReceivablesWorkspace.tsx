'use client';

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlarmClock, FileText, HandCoins, Wallet } from 'lucide-react';
import { BarMini, EmptyState, PageHeader, Skeleton, StatusChip } from '@/components/kit';
import { requestJson } from '@/lib/shared/network';
import { formatCurrency } from '@/lib/shared/utils';
import { AGING_BUCKETS, AGING_LABELS, type AgingBucket } from '@/lib/features/finance/engine';

type Aging = Record<AgingBucket, number> & { total: number; overdue: number };
type Customer = {
  key: string; name: string; invoiceTotal: number; collected: number; balance: number; advance: number; aging: Aging;
  overdue: Array<{ id: string; number: string; dueOn: string; daysOverdue: number; openAmount: number; orderId: string; orderNumber: string }>;
};
type Data = { today: string; totals: { balance: number; overdueAmount: number; advance: number; aging: Record<AgingBucket, number> }; customers: Customer[] };
const tl = (n: number) => formatCurrency(n, 'TRY');
const dmy = (d: string) => d.split('-').reverse().join('.');

/** Receivables: open balance per customer with aging, the overdue invoices, links to each statement. */
export function ReceivablesWorkspace() {
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { void requestJson<Data>('/api/v1/finance/receivables', { cache: 'no-store' }).then((r) => (r.ok && r.data ? setD(r.data) : setError(r.error || 'Alacaklar alınamadı'))); }, []);
  if (!d) return error ? <p role="alert" className="rf-panel text-sm">{error}</p> : <Skeleton className="h-64" />;
  const from = `${d.today.slice(0, 4)}-01-01`;
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Finans" title="Alacaklar" hint="Kesilmiş faturalar ve tahsilatlar (TL). Tahsilatlar müşterinin en eski vadeli faturasını kapatır. Vadesi geçen her fatura için siparişe bir kez 'müşteriyi ara' etkinliği açılır ve finans ekibine bildirim gider."
        kpis={[{ label: 'açık bakiye', value: tl(d.totals.balance), icon: Wallet }, { label: 'vadesi geçen', value: tl(d.totals.overdueAmount), icon: AlarmClock, tone: d.totals.overdueAmount > 0 ? 'danger' : 'neutral' }, { label: 'avans', value: tl(d.totals.advance), icon: HandCoins }]}
        action={<Link href="/finance/invoices" className="rf-secondary-button inline-flex items-center gap-1 text-sm"><FileText size={14} aria-hidden /> Faturalar</Link>} />
      <section className="rf-panel p-3" aria-label="Yaşlandırma">
        <h2 className="rf-section-title mb-2">Yaşlandırma</h2>
        <BarMini items={AGING_BUCKETS.map((k) => ({ key: k, label: AGING_LABELS[k], value: Math.round(d.totals.aging[k]), tone: k === 'notDue' ? 'muted' : k === 'd0_30' ? 'primary' : 'danger' }))} />
      </section>
      {d.customers.length === 0 ? <EmptyState title="Kesilmiş fatura ya da tahsilat yok" icon={Wallet} /> : (
        <div className="overflow-x-auto rf-panel">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground"><th className="p-2">Müşteri</th>{AGING_BUCKETS.map((k) => <th key={k} className="p-2 text-right">{AGING_LABELS[k]}</th>)}<th className="p-2 text-right">Açık bakiye</th><th className="p-2" /></tr></thead>
            <tbody>
              {d.customers.map((c) => (
                <Fragment key={c.key}>
                  <tr className="border-t border-border">
                    <td className="p-2"><button type="button" className="text-left font-medium hover:underline" aria-expanded={open === c.key} onClick={() => setOpen(open === c.key ? null : c.key)}>{c.name}</button>
                      {c.advance > 0 && <StatusChip tone="info" label={`avans ${tl(c.advance)}`} className="ml-1" />}</td>
                    {AGING_BUCKETS.map((k) => <td key={k} className={`p-2 text-right tabular-nums ${k !== 'notDue' && c.aging[k] > 0 ? 'text-rose-700 dark:text-rose-300' : ''}`}>{c.aging[k] ? tl(c.aging[k]) : '—'}</td>)}
                    <td className="p-2 text-right font-semibold tabular-nums">{tl(c.aging.total)}</td>
                    <td className="p-2 text-right"><Link className="text-xs text-primary hover:underline" href={`/finance/statement?customer=${encodeURIComponent(c.key)}&from=${from}&to=${d.today}`}>Ekstre</Link></td>
                  </tr>
                  {open === c.key && (
                    <tr><td colSpan={7} className="bg-muted/40 p-2 text-xs">
                      Faturalanan {tl(c.invoiceTotal)} · tahsil edilen {tl(c.collected)}
                      {c.overdue.length ? <ul className="mt-1 space-y-0.5">{c.overdue.map((o) => <li key={o.id}><Link href={`/orders/${o.orderId}`} className="font-mono hover:underline">{o.number}</Link> · {o.orderNumber} · vade {dmy(o.dueOn)} · {o.daysOverdue} gün gecikti · açık {tl(o.openAmount)}</li>)}</ul> : <p className="mt-1">Vadesi geçen fatura yok.</p>}
                    </td></tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
