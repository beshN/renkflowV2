'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { EmptyState, Skeleton, StatusChip } from '@/components/kit';
import { getLedgerView, syncLedgerNow, type LedgerEntryView } from '@/app/actions/accounting.actions';
import { formatCurrency } from '@/lib/shared/utils';

type View = Awaited<ReturnType<typeof getLedgerView>>;
const tl = (n: number) => (n ? formatCurrency(n, 'TRY') : '—');
const dmy = (d: string) => d.split('-').reverse().join('.');
const TYPE_LABELS: Record<string, string> = { invoice: 'Satış', payment: 'Tahsilat', adjustment: 'Düzeltme', expense: 'Gider', salary: 'Maaş', opening: 'Açılış', closing: 'Kapanış', transfer: 'Virman' };

/** The period's trial balance (mizan) and journal (yevmiye), booked automatically from invoices and collections. */
export function LedgerPanel({ period }: { period: string }) {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setView(await getLedgerView(period));
      setError('');
    } catch {
      setError('Yevmiye alınamadı');
    }
  }, [period]);
  useEffect(() => { setView(null); void load(); }, [load]);

  async function sync() {
    setBusy(true);
    try {
      const r = await syncLedgerNow();
      const parts = [`${r.posted} kayıt işlendi`];
      if (r.awaitingRate) parts.push(`${r.awaitingRate} dövizli fatura kur bekliyor`);
      if (r.skippedClosed) parts.push(`${r.skippedClosed} kayıt kapalı dönemde`);
      if (r.failed) parts.push(`${r.failed} kayıt işlenemedi`);
      setNote(parts.join(' · '));
      await load();
    } catch {
      setError('Kayıtlar işlenemedi');
    } finally {
      setBusy(false);
    }
  }

  if (!view) return error ? <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p> : <Skeleton className="h-48" />;
  const tb = view.trialBalance;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-xs text-muted-foreground">Kesilen faturalar ve tahsilatlar Tekdüzen hesap planına otomatik işlenir (120 / 600 / 391, kasa ve banka). İptal ve silinen tahsilat ters kayıtla kapanır; kayıtlar değiştirilmez.</p>
        <button type="button" className="rf-secondary-button inline-flex items-center gap-1 text-xs" onClick={() => void sync()} disabled={busy}><RefreshCw size={12} aria-hidden /> Eksik kayıtları işle</button>
      </div>
      {note && <p role="status" className="text-xs">{note}</p>}
      {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}

      <section aria-labelledby="mizan-title" className="rf-panel overflow-x-auto p-4">
        <div className="mb-2 flex items-center gap-2">
          <h2 id="mizan-title" className="rf-section-title">Mizan · {period}</h2>
          <StatusChip tone={tb.isBalanced ? 'success' : 'danger'} label={tb.isBalanced ? 'Dengeli' : 'Dengesiz'} />
        </div>
        {tb.rows.length === 0 ? <EmptyState title="Bu dönemde kayıt yok" /> : (
          <table className="w-full min-w-[520px] text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground"><th className="p-2">Hesap</th><th className="p-2 text-right">Borç</th><th className="p-2 text-right">Alacak</th><th className="p-2 text-right">Bakiye</th></tr></thead>
            <tbody>
              {tb.rows.map((r) => (
                <tr key={r.accountId} className="border-t border-border">
                  <td className="p-2"><span className="font-mono">{r.accountCode}</span> {r.accountName}</td>
                  <td className="p-2 text-right tabular-nums">{tl(r.totalDebit)}</td>
                  <td className="p-2 text-right tabular-nums">{tl(r.totalCredit)}</td>
                  <td className="p-2 text-right tabular-nums">{r.balance === 0 ? '—' : `${formatCurrency(Math.abs(r.balance), 'TRY')} ${r.balance > 0 ? 'B' : 'A'}`}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-border font-semibold"><td className="p-2">Toplam</td><td className="p-2 text-right tabular-nums">{tl(tb.totalDebit)}</td><td className="p-2 text-right tabular-nums">{tl(tb.totalCredit)}</td><td /></tr>
            </tbody>
          </table>
        )}
      </section>

      <section aria-labelledby="yevmiye-title" className="rf-panel p-4">
        <h2 id="yevmiye-title" className="rf-section-title mb-2">Yevmiye · {view.entries.length} kayıt</h2>
        {view.entries.length === 0 ? <EmptyState title="Bu dönemde yevmiye kaydı yok" /> : (
          <ul className="divide-y divide-border text-sm">
            {view.entries.map((e: LedgerEntryView) => (
              <li key={e.id} className="py-2">
                <button type="button" className="flex w-full flex-wrap items-center gap-2 text-left" aria-expanded={open === e.id} onClick={() => setOpen(open === e.id ? null : e.id)}>
                  <span className="w-20 tabular-nums text-muted-foreground">{dmy(e.date)}</span>
                  <span className="font-mono text-xs">{e.number}</span>
                  <StatusChip tone="neutral" label={TYPE_LABELS[e.type] ?? e.type} />
                  <span className="flex-1">{e.description}</span>
                  <span className="tabular-nums">{formatCurrency(e.total, 'TRY')}</span>
                </button>
                {open === e.id && (
                  <table className="mt-2 w-full text-xs">
                    <tbody>
                      {e.lines.map((l, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="py-1 pr-2"><span className="font-mono">{l.code}</span> {l.name}</td>
                          <td className="py-1 pr-2 text-muted-foreground">{l.description}</td>
                          <td className="py-1 text-right tabular-nums">{l.debit ? formatCurrency(l.debit, 'TRY') : ''}</td>
                          <td className="py-1 text-right tabular-nums">{l.credit ? formatCurrency(l.credit, 'TRY') : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
