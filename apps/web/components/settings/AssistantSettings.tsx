'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bot, Gauge, ShieldCheck } from 'lucide-react';
import { BarMini, HintTip, Skeleton, StatusChip } from '@/components/kit';
import { requestJson } from '@/lib/shared/network';
import { AI_MODES, AI_MODE_LABELS, ASSISTANT_FEATURES, FEATURE_LABELS, type AiMode } from '@/lib/ai/policy';

type Detector = { key: string; label: string; thresholdLabel: string | null; enabled: boolean; quietDays: number; threshold?: number };
type Settings = { mode: AiMode; kvkkAckAt: string | null; dailyBudgetUsd: number | null; userDailyCalls: number; modelKeyConfigured: boolean; detectors: Detector[]; features: Record<string, boolean>; profitFloorPercent: number };
type Perf = {
  available: boolean; days: number;
  perKind?: Array<{ kind: string; label: string; filed: number; approved: number; rejected: number; expired: number; pending: number; edited: number; acceptance: number | null; medianHoursToDecide: number | null; rejectReasons: Record<string, number>; minutesSaved: number }>;
  totals?: { filed: number; approved: number; rejected: number; edited: number; acceptance: number | null; minutesSaved: number; delaysActedOn: number };
  model?: { calls: number; errors: number; tokens: number; costUsd: number | null; byFeature: Array<{ feature: string; calls: number; errors: number; costUsd: number | null }> };
};
const MODE_HINT: Record<AiMode, string> = {
  off: 'Asistan hiçbir şeye bakmaz ve model çağırmaz. Kendi yüklediğiniz sayım listesi gibi işler çalışmaya devam eder.',
  rules: 'Dedektörler kayıtlara bakar ve öneri hazırlar; mesajlar şablonla yazılır. Hiçbir veri yurt dışındaki modele gitmez.',
  assist: 'Dedektörlere ek olarak doğal dil komutları, metinden kayıt çıkarma ve sohbet modeli kullanır. Yurt dışına veri aktarımıdır; KVKK onayı gerekir.',
};
const REASON: Record<string, string> = { not_relevant: 'gereksiz', wrong: 'yanlış', already_done: 'zaten yapıldı', never: 'bir daha önerme', other: 'diğer', unspecified: 'nedensiz' };

