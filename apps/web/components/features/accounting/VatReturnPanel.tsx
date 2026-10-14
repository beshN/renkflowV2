'use client';

import { FormEvent, useCallback, useEffect, useId, useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { EmptyState, Skeleton } from '@/components/kit';
import { addExpenseRecord, deleteExpenseRecord, getVatReturnView } from '@/app/actions/accounting.actions';
import { formatCurrency } from '@/lib/shared/utils';
import { TaskDisclosure } from '@/components/kit/TaskDisclosure';

type View = Awaited<ReturnType<typeof getVatReturnView>>;
const tl = (n: number) => formatCurrency(n, 'TRY');
const dmy = (d: string) => d.split('-').reverse().join('.');
const CATEGORIES: Record<string, string> = {
  materials: 'Malzeme ve hammadde alışı (stok)', rent: 'Kira', utilities: 'Elektrik, su, doğalgaz', salaries: 'Personel', marketing: 'Reklam', office: 'Ofis',
  travel: 'Yol ve araç', maintenance: 'Bakım ve onarım', insurance: 'Sigorta', taxes: 'Vergi ve harç', other: 'Diğer',
};
const VAT_OPTIONS = [20, 10, 1, 0];

function Figure({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="rf-panel p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`tabular-nums ${strong ? 'text-lg font-semibold' : 'text-base'}`}>{tl(value)}</p>
    </div>
  );
}

/** KDV dönem özeti for the accountant, and the purchase records that feed deductible VAT. */
export function VatReturnPanel({ period }: { period: string }) {
  const uid = useId();
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ date: `${period}-01`, vendor: '', documentNumber: '', description: '', category: 'materials', net: '', vatPercent: '20', deductible: true });

  const load = useCallback(async () => {
    try {
      setView(await getVatReturnView(period));
      setError('');
    } catch {
      setError('KDV özeti alınamadı');
    }
  }, [period]);
  useEffect(() => { setView(null); void load(); }, [load]);
  useEffect(() => { setForm((f) => ({ ...f, date: f.date.startsWith(period) ? f.date : `${period}-01` })); }, [period]);

  // "1.234,56" (Turkish) and "1234.56" both read as 1234.56.
  const net = Number(form.net.includes(',') ? form.net.trim().replace(/\./g, '').replace(',', '.') : form.net.trim());
  const vatPreview = Number.isFinite(net) && net > 0 ? Math.round(net * Number(form.vatPercent)) / 100 : 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!(net > 0)) { setFormError('KDV hariç tutarı girin'); return; }
    setBusy(true);
    setFormError('');
    const r = await addExpenseRecord({ date: form.date, vendor: form.vendor, documentNumber: form.documentNumber, description: form.description, category: form.category, net, vatPercent: Number(form.vatPercent), deductible: form.deductible });
    setBusy(false);
    if (!r.ok) { setFormError(r.error); return; }
    setForm((f) => ({ ...f, documentNumber: '', description: '', net: '' }));
    await load();
  }

  async function remove(id: string) {
    if (!window.confirm('Bu gider kaydı silinsin mi?')) return;
    const r = await deleteExpenseRecord(id);
    if (!r.ok) { setError(r.error); return; }
    await load();
  }

  if (!view) return error ? <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p> : <Skeleton className="h-48" />;
  const v = view.summary;
  const csvHref = `data:text/csv;charset=utf-8,${encodeURIComponent('﻿' + view.csv)}`;
  const empty = !v.sales.length && !v.withheld.length && !v.exempt.length && !v.input.byRate.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-xs text-muted-foreground">Kesilen faturalar (iptaller iptal edildiği ayda düşülür) ve girilen alış faturaları/giderlerden hesaplanır. Beyannameyi muhasebeciniz verir; bu özet ona hazır veri sağlar.</p>
        <a href={csvHref} download={`kdv-ozeti-${v.period}.csv`} className="rf-secondary-button inline-flex items-center gap-1 text-xs"><Download size={12} aria-hidden /> Muhasebeci için CSV</a>
      </div>
      {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Figure label="Hesaplanan KDV" value={v.output.vat} />
        <Figure label="İndirilecek KDV" value={v.input.vat} />
        <Figure label="Önceki dönemden devreden" value={v.carryIn} />
        <Figure label={v.payable ? 'Ödenecek KDV' : 'Sonraki döneme devreden'} value={v.payable || v.carryForward} strong />
        <Figure label="Tevkif edilen (alıcı öder)" value={v.output.withheld} />
      </div>

      <section aria-labelledby="kdv-sales" className="rf-panel overflow-x-auto p-4">
        <h2 id="kdv-sales" className="rf-section-title mb-2">Satışlar · {v.period}</h2>
        {empty ? <EmptyState title="Bu dönemde KDV'li işlem yok" /> : (
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground"><th className="p-2">İşlem</th><th className="p-2 text-right">Matrah</th><th className="p-2 text-right">KDV</th><th className="p-2 text-right">Tevkif edilen</th><th className="p-2 text-right">Beyan edilecek</th></tr></thead>
            <tbody>
              {v.sales.map((r) => (
                <tr key={`s${r.vatPercent}`} className="border-t border-border"><td className="p-2">KDV %{r.vatPercent}</td><td className="p-2 text-right tabular-nums">{tl(r.base)}</td><td className="p-2 text-right tabular-nums">{tl(r.vat)}</td><td className="p-2 text-right">—</td><td className="p-2 text-right tabular-nums">{tl(r.vat)}</td></tr>
              ))}
              {v.withheld.map((r) => (
                <tr key={`w${r.code}${r.vatPercent}`} className="border-t border-border"><td className="p-2">Kısmi tevkifat {r.code} · {r.name} · KDV %{r.vatPercent} · {r.withholdingPercent / 10}/10</td><td className="p-2 text-right tabular-nums">{tl(r.base)}</td><td className="p-2 text-right tabular-nums">{tl(r.vat)}</td><td className="p-2 text-right tabular-nums">{tl(r.withheld)}</td><td className="p-2 text-right tabular-nums">{tl(r.payable)}</td></tr>
              ))}
              {v.exempt.map((r) => (
                <tr key={`e${r.code ?? '-'}`} className="border-t border-border"><td className="p-2">İstisna {r.code ?? ''} · {r.name}</td><td className="p-2 text-right tabular-nums">{tl(r.base)}</td><td className="p-2 text-right">—</td><td className="p-2 text-right">—</td><td className="p-2 text-right">—</td></tr>
              ))}
              <tr className="border-t-2 border-border font-semibold"><td className="p-2">Toplam</td><td className="p-2 text-right tabular-nums">{tl(v.output.base)}</td><td /><td className="p-2 text-right tabular-nums">{tl(v.output.withheld)}</td><td className="p-2 text-right tabular-nums">{tl(v.output.vat)}</td></tr>
            </tbody>
          </table>
        )}
      </section>

      <section aria-labelledby="kdv-input" className="rf-panel overflow-x-auto p-4">
        <h2 id="kdv-input" className="rf-section-title mb-2">İndirilecek KDV · {v.input.count} belge</h2>
        {v.input.byRate.length === 0 ? <p className="text-sm text-muted-foreground">Bu dönemde KDV'li alış faturası ya da gider girilmemiş.</p> : (
          <table className="w-full min-w-[400px] text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground"><th className="p-2">Oran</th><th className="p-2 text-right">Matrah</th><th className="p-2 text-right">KDV</th></tr></thead>
            <tbody>
              {v.input.byRate.map((r) => (
                <tr key={String(r.vatPercent)} className="border-t border-border"><td className="p-2">{r.vatPercent === null ? 'Oran belirtilmemiş' : `KDV %${r.vatPercent}`}</td><td className="p-2 text-right tabular-nums">{tl(r.base)}</td><td className="p-2 text-right tabular-nums">{tl(r.vat)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
        {v.notes.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">{v.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
      </section>

      <section aria-labelledby="kdv-expenses" className="rf-panel space-y-3 p-4">
        <h2 id="kdv-expenses" className="rf-section-title">Alış faturaları ve giderler · {v.period}</h2>
        {view.canAdd && (
          <TaskDisclosure title="Alış faturası veya gider ekle">
          <form onSubmit={(e) => void submit(e)} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-describedby="expense-help">
            <div className="text-sm"><label htmlFor={`${uid}-date`}>Belge tarihi</label><input id={`${uid}-date`} type="date" required className="rf-input mt-1 w-full" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div className="text-sm"><label htmlFor={`${uid}-vendor`}>Tedarikçi</label><input id={`${uid}-vendor`} required maxLength={200} className="rf-input mt-1 w-full" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} /></div>
            <div className="text-sm"><label htmlFor={`${uid}-doc`}>Belge no</label><input id={`${uid}-doc`} maxLength={60} className="rf-input mt-1 w-full" value={form.documentNumber} onChange={(e) => setForm({ ...form, documentNumber: e.target.value })} /></div>
            <div className="text-sm"><label htmlFor={`${uid}-cat`}>Tür</label><select id={`${uid}-cat`} className="rf-input mt-1 w-full" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{Object.entries(CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            <div className="text-sm sm:col-span-2"><label htmlFor={`${uid}-desc`}>Açıklama</label><input id={`${uid}-desc`} required maxLength={300} className="rf-input mt-1 w-full" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="text-sm"><label htmlFor={`${uid}-net`}>KDV hariç tutar (TL)</label><input id={`${uid}-net`} required inputMode="decimal" className="rf-input mt-1 w-full" value={form.net} onChange={(e) => setForm({ ...form, net: e.target.value })} /></div>
            <div className="text-sm"><label htmlFor={`${uid}-rate`}>KDV oranı</label><select id={`${uid}-rate`} className="rf-input mt-1 w-full" value={form.vatPercent} onChange={(e) => setForm({ ...form, vatPercent: e.target.value })}>{VAT_OPTIONS.map((r) => <option key={r} value={r}>%{r}</option>)}</select></div>
            <div className="inline-flex items-center gap-2 text-sm sm:col-span-2"><input id={`${uid}-ded`} type="checkbox" checked={form.deductible} onChange={(e) => setForm({ ...form, deductible: e.target.checked })} /><label htmlFor={`${uid}-ded`}>KDV'si indirilebilir</label></div>
            <div className="flex items-center justify-end gap-3 sm:col-span-2">
              <span id="expense-help" className="text-xs text-muted-foreground">KDV {tl(vatPreview)} · Toplam {tl((Number.isFinite(net) && net > 0 ? net : 0) + vatPreview)}</span>
              <button type="submit" className="rf-primary-button text-sm" disabled={busy}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</button>
            </div>
            {formError && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300 sm:col-span-2 lg:col-span-4">{formError}</p>}
          </form>
          </TaskDisclosure>
        )}
        {view.expenses.length === 0 ? <p className="text-sm text-muted-foreground">Bu dönemde kayıt yok.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="text-left text-xs text-muted-foreground"><th className="p-2">Tarih</th><th className="p-2">Tedarikçi · belge</th><th className="p-2">Açıklama</th><th className="p-2 text-right">Matrah</th><th className="p-2 text-right">KDV</th>{view.canDelete && <th className="p-2"><span className="sr-only">İşlem</span></th>}</tr></thead>
              <tbody>
                {view.expenses.map((x) => (
                  <tr key={x.id} className="border-t border-border">
                    <td className="p-2 tabular-nums">{dmy(x.date)}</td>
                    <td className="p-2">{x.vendor ?? '—'}{x.documentNumber && <span className="text-muted-foreground"> · {x.documentNumber}</span>}</td>
                    <td className="p-2">{x.description}<span className="text-xs text-muted-foreground"> · {CATEGORIES[x.category] ?? x.category}{x.deductible ? '' : ' · KDV indirilemez'}</span></td>
                    <td className="p-2 text-right tabular-nums">{x.currency === 'TRY' ? tl(x.net) : formatCurrency(x.net, x.currency)}</td>
                    <td className="p-2 text-right tabular-nums">{x.vatPercent === null ? '' : `%${x.vatPercent} · `}{tl(x.vat)}</td>
                    {view.canDelete && <td className="p-2 text-right"><button type="button" className="text-muted-foreground hover:text-rose-600" aria-label={`${x.description} kaydını sil`} onClick={() => void remove(x.id)}><Trash2 size={14} aria-hidden /></button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
