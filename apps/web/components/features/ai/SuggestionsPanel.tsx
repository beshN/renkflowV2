'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlarmClock, BellOff, CalendarClock, Check, Clock, Copy, FileClock, MailQuestion, PackageX, Pencil, Recycle, Sparkles, TrendingUp, TriangleAlert, Wallet, X, type LucideIcon } from 'lucide-react';
import { useToast } from '@/lib/context/ToastContext';
import { HintTip } from '@/components/kit';

type EditableField = { key: string; label: string; type: 'number' | 'text'; min?: number; max?: number; unit?: string };
type Suggestion = {
  id: string; kind: string; kindLabel: string; title: string; rationale: string; payload: Record<string, unknown>;
  affected: Array<{ entityType: string; entityId: string; label: string; href?: string }>;
  uncertain: boolean; uncertaintyNote: string | null; source: 'system' | 'model'; model: string | null;
  edited: boolean; version: number; editableFields: EditableField[];
  // Proactive detectors (048): absent on older suggestion kinds.
  detector?: string | null; priority?: 'high' | 'medium' | 'low'; icon?: string | null; confidence?: 'high' | 'medium' | 'low' | null; rule?: string | null;
  evidence?: { badges: Array<{ label: string; tone?: string }>; records: Array<{ entityType: string; entityId: string; label: string; href?: string }>; numbers: Record<string, string | number | null> } | null;
};

const ICONS: Record<string, LucideIcon> = { AlarmClock, PackageX, MailQuestion, Wallet, TrendingUp, CalendarClock, FileClock, Recycle };
const TONE: Record<string, string> = {
  danger: 'border-rose-500/40 text-rose-800 dark:text-rose-300', warning: 'border-amber-500/40 text-amber-800 dark:text-amber-300',
  success: 'border-emerald-500/40 text-emerald-800 dark:text-emerald-300', info: 'border-sky-500/40 text-sky-800 dark:text-sky-300', neutral: 'border-border text-foreground',
};
const PRIORITY: Record<string, { label: string; cls: string }> = { high: { label: 'Acil', cls: 'bg-rose-600' }, medium: { label: 'Normal', cls: 'bg-amber-500' }, low: { label: 'Düşük', cls: 'bg-muted-foreground/50' } };
const CONFIDENCE: Record<string, string> = { high: 'Yüksek', medium: 'Orta', low: 'Düşük' };
const REJECT_REASONS: Array<[string, string]> = [['not_relevant', 'Gereksiz'], ['wrong', 'Yanlış'], ['already_done', 'Zaten yapıldı'], ['never', 'Bir daha önerme']];

/**
 * "Önerilenler": suggestions waiting for a person. Nothing is applied until someone approves it;
 * the panel renders nothing when the queue is empty or not installed yet.
 */