/** Ayarlar › Asistan: mode (off / rules / model + KVKK), spend caps, each detector on/off with its quiet days and threshold. */
export function AssistantSettings() {
  const [s, setS] = useState<Settings | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [kvkk, setKvkk] = useState(false);
  const load = useCallback(async () => {
    const r = await requestJson<Settings>('/api/v1/ai/settings', { cache: 'no-store' });
    if (r.ok && r.data) setS(r.data); else setError(r.error || 'Asistan ayarları alınamadı');
  }, []);
  useEffect(() => { void load(); }, [load]);
  if (!s) return error ? <p role="alert" className="text-sm">{error}</p> : <Skeleton className="h-40" />;

  async function save(patch: Record<string, unknown>, done = 'Kaydedildi') {
    setError(''); setNotice('');
    const r = await requestJson<Settings>('/api/v1/ai/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    if (r.ok && r.data) { setS(r.data); setNotice(done);window.dispatchEvent(new Event('assistant-settings-changed')); } else setError(r.error || 'Kaydedilemedi');
  }
  const detectorPatch = (d: Detector, patch: Partial<Detector>) => save({ detectors: { [d.key]: patch } }, `${d.label}: kaydedildi`);

  return (
    <section className="space-y-4" aria-labelledby="ai-settings-title">
      <h2 id="ai-settings-title" className="flex items-center gap-2 text-lg font-semibold"><Bot size={18} aria-hidden /> Asistan</h2>
      {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
      {notice && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Çalışma biçimi</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {AI_MODES.map((m) => (
            <label key={m} className={`rf-panel flex cursor-pointer flex-col gap-1 p-3 text-sm ${s.mode === m ? 'border-primary' : ''}`}>
              <span className="flex items-center gap-2 font-medium"><input type="radio" name="ai-mode" checked={s.mode === m} onChange={() => void save({mode:m,...(m==='assist' && kvkk?{kvkkAck:true}:{})})} disabled={m==='assist' && (!s.modelKeyConfigured || !s.kvkkAckAt && !kvkk)} /> {AI_MODE_LABELS[m]}</span>
              <span className="text-xs text-muted-foreground">{MODE_HINT[m]}</span>
            </label>
          ))}
        </div>
        {s.mode !== 'assist' && (
          <div className="rf-panel space-y-2 p-3 text-sm">
            <label className="flex items-start gap-2"><input type="checkbox" checked={kvkk} onChange={(e) => setKvkk(e.target.checked)} className="mt-1" />
              <span><ShieldCheck size={14} className="inline" aria-hidden /> Model sağlayıcısının (yurt dışı) verileri işlemesinin KVKK kapsamında yurt dışına aktarım olduğunu, hukuki dayanağın firmamızca sağlandığını onaylıyorum. Kişisel veriler (ad, telefon, adres) gerekmedikçe gönderilmez, gönderilmesi gerektiğinde maskelenir.</span></label>
            <button type="button" className="rf-primary-button text-sm" disabled={!s.modelKeyConfigured || !kvkk && !s.kvkkAckAt} onClick={() => void save({mode:'assist',...(kvkk?{kvkkAck:true}:{})}, 'Sohbet açıldı')}>Modeli aç</button>
            {!s.modelKeyConfigured && <p className="text-xs text-muted-foreground">Model anahtarı bu kurulumda tanımlı değil: açılsa bile model çağrılamaz, kural motoru çalışır.</p>}
          </div>
        )}
        {s.kvkkAckAt && s.kvkkAckAt !== 'before-048' && <p className="text-xs text-muted-foreground">KVKK onayı: {new Date(s.kvkkAckAt).toLocaleString('tr-TR')}</p>}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Firma günlük model bütçesi (USD) <HintTip text="Boş = sınırsız. Maliyet yalnız model fiyatları yapılandırıldığında hesaplanır." />
          <input type="number" min={0} step="0.5" className="rf-input mt-1 w-full" defaultValue={s.dailyBudgetUsd ?? ''} onBlur={(e) => void save({ dailyBudgetUsd: e.target.value === '' ? null : Number(e.target.value) })} /></label>
        <label className="text-sm">Kişi başı günlük model çağrısı
          <input type="number" min={0} max={5000} className="rf-input mt-1 w-full" defaultValue={s.userDailyCalls} onBlur={(e) => void save({ userDailyCalls: Number(e.target.value) })} /></label>
        <label className="text-sm">Kâr tabanı (%) <HintTip text="Fiyat önerisinde tahmini kâr bunun altına düşerse uyarır. Yalnız malzeme maliyeti bilinen tekliflerde kontrol edilir." />
          <input type="number" min={0} max={90} className="rf-input mt-1 w-full" defaultValue={s.profitFloorPercent} onBlur={(e) => Number(e.target.value) !== s.profitFloorPercent && void save({ profitFloorPercent: Number(e.target.value) })} /></label>
      </div>
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">Ekler</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {ASSISTANT_FEATURES.map((f) => (
            <label key={f} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.features[f] !== false} onChange={(e) => void save({ features: { [f]: e.target.checked } }, `${FEATURE_LABELS[f]}: ${e.target.checked ? 'açık' : 'kapalı'}`)} /> {FEATURE_LABELS[f]}</label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Dedektörler <HintTip text="Her dedektör kayıtlara bakıp öneri hazırlar. Sessiz gün: reddedilen ya da onaylanan aynı durum bu kadar gün tekrar önerilmez." /></h3>
        <ul className="divide-y divide-border rounded-md border border-border" aria-label="Dedektörler">
          {s.detectors.map((d) => (
            <li key={d.key} className="flex flex-wrap items-center gap-3 p-2 text-sm">
              <label className="flex min-w-[12rem] flex-1 items-center gap-2"><input type="checkbox" checked={d.enabled} onChange={(e) => void detectorPatch(d, { enabled: e.target.checked })} /> {d.label}</label>
              <label className="flex items-center gap-1 text-xs">Sessiz <input type="number" min={0} max={365} className="rf-input w-16" defaultValue={d.quietDays} onBlur={(e) => Number(e.target.value) !== d.quietDays && void detectorPatch(d, { quietDays: Number(e.target.value) })} aria-label={`${d.label} sessiz gün`} /> gün</label>
              {d.thresholdLabel && <label className="flex items-center gap-1 text-xs">{d.thresholdLabel} <input type="number" min={0} className="rf-input w-16" defaultValue={d.threshold ?? ''} onBlur={(e) => e.target.value !== '' && Number(e.target.value) !== d.threshold && void detectorPatch(d, { threshold: Number(e.target.value) })} aria-label={`${d.label} eşik`} /></label>}
            </li>
          ))}
        </ul>
      </div>
      <QualityFixes />
    </section>
  );
}

/** Data fixes the assistant applied with approval, each undoable while nobody changed the value since. */
export function QualityFixes() {
  const [fixes, setFixes] = useState<Array<{ id: string; title: string; decidedAt: string; undone: boolean }> | null>(null);
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    const r = await requestJson<{ fixes: Array<{ id: string; title: string; decidedAt: string; undone: boolean }> }>('/api/v1/ai/data-quality', { cache: 'no-store' });
    setFixes(r.ok && r.data ? r.data.fixes : []);
  }, []);
  useEffect(() => { void load(); }, [load]);
  if (!fixes?.length) return null;
  async function undo(id: string) {
    const r = await requestJson('/api/v1/ai/data-quality', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ suggestionId: id }) });
    setMessage(r.ok ? 'Geri alındı' : r.error || 'Geri alınamadı');
    await load();
  }
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Veri kalitesi düzeltmeleri (son 30 gün)</h3>
      <ul className="divide-y divide-border rounded-md border border-border" aria-label="Veri düzeltmeleri">
        {fixes.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center gap-2 p-2 text-sm">
            <span className="min-w-0 flex-1">{f.title}</span>
            <span className="text-xs text-muted-foreground">{new Date(f.decidedAt).toLocaleDateString('tr-TR')}</span>
            {f.undone ? <StatusChip tone="neutral" label="Geri alındı" /> : <button type="button" className="rf-secondary-button text-xs" onClick={() => void undo(f.id)}>Geri al</button>}
          </li>
        ))}
      </ul>
      {message && <p role="status" className="text-xs">{message}</p>}
    </div>
  );
}

