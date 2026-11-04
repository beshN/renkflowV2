'use client';
import { useState } from 'react';
import { useFunPolicy } from '@/lib/features/settings/useFunFeatures';
import { toast } from 'sonner';

export function FunFeaturesSettings() {
  const { data, error, mutate } = useFunPolicy();
  const [busy, setBusy] = useState(false);
  async function toggle(enabled: boolean) {
    if (!data?.canEdit || busy || error) return;
    setBusy(true);
    try {
      const response = await fetch('/api/tenant/fun-features', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }),
      });
      if (!response.ok) throw new Error('Ayar kaydedilemedi');
      await mutate(await response.json());
      toast.success('Firma ayarı kaydedildi');
    } catch { toast.error('Ayar kaydedilemedi'); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3">
    <h2 className="text-lg font-semibold">Oyun ve sürprizler</h2>
    {error && <p role="alert" className="text-sm text-destructive">Ayar alınamadı. <button type="button" className="underline" onClick={() => void mutate()}>Yeniden dene</button></p>}
    <label className="flex items-start gap-3 text-sm">
      <input type="checkbox" role="switch" className="mt-0.5 h-4 w-4 shrink-0"
        checked={data?.enabled ?? false} aria-checked={data?.enabled ?? false}
        disabled={!data?.canEdit || busy || !!error} onChange={e => void toggle(e.target.checked)} />
      <span className="font-medium">Eğlence özellikleri açık</span>
    </label>
    <p className="text-xs text-muted-foreground">Oyunlar ve görsel sürprizler firma genelinde açılır veya kapatılır. Yalnız firma sahibi ve yönetici değiştirebilir.</p>
  </section>;
}
