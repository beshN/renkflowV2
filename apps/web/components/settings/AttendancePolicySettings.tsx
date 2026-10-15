"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { requestJson } from '@/lib/shared/network';
import { DEFAULT_ATTENDANCE_POLICY, type AttendancePolicy, type AttendanceRules } from '@/lib/features/personnel/attendance-policy';
export function AttendancePolicySettings() {
  const [policy, setPolicy] = useState<(AttendancePolicy & { canEdit?: boolean }) | null>(null), [rules, setRules] = useState<AttendanceRules>(DEFAULT_ATTENDANCE_POLICY.rules);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  async function load() { const r = await requestJson<AttendancePolicy & { canEdit: boolean }>('/api/v1/finance/personnel?view=policy'); if (r.ok && r.data) { setPolicy(r.data); setRules(r.data.rules); setError(''); } else setError(r.error || 'Ayarlar alınamadı'); }
  useEffect(() => { void load(); }, []);
  return <section className="space-y-4"><div><h2 className="text-lg font-semibold">Devamsızlık ve izin kesintileri</h2><p className="mt-2 text-sm text-muted-foreground">Her gün için kaç günlük ücret kesileceğini seçin. Aylık maaşta günlük ücret = maaş / 30. Yeni kurallar yalnız yeni kayıtlara uygulanır; eski günün kuralı korunur.</p></div>
    {error && <p role="alert" className="text-sm text-destructive">{error} <button type="button" className="underline" onClick={load}>Yeniden dene</button></p>}{message && <p role="status" className="text-sm text-primary">{message}</p>}
    {policy && <form className="space-y-4" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); setMessage(''); try { const r = await requestJson<AttendancePolicy>('/api/v1/finance/personnel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'policy.save', input: { version: policy.version, rules } }) }); if (!r.ok || !r.data) { setError(r.error || 'Kaydedilemedi'); return; } setPolicy({ ...r.data, canEdit: policy.canEdit }); setRules(r.data.rules); setMessage(`Kurallar kaydedildi · sürüm ${r.data.version}`); } finally { setBusy(false); } }}>
      <div className="grid gap-4 sm:grid-cols-3">{([['absent', 'Habersiz gelmedi', 3], ['unpaid_leave', 'Ücretsiz izin', 1], ['half_day', 'Yarım gün', 1]] as const).map(([key, label, max]) => <label key={key} className="rf-field">{label}<div className="flex items-center gap-2"><input aria-label={label + ' kesinti katsayısı'} disabled={busy || !policy.canEdit} type="number" min="0" max={max} step="0.05" required className="rf-input w-full" value={rules[key]} onChange={e => setRules(prev => ({ ...prev, [key]: Number(e.target.value) }))} /><span className="shrink-0 text-xs text-muted-foreground">günlük ücret</span></div></label>)}</div>
      <p className="rounded-lg bg-muted p-3 text-xs leading-5">Ücretli izin ve yıllık izin: kesinti yok. Raporlu günler ayrı kaydedilir. Habersiz devamsızlıkta bir günü aşan kısmı ek ücret kesintisidir; resmi bordro ve uygulanabilir ücret kesme kuralları muhasebe tarafından incelenmelidir.</p>
      <div className="flex flex-wrap gap-3">{policy.canEdit && <button disabled={busy} className="rf-primary-button">Kuralları kaydet</button>}<Link className="rf-secondary-button" href="/finance/employees">Çalışan kayıtlarına git</Link></div>
    </form>}
  </section>;
}
