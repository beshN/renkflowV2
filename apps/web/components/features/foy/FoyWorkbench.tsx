'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, CheckCircle2, FileText, Info, Loader2, Sparkles, Upload, UserPlus, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState, PageHeader, StatusChip } from '@/components/kit';
import { ColorSwatch } from '@/components/colors/ColorSwatch';
import { FoySchema } from './FoySchema';
import { FoyCutPlan } from './FoyCutPlan';
import { cn } from '@/lib/utils';
import type { FoyCheck, FoyFeatures } from '@/lib/features/foy/rules';
import type { FoyDoc, FoyPartKind } from '@/lib/features/foy/types';

type Analysis = {
  name: string;
  doc: FoyDoc;
  checks: FoyCheck[];
  features: FoyFeatures;
  customers: Array<{ id: string; name: string; score: number; reason: string }>;
  model: { used: boolean; filled: string[]; blocked: string | null };
  summary: { ok: number; info: number; warn: number };
};
type Entry = {
  key: string;
  file: File;
  mime: string;
  base64?: string;
  state: 'reading' | 'ready' | 'error' | 'done';
  error?: string;
  result?: Analysis;
  customerId?: string | null;
  customerName?: string;
  order?: { href: string; orderNumber: string };
};

const MAX = 3_000_000;
const ACCEPT = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const KIND: Record<FoyPartKind, { label: string; cls: string }> = {
  demir: { label: 'Demir', cls: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300' },
  dere: { label: 'Dere', cls: 'bg-sky-500/15 text-sky-800 dark:text-sky-300' },
  led: { label: 'LED profili', cls: 'bg-amber-500/15 text-amber-800 dark:text-amber-300' },
  boru: { label: 'Boru', cls: 'bg-violet-500/15 text-violet-800 dark:text-violet-300' },
  kumas: { label: 'Kumaş', cls: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300' },
  sac: { label: 'Sac', cls: 'bg-stone-500/15 text-stone-700 dark:text-stone-300' },
  diger: { label: 'Diğer', cls: 'bg-muted text-muted-foreground' },
};
const n = (v: number | null | undefined) => (v === null || v === undefined ? '—' : v.toLocaleString('tr-TR', { maximumFractionDigits: 1, useGrouping: false }));
const trDate = (iso: string | null) => (iso ? iso.split('-').reverse().join('.') : '—');

function toBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(new Error('Dosya okunamadı'));
    r.readAsDataURL(file);
  });
}
async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'İşlem tamamlanamadı');
  return data as T;
}

function CheckRow({ c }: { c: FoyCheck }) {
  const Icon = c.severity === 'ok' ? CheckCircle2 : c.severity === 'info' ? Info : AlertTriangle;
  const tone = c.severity === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : c.severity === 'info' ? 'text-primary' : 'text-amber-600 dark:text-amber-400';
  return (
    <li className="flex gap-2 py-1.5">
      <Icon size={15} className={cn('mt-0.5 shrink-0', tone)} aria-label={c.severity === 'ok' ? 'tutuyor' : c.severity === 'info' ? 'bilgi' : 'uyarı'} />
      <div className="min-w-0">
        <p className="text-[13px] font-medium leading-tight">{c.title}</p>
        <p className="text-xs text-muted-foreground">{c.detail}</p>
      </div>
    </li>
  );
}

function Spec({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-card px-2.5 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex min-h-5 items-center gap-1.5 truncate text-[13px] font-medium">{children}</div>
    </div>
  );
}