/** Ayarlar › Asistan performansı: real counts from the queue and the model usage log. */
export function AssistantPerformance() {
  const [days, setDays] = useState(90);
  const [p, setP] = useState<Perf | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    setP(null);
    void requestJson<Perf>(`/api/v1/ai/performance?days=${days}`, { cache: 'no-store' }).then((r) => { if (current) { if (r.ok && r.data) setP(r.data); else setError(r.error || 'Performans alınamadı'); } });
    return () => { current = false; };
  }, [days]);
  return (
    <section className="space-y-3" aria-labelledby="ai-perf-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="ai-perf-title" className="flex items-center gap-2 text-lg font-semibold"><Gauge size={18} aria-hidden /> Asistan performansı</h2>
        <select className="rf-input text-sm" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Dönem">{[30, 90, 365].map((d) => <option key={d} value={d}>Son {d} gün</option>)}</select>
      </div>
      {error && <p role="alert" className="text-sm">{error}</p>}
      {!p ? (!error && <Skeleton className="h-32" />) : !p.available || !p.totals ? <p className="text-sm text-muted-foreground">Asistan kuyruğu bu kurulumda yok.</p> : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[['Öneri', p.totals.filed], ['Kabul oranı', p.totals.acceptance === null ? '—' : `%${p.totals.acceptance}`], ['Tahmini kazanılan süre', `${Math.round(p.totals.minutesSaved / 6) / 10} sa`], ['Önlenmeye çalışılan gecikme', p.totals.delaysActedOn]].map(([l, v]) => (
              <div key={l as string} className="rf-panel p-2 text-center"><p className="text-[11px] text-muted-foreground">{l}</p><p className="text-lg font-semibold tabular-nums">{v}</p></div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">Kazanılan süre bir tahmindir: onaylanan her öneri türü için sabit dakika (ör. geciken sipariş 10 dk, kesim planı 30 dk). Ölçüm değildir.</p>
          {p.perKind && p.perKind.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1">Tür</th><th className="text-right">Öneri</th><th className="text-right">Onay</th><th className="text-right">Ret</th><th className="text-right">Düzenlenen</th><th className="text-right">Kabul</th><th className="text-right">Karar süresi</th><th>Ret nedenleri</th></tr></thead>
                <tbody>
                  {p.perKind.map((k) => (
                    <tr key={k.kind} className="border-t border-border">
                      <td className="py-1">{k.label}</td><td className="text-right tabular-nums">{k.filed}</td><td className="text-right tabular-nums">{k.approved}</td><td className="text-right tabular-nums">{k.rejected}</td><td className="text-right tabular-nums">{k.edited}</td>
                      <td className="text-right">{k.acceptance === null ? '—' : <StatusChip tone={k.acceptance >= 60 ? 'success' : k.acceptance >= 20 ? 'warning' : 'danger'} label={`%${k.acceptance}`} />}</td>
                      <td className="text-right tabular-nums">{k.medianHoursToDecide === null ? '—' : `${k.medianHoursToDecide} sa`}</td>
                      <td className="text-xs text-muted-foreground">{Object.entries(k.rejectReasons).map(([r, n]) => `${REASON[r] ?? r} ${n}`).join(', ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {p.model && (
            <div className="space-y-1 text-sm">
              <p><span className="text-muted-foreground">Model:</span> {p.model.calls} çağrı · {p.model.errors} hata · {p.model.tokens.toLocaleString('tr-TR')} token · {p.model.costUsd === null ? 'maliyet hesaplanmadı (fiyat yapılandırılmamış)' : `$${p.model.costUsd}`}</p>
              {p.model.byFeature.length > 0 && <BarMini items={p.model.byFeature.slice(0, 6).map((f) => ({ key: f.feature, label: f.feature, value: f.calls }))} />}
            </div>
          )}
        </>
      )}
    </section>
  );
}
