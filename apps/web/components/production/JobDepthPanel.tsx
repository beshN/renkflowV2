'use client';

import { useCallback, useEffect, useState } from 'react';
import { Clock, Trash2 } from 'lucide-react';
import { StatusChip } from '@/components/kit';
import { requestJson } from '@/lib/shared/network';
import { cn } from '@/lib/utils';

type Reason = { code: string; label: string };
type Depth = {
  available: true;
  status: string;
  reasons: { scrap: Reason[]; delay: Reason[] };
  materials: Array<{ id: string; name: string }>;
  scrap: Array<{ id: string; quantity: number; lengthMm: number | null; reason: string; note: string | null; at: string; by: string | null; item: string | null }>;
  openDelay: { id: string; reason: string; note: string | null; expectedUntil: string | null; at: string; by: string | null; canResolve: boolean } | null;
  delays: Array<{ id: string; reason: string; at: string; resolvedAt: string }>;
};

/**
 * Scrap and delay on the job, for the person at the machine: pick a reason chip, a number, done.
 * No prices or customer here; the office sees the totals as Pareto.
 */
export function JobDepthPanel({ workOrderId }: { workOrderId: string }) {
  const [data, setData] = useState<Depth | { available: false } | null>(null);
  const [mode, setMode] = useState<'' | 'scrap' | 'delay'>('');
  const [reason, setReason] = useState('');
  const [qty, setQty] = useState('1');
  const [length, setLength] = useState('');
  const [item, setItem] = useState('');
  const [note, setNote] = useState('');
  const [until, setUntil] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const r = await requestJson<Depth | { available: false }>(`/api/v1/production/jobs/${workOrderId}/depth`, { cache: 'no-store' });
    if (r.ok && r.data) setData(r.data);
  }, [workOrderId]);
  useEffect(() => { void load(); }, [load]);

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError('');
    const r = await requestJson<Depth>(`/api/v1/production/jobs/${workOrderId}/depth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setBusy(false);
    if (!r.ok || !r.data) { setError(r.error || 'Kaydedilemedi'); return; }
    setData(r.data);
    setMode('');
    setReason(''); setQty('1'); setLength(''); setItem(''); setNote(''); setUntil('');
  }

  if (!data || !data.available) return null;
  const closed = ['done', 'cancelled'].includes(data.status);
  const chips = mode === 'scrap' ? data.reasons.scrap : data.reasons.delay;

  return (
    <section className="rf-panel space-y-3 p-5" aria-label="Fire ve gecikme">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">Fire ve gecikme</h3>
        {data.openDelay && <StatusChip tone="warning" icon={Clock} label={`Gecikme: ${data.openDelay.reason}`} />}
        <span className="ml-auto flex gap-2">
          {!closed && <button type="button" className={cn('rf-input min-h-11 px-4 text-sm', mode === 'scrap' && 'border-primary')} aria-pressed={mode === 'scrap'} onClick={() => { setMode(mode === 'scrap' ? '' : 'scrap'); setReason(''); }}><Trash2 size={15} className="mr-1 inline" />Fire</button>}
          {!closed && !data.openDelay && <button type="button" className={cn('rf-input min-h-11 px-4 text-sm', mode === 'delay' && 'border-primary')} aria-pressed={mode === 'delay'} onClick={() => { setMode(mode === 'delay' ? '' : 'delay'); setReason(''); }}><Clock size={15} className="mr-1 inline" />Gecikme</button>}
        </span>
      </div>

      {data.openDelay && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-600/35 px-3 py-2 text-sm">
          <span className="flex-1">{data.openDelay.reason}{data.openDelay.note ? ` · ${data.openDelay.note}` : ''}{data.openDelay.expectedUntil ? ` · tahmini ${new Date(data.openDelay.expectedUntil + 'T12:00:00Z').toLocaleDateString('tr-TR')}` : ''}</span>
          {data.openDelay.canResolve && <button type="button" disabled={busy} className="rf-primary-button" onClick={() => void send({ action: 'resolve_delay' })}>Gecikme bitti</button>}
        </div>
      )}

      {mode && (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void send(mode === 'scrap'
          ? { action: 'scrap', reasonCode: reason, quantity: Number(qty), lengthMm: length ? Number(length) : undefined, itemId: item || undefined, note: note || undefined }
          : { action: 'delay', reasonCode: reason, note: note || undefined, expectedUntil: until || undefined }); }}>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Neden">
            {chips.map((r) => (
              <button key={r.code} type="button" role="radio" aria-checked={reason === r.code} onClick={() => setReason(r.code)}
                className={cn('min-h-11 rounded-full border px-4 text-sm', reason === r.code ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>{r.label}</button>
            ))}
          </div>
          {mode === 'scrap' ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <label className="text-xs">Adet<input type="number" min={0.001} step="any" required inputMode="decimal" className="rf-input mt-1 w-full text-base" value={qty} onChange={(e) => setQty(e.target.value)} /></label>
              <label className="text-xs">Boy (mm)<input type="number" min={1} inputMode="numeric" className="rf-input mt-1 w-full text-base" value={length} onChange={(e) => setLength(e.target.value)} /></label>
              {data.materials.length > 0 && (
                <label className="col-span-2 text-xs">Malzeme<select className="rf-input mt-1 w-full text-base" value={item} onChange={(e) => setItem(e.target.value)}><option value="">—</option>{data.materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
              )}
            </div>
          ) : (
            <label className="block text-xs">Tahmini bitiş<input type="date" className="rf-input mt-1 w-full text-base sm:w-48" value={until} onChange={(e) => setUntil(e.target.value)} /></label>
          )}
          <input aria-label="Not" placeholder="Not (isteğe bağlı)" maxLength={500} className="rf-input w-full" value={note} onChange={(e) => setNote(e.target.value)} />
          {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
          <button disabled={busy || !reason} className="rf-primary-button min-h-11">{mode === 'scrap' ? 'Fireyi kaydet' : 'Gecikmeyi bildir'}</button>
        </form>
      )}

      {data.scrap.length > 0 && (
        <ul className="space-y-1 border-t border-border pt-2 text-sm">
          {data.scrap.map((s) => (
            <li key={s.id} className="flex flex-wrap gap-2">
              <span className="font-medium">{s.reason}</span>
              <span className="tabular-nums">× {s.quantity}{s.lengthMm ? ` · ${s.lengthMm} mm` : ''}</span>
              {s.item && <span className="text-muted-foreground">{s.item}</span>}
              <span className="ml-auto text-xs text-muted-foreground">{s.by ?? ''} · {new Date(s.at).toLocaleDateString('tr-TR')}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