export function SuggestionsPanel() {
  const { showToast } = useToast();
  const [items, setItems] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [why, setWhy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [snoozing, setSnoozing] = useState<string | null>(null);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast('Mesaj kopyalandı. Göndermeyi siz yaparsınız; RenkFlow mesaj göndermez.', 'success');
    } catch {
      showToast('Kopyalama izni yok. Metni seçip kopyalayın.', 'error');
    }
  }

  /** "Bu kuralı X güne çek": the detector's quiet days for the whole firm (owner/admin). */
  async function quiet(item: Suggestion, days: number) {
    if (!item.detector) return;
    const response = await fetch('/api/v1/ai/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ detectors: { [item.detector]: { quietDays: days } } }) });
    const body = await response.json().catch(() => null);
    if (response.ok) showToast(`${item.kindLabel}: reddedilen bir durum ${days} gün tekrar önerilmeyecek.`, 'success');
    else setErrors((current) => ({ ...current, [item.id]: body?.error || 'Ayar kaydedilemedi.' }));
  }

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/v1/ai/suggestions', { signal, cache: 'no-store' });
      const body = response.ok ? await response.json() : null;
      if (!signal?.aborted) setItems(body?.available && Array.isArray(body.items) ? body.items : []);
    } catch {
      // The panel is optional; the dashboard works without it.
    }
  }, []);

  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);

  async function decide(item: Suggestion, body: Record<string, unknown>) {
    setBusy(item.id);
    setErrors((current) => ({ ...current, [item.id]: '' }));
    try {
      const response = await fetch('/api/v1/ai/suggestions/' + item.id, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedVersion: item.version, ...body }) });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setErrors((current) => ({ ...current, [item.id]: result?.error || 'Karar kaydedilemedi.' }));
        if (response.status === 409) void load();
        return;
      }
      if (result.status === 'pending' && result.snoozedUntil) {
        setItems((current) => current.filter((s) => s.id !== item.id));
        setSnoozing(null);
        showToast('Ertelendi; günü gelince yeniden görünecek.', 'success');
      } else if (result.status === 'pending') {
        setItems((current) => current.map((s) => (s.id === item.id ? { ...s, payload: result.payload, version: result.version, edited: true } : s)));
        setEditing(null);
        showToast('Düzeltme kaydedildi. Öneri onayınızı bekliyor.', 'success');
      } else {
        setItems((current) => current.filter((s) => s.id !== item.id));
        showToast(result.status === 'approved' ? 'Öneri onaylandı ve uygulandı.' : 'Öneri reddedildi.', 'success');
      }
    } catch {
      setErrors((current) => ({ ...current, [item.id]: 'Bağlantı kurulamadı. Tekrar deneyin.' }));
    } finally {
      setBusy(null);
    }
  }

  if (!items.length) return null;
  return (
    <section aria-label="Önerilenler" className="rf-panel overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="rf-section-title flex items-center gap-2"><Sparkles size={15} aria-hidden /> Önerilenler <HintTip text="Asistan yalnız öneri hazırlar; onaylamadan hiçbir kayıt değişmez." /></h2>
        <span className="rounded-full bg-primary/10 px-2 text-xs font-semibold tabular-nums text-primary">{items.length}</span>
      </div>
      <ul className={`grid gap-px bg-border ${items.length > 1 ? 'sm:grid-cols-2' : ''}`}>
        {items.map((item) => (
          <li key={item.id} className="space-y-3 bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {(() => { const Icon = (item.icon && ICONS[item.icon]) || Sparkles; return <Icon size={13} aria-hidden />; })()}
                  {item.priority && item.detector && <span className={`inline-block h-2 w-2 rounded-full ${PRIORITY[item.priority].cls}`} role="img" aria-label={`Öncelik: ${PRIORITY[item.priority].label}`} />}
                  {item.kindLabel}{item.edited ? ' · düzenlendi' : ''}
                </p>
                <h3 className="mt-1 flex items-start gap-1 text-sm font-semibold">{item.title}<HintTip label="Gerekçe" text={`${item.rationale}\n\n${item.source === 'model' ? `Model: ${item.model ?? 'bilinmiyor'}` : 'Kural / hesap motoru'}`} /></h3>
              </div>
              {item.uncertain && (
                <span role="note" className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 pl-2 text-[11px] font-medium text-amber-800 dark:text-amber-300">
                  <TriangleAlert size={12} aria-hidden /> Emin değil
                  {item.uncertaintyNote && <HintTip label="Neden emin değil" text={item.uncertaintyNote} />}
                </span>
              )}
            </div>
            {item.evidence && item.evidence.badges.length > 0 && (
              <ul className="flex flex-wrap gap-1.5" aria-label="Kanıt">
                {item.evidence.badges.map((b, i) => <li key={i} className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${TONE[b.tone ?? 'neutral'] ?? TONE.neutral}`}>{b.label}</li>)}
              </ul>
            )}
            {typeof item.payload.message === 'string' && item.payload.message && editing !== item.id && (
              <div className="rounded border border-border bg-muted/40 p-2">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-medium text-muted-foreground">Mesaj taslağı · gönderilmedi</p>
                  <button type="button" className="rf-secondary-button min-h-8 text-xs" onClick={() => void copy(String(item.payload.message))}><Copy size={12} aria-hidden /> Kopyala</button>
                </div>
                <p className="whitespace-pre-line text-xs" aria-label="Mesaj önizleme">{String(item.payload.message)}</p>
              </div>
            )}
            {item.affected.length > 0 && !item.evidence && (
              <div className="text-xs">
                <ul className="flex flex-wrap gap-1.5" aria-label="Etkilenen kayıtlar">
                  {item.affected.map((record) => (
                    <li key={record.entityType + record.entityId}>
                      {record.href ? <Link href={record.href} className="rounded border border-border px-2 py-0.5 hover:bg-accent">{record.label}</Link> : <span className="rounded border border-border px-2 py-0.5">{record.label}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {editing === item.id && (
              <form
                className="grid gap-3 rounded border border-border p-3 sm:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  const payload = Object.fromEntries(item.editableFields.map((field) => [field.key, field.type === 'number' ? Number(form.get(field.key)) : String(form.get(field.key) ?? '')]));
                  void decide(item, { action: 'edit', payload, note: String(form.get('note') ?? '') || undefined });
                }}
              >
                {item.editableFields.map((field) => (
                  <label key={field.key} className={`block text-xs font-medium ${field.key === 'message' ? 'sm:col-span-2' : ''}`}>
                    {field.label}{field.unit ? ` (${field.unit})` : ''}
                    {field.key === 'message'
                      ? <textarea name={field.key} required rows={8} defaultValue={String(item.payload[field.key] ?? '')} className="rf-input mt-1 w-full" />
                      : <input name={field.key} type={field.type} min={field.min} max={field.max} step={field.type === 'number' ? 'any' : undefined} required defaultValue={String(item.payload[field.key] ?? '')} className="rf-input mt-1 w-full" />}
                  </label>
                ))}
                <label className="block text-xs font-medium sm:col-span-2">Neden düzelttiniz? (isteğe bağlı)<input name="note" maxLength={500} className="rf-input mt-1 w-full" /></label>
                <div className="flex justify-end gap-2 sm:col-span-2">
                  <button type="button" className="rf-secondary-button" onClick={() => setEditing(null)} disabled={busy === item.id}>Vazgeç</button>
                  <button type="submit" className="rf-primary-button" disabled={busy === item.id}>Düzeltmeyi kaydet</button>
                </div>
              </form>
            )}
            {why === item.id && item.detector && (
              <div className="space-y-2 rounded border border-border p-3 text-xs" role="region" aria-label="Bu yüzden önerdim">
                <p className="font-semibold">Bu yüzden önerdim</p>
                <p>{item.rationale}</p>
                {item.rule && <p><span className="text-muted-foreground">Kural:</span> {item.rule}</p>}
                {item.confidence && <p><span className="text-muted-foreground">Güven:</span> {CONFIDENCE[item.confidence]}{item.uncertaintyNote ? ` — ${item.uncertaintyNote}` : ''}</p>}
                {item.evidence && Object.keys(item.evidence.numbers).length > 0 && (
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 sm:grid-cols-3">
                    {Object.entries(item.evidence.numbers).filter(([, v]) => v !== null && v !== '').map(([k, v]) => <div key={k} className="flex gap-1"><dt className="text-muted-foreground">{k}:</dt><dd className="tabular-nums">{typeof v === 'number' ? v.toLocaleString('tr-TR') : v}</dd></div>)}
                  </dl>
                )}
                {item.evidence && item.evidence.records.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5" aria-label="Kanıt kayıtları">
                    {item.evidence.records.map((r) => <li key={r.entityType + r.entityId}>{r.href ? <Link href={r.href} className="rounded border border-border px-2 py-0.5 hover:bg-accent">{r.label}</Link> : <span className="rounded border border-border px-2 py-0.5">{r.label}</span>}</li>)}
                  </ul>
                )}
                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
                  <button type="button" className="rf-secondary-button min-h-8 text-xs" disabled={busy === item.id} onClick={() => void decide(item, { action: 'reject', reason: 'never' })}><BellOff size={12} aria-hidden /> Bunu bir daha önerme</button>
                  <label className="inline-flex items-center gap-1">Bu kuralı reddedince
                    <select className="rf-input min-h-8 py-0 text-xs" defaultValue="" onChange={(e) => e.target.value && void quiet(item, Number(e.target.value))} aria-label="Sessiz gün">
                      <option value="" disabled>… gün sustur</option>{[3, 7, 14, 30, 60].map((d) => <option key={d} value={d}>{d} gün</option>)}
                    </select>
                  </label>
                </div>
              </div>
            )}
            {rejecting === item.id && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs" role="group" aria-label="Ret nedeni">
                <span className="text-muted-foreground">Neden?</span>
                {REJECT_REASONS.map(([reason, label]) => <button key={reason} type="button" className="rf-secondary-button min-h-8 text-xs" disabled={busy === item.id} onClick={() => void decide(item, { action: 'reject', reason })}>{label}</button>)}
                <button type="button" className="rf-secondary-button min-h-8 text-xs" disabled={busy === item.id} onClick={() => void decide(item, { action: 'reject' })}>Nedensiz reddet</button>
              </div>
            )}
            {snoozing === item.id && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs" role="group" aria-label="Ertele">
                <span className="text-muted-foreground">Ne kadar?</span>
                {[1, 3, 7].map((d) => <button key={d} type="button" className="rf-secondary-button min-h-8 text-xs" disabled={busy === item.id} onClick={() => void decide(item, { action: 'snooze', days: d })}>{d === 1 ? 'Yarın' : `${d} gün`}</button>)}
              </div>
            )}
            {errors[item.id] && <p role="alert" className="text-xs text-rose-600">{errors[item.id]}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="rf-primary-button min-h-10" disabled={busy === item.id} onClick={() => void decide(item, { action: 'approve' })}><Check size={14} /> Onayla</button>
              {item.editableFields.length > 0 && editing !== item.id && <button type="button" className="rf-secondary-button" disabled={busy === item.id} onClick={() => setEditing(item.id)}><Pencil size={14} /> Düzenle</button>}
              {item.detector && <button type="button" className="rf-secondary-button" disabled={busy === item.id} aria-expanded={snoozing === item.id} onClick={() => setSnoozing(snoozing === item.id ? null : item.id)}><Clock size={14} /> Ertele</button>}
              <button type="button" className="rf-secondary-button" disabled={busy === item.id} aria-expanded={item.detector ? rejecting === item.id : undefined}
                onClick={() => (item.detector ? setRejecting(rejecting === item.id ? null : item.id) : void decide(item, { action: 'reject' }))}><X size={14} /> Reddet</button>
              {item.detector && <button type="button" className="rf-secondary-button" aria-expanded={why === item.id} onClick={() => setWhy(why === item.id ? null : item.id)}>Neden?</button>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
