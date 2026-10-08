'use client';

import { useEffect, useState } from 'react';
import { Trash2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { TAG_COLORS } from '@/lib/features/records/types';
import { HintTip, SkeletonRows } from '@/components/kit';
import { cn } from '@/lib/utils';

type Tag = { id: string; name: string; color: string; uses: number };
type Rule = { key: string; label: string; enabled: boolean };
const SWATCH: Record<string, string> = { slate: 'bg-slate-500', blue: 'bg-blue-600', green: 'bg-emerald-600', amber: 'bg-amber-500', red: 'bg-rose-600', violet: 'bg-violet-600', teal: 'bg-teal-600' };
const json = (method: string, body?: unknown) => ({ method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });

/** Firm-wide tags and the automation rules (owner/admin). Hidden until the record platform is installed. */
export function RecordSettings() {
  const [tags, setTags] = useState<Tag[] | null>(null);
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [available, setAvailable] = useState(true);
  const [name, setName] = useState('');
  const [color, setColor] = useState('blue');
  const load = async () => {
    const [t, r] = await Promise.all([fetch('/api/v1/records/tags'), fetch('/api/v1/records/rules')]);
    if (t.status === 409) return setAvailable(false);
    setTags(t.ok ? (await t.json()).tags : []);
    const rb = r.ok ? await r.json() : { rules: [] };
    setRules(rb.rules ?? []);
  };
  useEffect(() => { void load().catch(() => setTags([])); }, []);
  if (!available) return null;
  const add = async () => {
    const r = await fetch('/api/v1/records/tags', json('PUT', { name, color }));
    if (!r.ok) return toast.error((await r.json().catch(() => ({}))).error || 'Eklenemedi');
    setName('');
    void load();
  };
  return (
    <section className="space-y-5" aria-labelledby="record-settings-title">
      <h2 id="record-settings-title" className="flex items-center gap-2 text-lg font-semibold">Etiketler ve kurallar <HintTip text="Etiketler bütün kayıtlarda (sipariş, teklif, müşteri, iş emri, stok, tedarikçi) ortaktır. Kurallar yalnız firma içinde aktivite oluşturur ya da bildirim gönderir; müşteriye kendiliğinden mesaj atmaz. Açılan bir kural, açıldığı andan sonraki kayıtlara uygulanır." /></h2>
      {!tags ? <SkeletonRows rows={3} /> : (
        <div className="space-y-2">
          <ul className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <li key={t.id} className="inline-flex items-center gap-1.5 rounded-full border border-border py-1 pl-2.5 pr-1 text-sm">
                <span aria-hidden className={cn('h-2.5 w-2.5 rounded-full', SWATCH[t.color])} />{t.name}<span className="text-xs tabular-nums text-muted-foreground">{t.uses}</span>
                <button type="button" aria-label={`${t.name} sil`} onClick={async () => { const r = await fetch('/api/v1/records/tags?id=' + t.id, json('DELETE')); if (!r.ok) toast.error((await r.json().catch(() => ({}))).error || 'Silinemedi'); void load(); }} className="grid h-7 w-7 place-items-center rounded-full hover:bg-accent"><Trash2 size={12} /></button>
              </li>
            ))}
          </ul>
          <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) void add(); }}>
            <input className="rf-input h-9 w-48" placeholder="Yeni etiket" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} aria-label="Yeni etiket adı" />
            <div className="flex gap-1" role="radiogroup" aria-label="Etiket rengi">
              {TAG_COLORS.map((c) => <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c} onClick={() => setColor(c)} className={cn('h-7 w-7 rounded-full border-2', SWATCH[c], color === c ? 'border-foreground' : 'border-transparent')} />)}
            </div>
            <button type="submit" className="rf-secondary-button h-9 px-3 text-xs" disabled={!name.trim()}>Ekle</button>
          </form>
        </div>
      )}
      {rules && rules.length > 0 && (
        <ul className="space-y-2">
          {rules.map((r) => (
            <li key={r.key}>
              <label className="flex min-h-11 items-center gap-3 rounded-md border border-border px-3 text-sm">
                <Zap size={16} aria-hidden className={r.enabled ? 'text-primary' : 'text-muted-foreground'} />
                <span className="flex-1">{r.label}</span>
                <input type="checkbox" role="switch" className="h-5 w-5" checked={r.enabled} aria-label={r.label}
                  onChange={async (e) => { const res = await fetch('/api/v1/records/rules', json('PUT', { key: r.key, enabled: e.target.checked })); if (res.ok) setRules((await res.json()).rules); else toast.error('Kaydedilemedi'); }} />
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
