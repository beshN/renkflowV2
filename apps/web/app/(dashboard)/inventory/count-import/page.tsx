'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { requestJson } from '@/lib/shared/network';
import { unitLabel } from '@/lib/features/inventory/vocabulary';

type Row = { ref: string; section: string; code: string | null; name: string; color: string | null; quantity: number | null; unit: string | null; pieceLengthMm: number | null; issues: string[]; status?: string; note?: string | null };
type Doc = { id: string; title: string | null; count_date: string | null; file_name: string; created_at: string; warehouse_name: string; lines: Row[] | null };
type Overview = { available: boolean; canImport?: boolean; documents: Doc[]; warehouses: Array<{ id: string; code: string; name: string }> };
type Filed = { suggestionId: string; created: boolean; document: { title: string | null; date: string | null; pages: number }; summary: { rows: number; counted: number; metres: number; uncertain: number }; rows: Row[] };

const STATUS: Record<string, string> = { applied: 'Stoğa yazıldı', needs_bars: 'Çubuk sayımı bekliyor', uncertain: 'Emin değilim · uygulanmadı', skipped: 'Atlandı', counted: 'Çubuklar sayıldı' };

/** What happens to a row on approval, before it is approved. */
function plan(row: Row) {
  if (row.issues.length) return { label: 'Emin değilim · uygulanmayacak', tone: 'text-amber-700 dark:text-amber-300' };
  if (row.unit === 'm' || row.unit === 'boy') return { label: 'Kart açılır · çubuklar sayılacak', tone: 'text-muted-foreground' };
  return { label: 'Açılış stoğu yazılır', tone: 'text-emerald-700 dark:text-emerald-300' };
}

function quantity(row: Row) {
  if (row.quantity === null) return '—';
  return `${row.quantity.toLocaleString('tr-TR', { maximumFractionDigits: 3 })} ${unitLabel(row.unit)}${row.pieceLengthMm ? ` · ${row.pieceLengthMm / 10} cm` : ''}`;
}

function RowsTable({ rows, status }: { rows: Row[]; status: (row: Row) => { label: string; tone: string } }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead><tr>{['Bölüm', 'Kod', 'Malzeme', 'Miktar', 'Durum'].map((h) => <th key={h} className="p-2 text-xs text-muted-foreground">{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((row) => {
            const s = status(row);
            return (
              <tr key={row.ref} className="border-t border-border align-top">
                <td className="p-2 text-xs text-muted-foreground">{row.section}</td>
                <td className="p-2">{row.code || '—'}</td>
                <td className="p-2">{row.name}</td>
                <td className="p-2 whitespace-nowrap">{quantity(row)}</td>
                <td className={`p-2 text-xs ${s.tone}`}>
                  {s.label}
                  {row.issues.length > 0 && <ul className="mt-1 list-disc pl-4">{row.issues.map((i) => <li key={i}>{i}</li>)}</ul>}
                  {row.note && <p className="mt-1">{row.note}</p>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function CountImportPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [filed, setFiled] = useState<Filed | null>(null);
  const load = useCallback(async () => {
    const r = await requestJson<Overview>('/api/v1/inventory/count-import');
    if (r.ok && r.data) setData(r.data);
    else setError(r.error || 'Sayım kayıtları alınamadı');
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (!data) return <main className="rf-page"><p role={error ? 'alert' : 'status'}>{error || 'Yükleniyor…'}</p></main>;
  if (!data.available) return <main className="rf-page"><h1 className="rf-page-title">Sayım listesi içe aktarma</h1><p className="mt-3 text-sm text-muted-foreground">Bu kurulumda sayım içe aktarma henüz etkin değil (veritabanı güncellemesi bekleniyor).</p></main>;
  return (
    <main className="rf-page space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="rf-eyebrow">STOK · SAYIM</p>
          <h1 className="rf-page-title">Sayım listesi içe aktarma</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Basılı sayım listesi (PDF) kesin kurallarla okunur; model kullanılmaz. Okunan satırlar bir öneri olarak
            &quot;Önerilenler&quot;e düşer ve onaylanmadan stoğa hiçbir şey yazılmaz. Gramajı tutmayan, kodu veya birimi eksik
            satırlar &quot;emin değilim&quot; diye işaretlenir ve uygulanmaz.
          </p>
        </div>
        <Link className="rf-secondary-button" href="/inventory">Stok listesine dön</Link>
      </div>

      {data.canImport && (
        <form
          className="rf-panel grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const file = form.get('file') as File | null;
            if (!file || !file.size) return setError('PDF seçin');
            if (file.size > 3_000_000) return setError('Dosya en fazla 3 MB olabilir. Sayım listesini bölerek yükleyin.');
            setBusy(true);
            setError('');
            setFiled(null);
            const bytes = new Uint8Array(await file.arrayBuffer());
            let binary = '';
            for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
            const r = await requestJson<{ data: Filed }>('/api/v1/inventory/count-import', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fileName: file.name, base64: btoa(binary), warehouseId: form.get('warehouseId') }),
            }, { timeoutMs: 60000, fallbackError: 'Sayım listesi okunamadı' });
            setBusy(false);
            if (r.ok && r.data) setFiled(r.data.data);
            else setError(r.error || 'Sayım listesi okunamadı');
          }}
        >
          <label className="block text-xs">Sayım listesi (PDF, en fazla 3 MB)<input name="file" type="file" accept="application/pdf,.pdf" required className="rf-input mt-2 w-full" /></label>
          <label className="block text-xs">Açılış stoğunun yazılacağı depo
            <select name="warehouseId" required className="rf-input mt-2 w-full">
              <option value="">Seçin</option>
              {data.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
            </select>
          </label>
          <button className="rf-primary-button" disabled={busy}>{busy ? 'Okunuyor…' : 'Oku ve öneri oluştur'}</button>
        </form>
      )}
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}

      {filed && (
        <section className="rf-panel space-y-3" aria-label="Okunan sayım listesi">
          <h2 className="font-semibold">{filed.document.title || 'Sayım listesi'} {filed.document.date || ''} · {filed.document.pages} sayfa</h2>
          <p className="text-sm">
            {filed.summary.rows} satır okundu: {filed.summary.counted} açılış stoğu, {filed.summary.metres} çubuk sayımı bekleyecek,{' '}
            <strong>{filed.summary.uncertain} emin değilim</strong>.{' '}
            {filed.created ? 'Öneri oluşturuldu; ' : 'Bu liste zaten onay bekliyor; '}
            <Link className="underline" href="/dashboard">Önerilenler&apos;den onaylayın</Link>.
          </p>
          <RowsTable rows={filed.rows} status={plan} />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">İçe aktarılan sayımlar</h2>
        {!data.documents.length && <p className="text-sm text-muted-foreground">Henüz onaylanmış sayım listesi yok.</p>}
        {data.documents.map((d) => (
          <details key={d.id} className="rf-panel" open={new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search).get('document') === d.id}>
            <summary className="cursor-pointer text-sm font-medium">
              {d.title || d.file_name} {d.count_date ? new Date(d.count_date).toLocaleDateString('tr-TR') : ''} · {d.warehouse_name} · {(d.lines ?? []).length} satır
            </summary>
            <div className="mt-3"><RowsTable rows={d.lines ?? []} status={(row) => ({ label: STATUS[row.status ?? ''] ?? row.status ?? '', tone: row.status === 'uncertain' || row.status === 'skipped' ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground' })} /></div>
          </details>
        ))}
      </section>
    </main>
  );
}