function Preview({ entry, onCustomer, onCreate, creating }: { entry: Entry; onCustomer: (id: string | null, name: string) => void; onCreate: () => void; creating: boolean }) {
  const a = entry.result!;
  const d = a.doc;
  const f = a.features;
  const color = d.ral ? `RAL ${d.ral} ${d.finish ?? ''}`.trim() : null;
  const checks = [...a.checks].sort((x, y) => ['warn', 'info', 'ok'].indexOf(x.severity) - ['warn', 'info', 'ok'].indexOf(y.severity));
  const fallbackName = d.customer || d.address || entry.file.name.replace(/\.[a-z]+$/i, '');
  const extras = [f.motor && `${f.motor}${f.motorControl ? ` + ${f.motorControl}` : ''} motor`, f.ledEveryProfile && 'Her profilde LED', f.dimmer && 'Dimmer', f.valance && `Saçak: ${f.valance}`, f.noSteel && 'Demir yok', f.noTopSheet && 'Üst sac yok', f.weldOnSite && 'Sahada kaynak'].filter(Boolean) as string[];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {a.summary.ok > 0 && <StatusChip tone="success" label={`${a.summary.ok} tutuyor`} />}
        {a.summary.info > 0 && <StatusChip tone="info" icon={Info} label={`${a.summary.info} bilgi`} />}
        {a.summary.warn > 0 && <StatusChip tone="warning" label={`${a.summary.warn} kontrol et`} />}
        {a.model.used && <StatusChip tone="neutral" icon={Sparkles} label="Görsel okuma kullanıldı" />}
      </div>
      {a.model.blocked && (
        <p className="flex items-start gap-2 rounded-md border border-amber-600/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-200"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{a.model.blocked}</p>
      )}

      <section className="rounded-lg border border-border bg-card p-3">
        <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold"><Users size={14} />Müşteri</h3>
        <div className="space-y-1.5">
          {a.customers.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-2 text-[13px]">
              <input type="radio" name={`c-${entry.key}`} checked={entry.customerId === c.id} onChange={() => onCustomer(c.id, c.name)} />
              <span className="font-medium">{c.name}</span>
              <span className="text-[11px] text-muted-foreground">{c.reason === 'aynı' ? 'aynı ad' : c.reason === 'benzer' ? 'yazım farkı' : 'adı içeriyor'}</span>
            </label>
          ))}
          <label className="flex items-center gap-2 text-[13px]">
            <input type="radio" name={`c-${entry.key}`} checked={!entry.customerId} onChange={() => onCustomer(null, entry.customerName || fallbackName)} />
            <UserPlus size={14} className="text-muted-foreground" />
            <input aria-label="Yeni müşteri adı" value={entry.customerId ? fallbackName : entry.customerName ?? fallbackName} disabled={Boolean(entry.customerId)} onChange={(e) => onCustomer(null, e.target.value)} className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-[13px] disabled:opacity-50" />
          </label>
        </div>
      </section>

      {d.template === 'pergola' && <FoyCutPlan doc={d} />}

      <details className="rounded-lg border border-border" open={a.summary.warn > 0}>
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold">Föy ayrıntıları ve kontroller{a.summary.warn > 0 ? ` (${a.summary.warn} uyarı)` : ''}</summary>
        <div className="space-y-4 p-3">
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Spec label="Föy tarihi">{trDate(d.date)}</Spec>
        <Spec label="Renk">{color ? <><ColorSwatch color={color} size={14} />{color}</> : '—'}</Spec>
        <Spec label={d.template === 'windbreaker' ? 'Ürün' : 'Kumaş'}>{d.template === 'windbreaker' ? 'Rüzgâr kırıcı' : d.fabric ?? '—'}</Spec>
        <Spec label="Montaj">{[d.assembly === 'montajli' ? 'Montajlı' : d.assembly === 'demonte' ? 'Demonte' : null, d.crated ? 'Sandıklı' : null].filter(Boolean).join(' · ') || '—'}</Spec>
        {d.series.length > 0 && <Spec label="Seri">{d.series.filter((o) => o.checked).map((o) => o.label).join(', ') || '—'}</Spec>}
        {d.lights.length > 0 && <Spec label="Işık">{d.lights.filter((o) => o.checked).map((o) => o.label).join(', ') || 'Işıksız'}</Spec>}
        {d.template === 'pergola' && <Spec label="Sistem">{f.systems} × {d.systems[0]?.bays.length ?? 0} bölme</Spec>}
        {d.windbreaker?.deliveryDate && <Spec label="Teslim">{trDate(d.windbreaker.deliveryDate)}</Spec>}
      </section>
      {extras.length > 0 && <div className="flex flex-wrap gap-1.5">{extras.map((x) => <span key={x} className="rounded-full border border-border px-2 py-0.5 text-[11px]">{x}</span>)}</div>}

      {d.systems.length > 0 && (
        <section className="space-y-2 rounded-lg border border-border bg-card p-3">
          {d.systems.map((s, k) => <FoySchema key={k} system={s} index={k} total={d.systems.length} />)}
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        {d.cutList.length > 0 && (
          <section className="rounded-lg border border-border bg-card">
            <h3 className="border-b border-border px-3 py-2 text-xs font-semibold">Kesim listesi</h3>
            <table className="w-full text-[13px]">
              <tbody>
                {d.cutList.map((r, k) => (
                  <tr key={k} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-1.5"><span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', KIND[r.kind].cls)}>{KIND[r.kind].label}</span></td>
                    <td className="px-2 py-1.5 text-muted-foreground">{r.profile}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{r.lengthCm === null ? '—' : `${n(r.lengthCm)}${r.widthCm !== null ? ` × ${n(r.widthCm)}` : ''} cm`}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{r.quantity === null ? '—' : `${r.quantity} ad`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
        <section className="rounded-lg border border-border bg-card p-3">
          <h3 className="mb-1 text-xs font-semibold">Kontroller</h3>
          <ul className="divide-y divide-border/60">{checks.map((c) => <CheckRow key={c.id} c={c} />)}</ul>
        </section>
      </div>

      {(d.fabricSize || d.valanceSize || d.windbreaker) && (
        <section className="flex flex-wrap gap-2">
          {d.fabricSize && <Spec label="Kumaş ölçüsü">{n(d.fabricSize.widthCm)} × {n(d.fabricSize.lengthCm)} cm</Spec>}
          {d.valanceSize && <Spec label="Saçak ölçüsü">{n(d.valanceSize.widthCm)} × {n(d.valanceSize.heightCm)} cm</Spec>}
          {d.windbreaker?.widthCm != null && <Spec label="Ölçü">{n(d.windbreaker.widthCm)} × {n(d.windbreaker.heightCm)} cm</Spec>}
          {d.windbreaker?.frameCm != null && <Spec label="Dikey kasa">{n(d.windbreaker.frameCm)} × {d.windbreaker.frameQty ?? '—'}</Spec>}
          {d.windbreaker?.sashCm != null && <Spec label="Dikey kanat">{n(d.windbreaker.sashCm)} × {d.windbreaker.sashQty ?? '—'}</Spec>}
          {d.windbreaker?.sashGlass && <Spec label={`${n(d.windbreaker.sashGlass.thicknessMm)} mm kanat camı`}>{n(d.windbreaker.sashGlass.widthCm)} × {n(d.windbreaker.sashGlass.heightCm)}</Spec>}
          {d.windbreaker?.frameGlass && <Spec label={`${n(d.windbreaker.frameGlass.thicknessMm)} mm kasa camı`}>{n(d.windbreaker.frameGlass.widthCm)} × {n(d.windbreaker.frameGlass.heightCm)}</Spec>}
          {d.windbreaker?.totalKg != null && <Spec label="Toplam">{n(d.windbreaker.totalKg)} kg</Spec>}
        </section>
      )}

      {(d.notes.length > 0 || d.ironNotes.length > 0) && (
        <section className="rounded-lg border border-border bg-card p-3 text-[13px]">
          {d.notes.length > 0 && <ul className="list-disc space-y-0.5 pl-5">{d.notes.map((x, k) => <li key={k}>{x}</li>)}</ul>}
          {d.ironNotes.length > 0 && (
            <details className="mt-2 text-xs text-muted-foreground">
              <summary className="cursor-pointer">Demir çizimleri</summary>
              <p className="mt-1">{d.ironNotes.join(' · ')}</p>
            </details>
          )}
        </section>
      )}

        </div>
      </details>

      <div className="sticky bottom-0 -mx-1 flex items-center justify-end gap-2 border-t border-border bg-background/95 px-1 py-3 backdrop-blur">
        {entry.order ? (
          <Link href={entry.order.href} className="rf-primary-button h-9 items-center gap-2 px-3 text-xs">{entry.order.orderNumber} siparişini aç <ArrowRight size={14} /></Link>
        ) : (
          <button type="button" disabled={creating || d.template === 'unknown'} onClick={onCreate} className="rf-primary-button h-9 items-center gap-2 px-3 text-xs">
            {creating ? <Loader2 size={14} className="animate-spin motion-reduce:animate-none" /> : <CheckCircle2 size={14} />}
            Onayla, sipariş oluştur
          </button>
        )}
      </div>
    </div>
  );
}

/** Drop one or more imalat föyü; each is read, checked and turned into an order on approval. */
export function FoyWorkbench() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const patch = useCallback((key: string, p: Partial<Entry>) => setEntries((list) => list.map((e) => (e.key === key ? { ...e, ...p } : e))), []);

  const readEntry = useCallback(async (entry: Entry) => {
    patch(entry.key, { state: 'reading', error: undefined });
    if (entry.file.size > MAX) {
      patch(entry.key, { state: 'error', error: 'Dosya 3 MB’tan büyük' });
      return;
    }
    try {
      const base64 = await toBase64(entry.file);
      const result = await post<Analysis>('/api/v1/orders/foy', { name: entry.file.name, mime: entry.mime, base64 });
      const top = result.customers[0];
      patch(entry.key, { state: 'ready', base64, result,
        customerId: top && top.reason !== 'içeriyor' ? top.id : null,
        customerName: top && top.reason !== 'içeriyor' ? top.name : result.doc.customer || result.doc.address || entry.file.name.replace(/\.[a-z]+$/i, '') });
    } catch (err) {
      patch(entry.key, { state: 'error', error: err instanceof Error ? err.message : 'Okunamadı' });
    }
  }, [patch]);
  const add = useCallback(async (files: FileList | File[]) => {
    const list = [...files].filter((f) => ACCEPT.includes(f.type));
    if (!list.length) return toast.error('PDF ya da fotoğraf seçin');
    const fresh: Entry[] = list.map((file) => ({ key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`, file, mime: file.type, state: 'reading' }));
    setEntries((cur) => [...fresh, ...cur]);
    setSelected((s) => s ?? fresh[0].key);
    for (const entry of fresh) await readEntry(entry);
  }, [readEntry]);

  const current = entries.find((e) => e.key === selected) ?? null;
  const create = async () => {
    if (!current?.result) return;
    setCreating(true);
    try {
      const r = await post<{ href: string; orderNumber: string; attached: boolean }>('/api/v1/orders/foy/order', {
        name: current.file.name, doc: current.result.doc, customerId: current.customerId ?? null,
        customerName: (current.customerName || current.result.doc.customer || current.result.doc.address || 'Föyden sipariş').trim(),
        file: current.base64 ? { name: current.file.name, mime: current.mime, base64: current.base64 } : undefined,
      });
      patch(current.key, { state: 'done', order: { href: r.href, orderNumber: r.orderNumber } });
      toast.success(`${r.orderNumber} oluşturuldu${r.attached ? ', föy eklendi' : ''}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sipariş oluşturulamadı');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="rf-page space-y-5">
      <PageHeader eyebrow="Üretim" title="Kesim listesi"
        hint="Föy PDF'ini ya da fotoğrafını yükleyin. Hangi profil hangi çubuktan kesilecek, hangi artık ya da hurda boy kullanılacak, ne kadar fire çıkacak ve neyin alınması gerektiği hesaplanır. Siz onaylamadan hiçbir şey kaydedilmez."
        kpis={entries.length ? [
          { label: 'föy', value: entries.length, icon: FileText },
          { label: 'kontrol bekliyor', value: entries.filter((e) => (e.result?.summary.warn ?? 0) > 0 && e.state !== 'done').length, icon: AlertTriangle, tone: 'warning' },
          { label: 'siparişe döndü', value: entries.filter((e) => e.state === 'done').length, icon: CheckCircle2, tone: 'success' },
        ] : undefined}
        action={<button type="button" onClick={() => input.current?.click()} className="rf-primary-button h-9 items-center gap-2 px-3 text-xs"><Upload size={14} /> Föy yükle</button>} />
      <input ref={input} type="file" accept={ACCEPT.join(',')} multiple hidden onChange={(e) => { if (e.target.files) void add(e.target.files); e.target.value = ''; }} />

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); void add(e.dataTransfer.files); }}
        className={cn('grid gap-4', entries.length ? 'lg:grid-cols-[260px_1fr]' : '')}
      >
        {!entries.length ? (
          <div className={cn('rounded-xl border-2 border-dashed border-border transition-colors', drag && 'border-primary bg-primary/5')}>
            <EmptyState icon={Upload} title="Föyü buraya bırakın" action={{ label: 'Dosya seç', onClick: () => input.current?.click() }} />
          </div>
        ) : (
          <>
            <ul className={cn('space-y-1.5 rounded-xl border border-dashed border-border p-1.5 transition-colors lg:max-h-[75vh] lg:overflow-auto', drag && 'border-primary bg-primary/5')} aria-label="Yüklenen föyler">
              {entries.map((e) => (
                <li key={e.key}>
                  <button type="button" onClick={() => setSelected(e.key)} aria-current={selected === e.key} className={cn('flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left', selected === e.key ? 'border-primary/50 bg-primary/5' : 'border-transparent hover:bg-accent')}>
                    {e.state === 'reading' ? <Loader2 size={15} className="shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none" />
                      : e.state === 'error' ? <X size={15} className="shrink-0 text-rose-600" />
                      : e.state === 'done' ? <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
                      : (e.result?.summary.warn ?? 0) > 0 ? <AlertTriangle size={15} className="shrink-0 text-amber-600" /> : <CheckCircle2 size={15} className="shrink-0 text-muted-foreground" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{e.result?.doc.customer || e.result?.doc.address || e.file.name}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{e.state === 'error' ? e.error : e.state === 'reading' ? 'Okunuyor…' : e.result ? `${e.result.doc.template === 'windbreaker' ? 'Rüzgâr kırıcı' : e.result.doc.template === 'pergola' ? 'Makaslı pergola' : 'Tanınmadı'} · ${trDate(e.result.doc.date)}` : ''}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="min-w-0">
              {current?.result ? (
                <Preview entry={current} creating={creating} onCreate={create} onCustomer={(id, name) => patch(current.key, { customerId: id, customerName: name })} />
              ) : current?.state === 'error' ? (
                <EmptyState icon={X} title={current.error ?? 'Okunamadı'} action={{ label: 'Tekrar oku', onClick: () => void readEntry(current) }} />
              ) : (
                <div className="grid place-items-center py-16 text-muted-foreground"><Loader2 className="animate-spin motion-reduce:animate-none" /></div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
