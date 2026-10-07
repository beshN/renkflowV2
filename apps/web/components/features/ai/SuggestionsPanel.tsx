'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Pencil, Sparkles, TriangleAlert, X } from 'lucide-react';
import { useToast } from '@/lib/context/ToastContext';

type EditableField = { key: string; label: string; type: 'number' | 'text'; min?: number; max?: number; unit?: string };
type Suggestion = {
  id: string; kind: string; kindLabel: string; title: string; rationale: string; payload: Record<string, unknown>;
  affected: Array<{ entityType: string; entityId: string; label: string; href?: string }>;
  uncertain: boolean; uncertaintyNote: string | null; source: 'system' | 'model'; model: string | null;
  edited: boolean; version: number; editableFields: EditableField[];
};

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
      if (result.status === 'pending') {
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
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="rf-section-title flex items-center gap-2"><Sparkles size={15} /> Önerilenler</h2>
          <p className="mt-1 text-xs text-muted-foreground">Asistan yalnız öneri hazırlar; onaylamadan hiçbir kayıt değişmez.</p>
        </div>
        <span className="text-xs text-muted-foreground">{items.length} bekliyor</span>
      </div>
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li key={item.id} className="space-y-3 px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{item.kindLabel}{item.edited ? ' · düzenlendi' : ''}</p>
                <h3 className="mt-1 text-sm font-semibold">{item.title}</h3>
              </div>
              <span className="text-[11px] text-muted-foreground">{item.source === 'model' ? `Model: ${item.model ?? 'bilinmiyor'}` : 'Kural / hesap motoru'}</span>
            </div>
            <p className="whitespace-pre-line text-sm text-muted-foreground">{item.rationale}</p>
            {item.uncertain && (
              <p role="note" className="flex items-start gap-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                <TriangleAlert size={14} className="mt-0.5 shrink-0" /> <span><strong>Emin değilim:</strong> {item.uncertaintyNote}</span>
              </p>
            )}
            {item.affected.length > 0 && (
              <div className="text-xs">
                <p className="font-medium">Etkilenen kayıtlar</p>
                <ul className="mt-1 flex flex-wrap gap-2">
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
                  <label key={field.key} className="block text-xs font-medium">
                    {field.label}{field.unit ? ` (${field.unit})` : ''}
                    <input name={field.key} type={field.type} min={field.min} max={field.max} step={field.type === 'number' ? 'any' : undefined} required defaultValue={String(item.payload[field.key] ?? '')} className="rf-input mt-1 w-full" />
                  </label>
                ))}
                <label className="block text-xs font-medium sm:col-span-2">Neden düzelttiniz? (isteğe bağlı)<input name="note" maxLength={500} className="rf-input mt-1 w-full" /></label>
                <div className="flex justify-end gap-2 sm:col-span-2">
                  <button type="button" className="rf-secondary-button" onClick={() => setEditing(null)} disabled={busy === item.id}>Vazgeç</button>
                  <button type="submit" className="rf-primary-button" disabled={busy === item.id}>Düzeltmeyi kaydet</button>
                </div>
              </form>
            )}
            {errors[item.id] && <p role="alert" className="text-xs text-rose-600">{errors[item.id]}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="rf-primary-button" disabled={busy === item.id} onClick={() => void decide(item, { action: 'approve' })}><Check size={14} /> Onayla</button>
              {item.editableFields.length > 0 && editing !== item.id && <button type="button" className="rf-secondary-button" disabled={busy === item.id} onClick={() => setEditing(item.id)}><Pencil size={14} /> Düzenle</button>}
              <button type="button" className="rf-secondary-button" disabled={busy === item.id} onClick={() => void decide(item, { action: 'reject' })}><X size={14} /> Reddet</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
