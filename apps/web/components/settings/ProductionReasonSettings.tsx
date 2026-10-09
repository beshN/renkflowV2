'use client';

import { useEffect, useState } from 'react';
import { HintTip } from '@/components/kit';
import { requestJson } from '@/lib/shared/network';
import { cn } from '@/lib/utils';

type Reason = { code: string; label: string; active: boolean };
type Kind = 'scrap' | 'rework' | 'delay';
const KIND_LABEL: Record<Kind, string> = { scrap: 'Fire', rework: 'Rework', delay: 'Gecikme' };

/** The firm's own scrap, rework and delay reasons, and the bar lengths it can buy. */
export function ProductionReasonSettings() {
  const [reasons, setReasons] = useState<Record<Kind, Reason[]> | null>(null);
  const [available, setAvailable] = useState(true);
  const [kind, setKind] = useState<Kind>('scrap');
  const [label, setLabel] = useState('');
  const [lengths, setLengths] = useState<number[] | null>(null);
  const [lengthText, setLengthText] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    requestJson<{ available: boolean; reasons: Record<Kind, Reason[]> }>('/api/v1/production/reasons').then((r) => { if (r.ok && r.data) { setReasons(r.data.reasons); setAvailable(r.data.available); } });
    requestJson<{ available: boolean; options: number[] }>('/api/v1/production/bar-lengths').then((r) => { if (r.ok && r.data?.available) { setLengths(r.data.options); setLengthText(r.data.options.join(', ')); } });
  }, []);
  if (!reasons) return null;

  async function saveReason(body: Record<string, unknown>) {
    setMsg('');
    const r = await requestJson<{ reasons: Record<Kind, Reason[]> }>('/api/v1/production/reasons', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok && r.data) setReasons(r.data.reasons);
    else setMsg(r.error || 'Kaydedilemedi');
  }
  async function saveLengths() {
    setMsg('');
    const options = lengthText.split(/[\s,;]+/).filter(Boolean).map(Number);
    const r = await requestJson<{ options: number[] }>('/api/v1/production/bar-lengths', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ options }) });
    if (r.ok && r.data) { setLengths(r.data.options); setLengthText(r.data.options.join(', ')); setMsg('Çubuk boyları kaydedildi'); }
    else setMsg(r.error || 'Kaydedilemedi');
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold">Üretim neden kodları</h2>
        <HintTip text="Usta fire ya da gecikme girerken bu listeden seçer; üretim merkezinde nedenler Pareto olarak görünür. Kapatılan kod eski kayıtlarda okunmaya devam eder." />
      </div>
      {!available && <p className="text-xs text-amber-800 dark:text-amber-300">Veritabanı güncellemesi (042) bekleniyor.</p>}
      <div className="flex gap-1 rounded-md border border-border p-1" role="tablist">
        {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={cn('flex-1 rounded px-3 py-1.5 text-xs font-medium', kind === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>{KIND_LABEL[k]}</button>
        ))}
      </div>
      <ul className="flex flex-wrap gap-2">
        {reasons[kind].map((r) => (
          <li key={r.code}>
            <button type="button" disabled={!available} aria-pressed={r.active} title={r.active ? 'Kapat' : 'Aç'} onClick={() => void saveReason({ kind, code: r.code, label: r.label, active: !r.active })}
              className={cn('rounded-full border px-3 py-1 text-xs', r.active ? 'border-border' : 'border-dashed text-muted-foreground line-through')}>{r.label}</button>
          </li>
        ))}
      </ul>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (label.trim()) void saveReason({ kind, label: label.trim() }).then(() => setLabel('')); }}>
        <input aria-label="Yeni neden" placeholder={`Yeni ${KIND_LABEL[kind].toLocaleLowerCase('tr')} nedeni`} maxLength={60} className="rf-input min-w-0 flex-1" value={label} onChange={(e) => setLabel(e.target.value)} />
        <button disabled={!available || !label.trim()} className="rf-primary-button">Ekle</button>
      </form>
      {lengths && (
        <div className="space-y-2 border-t border-border pt-4">
          <label className="block text-xs">Alınabilen çubuk boyları (mm)
            <HintTip text="Stok yetmeyince satın alma önerisi her profil için bu boylardan en az fire bırakanı seçer; profilin kendi standart boyu da her zaman aday." />
            <input inputMode="numeric" placeholder="6000, 6500, 7000" className="rf-input mt-1 w-full" value={lengthText} onChange={(e) => setLengthText(e.target.value)} />
          </label>
          <button type="button" className="rf-primary-button" onClick={() => void saveLengths()}>Kaydet</button>
        </div>
      )}
      {msg && <p role="status" className="text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}
